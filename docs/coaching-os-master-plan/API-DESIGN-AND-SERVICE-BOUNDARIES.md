# API Design & Service Boundaries

## 1. API philosophy

We deliberately split the API surface into three layers:

1. **PostgREST (Supabase auto-API)** — for straightforward reads and simple writes against tables and views, gated by RLS. This is ~70% of the surface.
2. **Postgres RPCs** — stored functions exposed via PostgREST for server-side business logic that doesn't need external calls (e.g., `register_device_token`, `mark_notification_read`).
3. **Edge Functions (Deno)** — for anything that (a) mints tokens, (b) calls external services, (c) performs privileged multi-row operations, or (d) handles webhooks.

No REST controllers by hand. No GraphQL. The surface is small enough that conventions > machinery.

### Error conventions

Every Edge Function returns:
```json
{ "ok": true,  "data": <payload> }
// or
{ "ok": false, "error": { "code": "STRING_CODE", "message": "Human readable" } }
```

HTTP status codes map:
- 200 success
- 400 invalid input (zod validation fail)
- 401 unauthenticated
- 403 authorization fail
- 404 not found
- 409 conflict / idempotency clash
- 422 business-rule violation (e.g., `NOT_ENROLLED`)
- 429 rate limit
- 500 unexpected

### Auth propagation

- Client sends Supabase JWT as `Authorization: Bearer <access_token>`.
- Edge Functions validate via `supabase.auth.getUser(jwt)` before any work.
- Role extracted from `profiles.role` via a per-request cached lookup.
- Service-role key never leaves Edge Functions.

### Rate limiting

Table-driven: `rate_limits(key text, window_start timestamptz, count int)`. Edge Functions increment and reject past threshold. Thresholds:
- `consume-qr-token`: 30/min per scanner.
- `create-razorpay-order`: 10/min per student.
- `issue-100ms-token`: 20/min per user.
- `register_device_token`: 5/min per user.

### Versioning

- Edge Functions are path-versioned only when we make breaking changes (`/functions/v1/x` → `/functions/v2/x`).
- PostgREST: views are the versioning handle. Breaking change = new view (`v2_student_today_classes`). Clients read from the view they were compiled against.
- RPC signatures: never rename arguments; add optional parameters only.

## 2. Module catalog (client-facing)

### 2.1 Auth & profile

| Endpoint | Type | Auth | Purpose |
|---|---|---|---|
| `supabase.auth.signInWithOtp({phone})` | Supabase | none | Send OTP |
| `supabase.auth.verifyOtp({phone, token})` | Supabase | none | Create session |
| `supabase.auth.signOut()` | Supabase | user | Clear session |
| `profiles` (select self) | PostgREST | user | Get own profile |
| `profiles` (update self) | PostgREST | user | Edit own name/avatar |
| `rpc('register_device_token', {token, platform})` | RPC | user | Register push token |

### 2.2 Dashboard / reads

| Endpoint | Type | Auth | Purpose |
|---|---|---|---|
| `v_student_today_classes` | View select | student | Today's schedule |
| `v_student_recent_recordings` | View select | student | Last 30d recordings |
| `v_student_recent_materials` | View select | student | Last 30d materials |
| `announcements` (select) | PostgREST | user | Announcements for audience |
| `notifications` (select) | PostgREST | user | Notification inbox |
| `rpc('mark_notification_read', {id})` | RPC | user | Mark read |

### 2.3 Classes & Live

| Endpoint | Type | Auth | Purpose |
|---|---|---|---|
| `classes` (select) | PostgREST | user | Filter by batch |
| `classes` (update status) | PostgREST | teacher/admin | Start/end |
| `/functions/v1/create-100ms-room` | Edge Fn | teacher/admin | Idempotent room create |
| `/functions/v1/issue-100ms-token` | Edge Fn | user | Gated token |
| `/functions/v1/finalize-class` | Edge Fn | teacher/admin | End + trigger recording flow |
| `/functions/v1/recording-webhook` | Edge Fn | 100ms (HMAC) | Receive recording success |
| `/functions/v1/sign-bunny-url` | Edge Fn | user | Short-lived playback URL |
| `/functions/v1/update-watch-position` | Edge Fn | user | Debounced save |

#### `issue-100ms-token` contract
```
POST /functions/v1/issue-100ms-token
Body: { classId: uuid }
200: { ok: true, data: { token, role, room_id } }
Errors:
  401 UNAUTHENTICATED
  403 NOT_ENROLLED | MEMBERSHIP_EXPIRED
  404 CLASS_NOT_FOUND
  422 CLASS_NOT_ACTIVE | CLASS_CANCELED
  429 RATE_LIMITED
```

#### `finalize-class` contract
```
POST /functions/v1/finalize-class
Body: { classId: uuid }
Auth: teacher of class OR admin
Actions: endRoom at 100ms, set class.status='ended', wait for webhook to transcode.
200: { ok: true, data: { classId, recordingStatus } }
```

### 2.4 Attendance

| Endpoint | Type | Auth | Purpose |
|---|---|---|---|
| `/functions/v1/issue-qr-token` | Edge Fn | student | Return/create QR signing secret |
| `/functions/v1/consume-qr-token` | Edge Fn | teacher/admin | Validate QR + write attendance |
| `attendance` (select own) | PostgREST | student | History |
| `attendance` (select batch) | PostgREST | teacher | Per-class roster |
| `/functions/v1/manual-mark-attendance` | Edge Fn | teacher/admin | Manual mark with audit |

#### `consume-qr-token` contract
```
POST /functions/v1/consume-qr-token
Body: { token: string, class_id: uuid }
Auth: teacher or admin
200: { ok: true, data: { student: {id,name,avatar_url}, class: {subject} } }
Errors:
  401 UNAUTHENTICATED
  403 UNAUTHORIZED (not staff)
  422 EXPIRED | REPLAY | NOT_ENROLLED | CLASS_NOT_ACTIVE | BAD_SIGNATURE
  429 RATE_LIMITED
```

### 2.5 Content & Clips

| Endpoint | Type | Auth | Purpose |
|---|---|---|---|
| `content_items` (select) | PostgREST | user | List (RLS filters) |
| `/functions/v1/upload-material-url` | Edge Fn | teacher/admin | Signed upload URL |
| `/functions/v1/finalize-material` | Edge Fn | teacher/admin | Create content row |
| `/functions/v1/request-material-url` | Edge Fn | user | Gated signed download |
| `/functions/v1/create-clip` | Edge Fn | teacher/admin | Request Bunny clip |
| `/functions/v1/clip-ready-webhook` | Edge Fn | Bunny (HMAC) | Clip finalize |
| `/functions/v1/generate-thumbnail` | Edge Fn | cron | PDF thumb render |

### 2.6 Membership & Payments

| Endpoint | Type | Auth | Purpose |
|---|---|---|---|
| `plans` (select) | PostgREST | user | Plan catalog |
| `memberships` (select own) | PostgREST | student | Status |
| `payments` (select own) | PostgREST | student | History |
| `/functions/v1/create-razorpay-order` | Edge Fn | student | Start payment |
| `/functions/v1/verify-razorpay-payment` | Edge Fn | student | Finalize (client path) |
| `/functions/v1/razorpay-webhook` | Edge Fn | Razorpay (HMAC) | Finalize (webhook path) |
| `/functions/v1/generate-invoice-pdf` | Edge Fn | internal | PDF invoice |
| `/functions/v1/send-expiry-reminders` | Edge Fn | cron | Enqueue reminders |
| `/functions/v1/enforce-expiry` | Edge Fn | cron | Flip expired |

### 2.7 Notifications

| Endpoint | Type | Auth | Purpose |
|---|---|---|---|
| `notifications` (select own) | PostgREST | user | Inbox |
| `/functions/v1/expo-push-fanout` | Edge Fn | cron/internal | Dispatch pending |
| `/functions/v1/class-reminders` | Edge Fn | cron (every minute) | Enqueue 15-min reminders |
| `/functions/v1/send-announcement` | Edge Fn | admin | Publish + enqueue |
| `notification_preferences` (select/update own) | PostgREST | user | Opt-outs |

### 2.8 Admin surface

Admin uses the same tables via service-role from Next.js server actions. Dedicated write paths:
- Students/teachers CRUD (insert with role; invite via `supabase.auth.admin.createUser`).
- Batches, courses, enrollments CRUD.
- Classes CRUD + manual status change.
- Plans CRUD.
- Bulk CSV import: server action that uses `copy` via a temporary table + dry-run report.

Admin rarely calls Edge Functions other than `send-announcement`, `finalize-class` (override), `generate-invoice-pdf`, and `manual-mark-attendance`.

## 3. Where business logic lives

| Logic | Location | Why |
|---|---|---|
| Access control (who sees what) | RLS policies + helper SQL functions | Unified at the DB edge |
| QR validation | Edge Function `consume-qr-token` | Needs HMAC verification, external to DB |
| Payment verification | Edge Function `verify-razorpay-payment` + webhook | HMAC + external calls |
| Live token issuance | Edge Function `issue-100ms-token` | External call + role logic |
| Visibility filtering on storage | Edge Function `request-material-url` | Signed URLs can't be RLSed once minted |
| Transactional membership extension | Edge Function (within SQL transaction) | Multi-row atomic update |
| Audit logging | Postgres triggers | DB layer, never skipped |
| Notification enqueue | Postgres triggers on source tables | Guaranteed emission |
| Notification fanout | Edge Function `expo-push-fanout` | External Expo Push call |

**Rule of thumb:** logic that only reads/writes our Postgres lives in Postgres (RLS, triggers, RPCs). Logic that crosses a trust boundary or needs a non-SQL operation lives in an Edge Function.

## 4. Synchronous vs asynchronous operations

| Operation | Mode |
|---|---|
| Login OTP verify | Sync |
| Dashboard reads | Sync |
| QR consume + attendance write | Sync (must be <1s) |
| Razorpay order create | Sync |
| Razorpay payment verify | Sync on client path; async on webhook fallback |
| Start live class | Sync (creates room) |
| End live class | Sync (ends room); recording finalize is async (webhook) |
| Clip create | Async (webhook completes) |
| Material upload | Sync upload; async thumbnail |
| Push notification dispatch | Async (fanout loop) |
| Membership expiry enforcement | Async (daily cron) |
| Invoice PDF generation | Async (post-payment) |

## 5. Contracts in detail (selected)

### `create-razorpay-order`
```
POST /functions/v1/create-razorpay-order
Body: { planId: uuid }
Auth: student with active session
Steps:
  1. Load plan, ensure is_active.
  2. Insert payments row with status='pending'; receipt = payments.id.
  3. Call Razorpay create-order with amount_inr*100, receipt, currency='INR'.
  4. Update payments.razorpay_order_id.
  5. Return { order_id, key_id, amount, currency, receipt }.
200: { ok: true, data: { order_id, key_id, amount, currency, receipt } }
```

### `verify-razorpay-payment`
```
POST /functions/v1/verify-razorpay-payment
Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
Auth: student
Steps:
  1. Lookup payments row by order_id; verify student_id = auth.uid().
  2. HMAC-SHA256(order_id + '|' + payment_id, secret) must equal signature.
  3. If already paid → return success (idempotent).
  4. Begin transaction:
     - payments.status='paid', paid_at=now()
     - upsert memberships with renewal semantics
     - insert notifications(type='payment.success')
     - insert notifications(type='membership.activated')
  5. Fire `generate-invoice-pdf` asynchronously.
200: { ok: true, data: { membership: {...} } }
```

### `razorpay-webhook`
Safety net path. Verifies HMAC of the raw body with webhook secret. Handles `payment.captured`. Writes same state as verify (idempotent).

### `issue-qr-token`
```
POST /functions/v1/issue-qr-token
Body: {} (uses auth)
Auth: student
Steps:
  1. Lookup qr_secrets by student_id=auth.uid().
  2. If missing or rotated_at older than 30 days: generate 32 random bytes, upsert.
  3. Return { secret_b64 }.
Client caches secret in SecureStore; never re-requests unless missing.
```

### `consume-qr-token`
Already detailed in Phase 3. Failures map to typed error codes.

### `sign-bunny-url`
```
POST /functions/v1/sign-bunny-url
Body: { content_id: uuid }
Auth: user
Steps:
  1. Load content_items by id with RLS on (effectively checks visibility).
  2. If type in ('recording','clip') and video_asset_id present:
     - Compute Bunny token-auth URL with ttl=3600s, security key from secret.
  3. Return { url, expires_at }.
```

### `request-material-url`
```
POST /functions/v1/request-material-url
Body: { content_id: uuid }
Auth: user
Steps:
  1. Load content row (RLS).
  2. Generate signed URL against Supabase Storage with 10-minute TTL.
  3. Watermark policy: the URL query param encodes student_id so a Cloudflare Worker in front of storage can apply PDF watermarks on fly (stretch goal; MVP can skip).
```

## 6. PostgREST query patterns

Examples client code uses:

```ts
// today's classes
supabase
  .from('v_student_today_classes')
  .select('*')
  .order('scheduled_at');

// attendance history
supabase
  .from('attendance')
  .select('id, marked_at, method, class:classes(subject, scheduled_at)')
  .order('marked_at', { ascending: false })
  .limit(30);

// content library
supabase
  .from('content_items')
  .select('*, course:courses(name), batch:batches(name)')
  .eq('type', 'pdf')
  .order('created_at', { ascending: false })
  .range(0, 19);
```

All of these go through RLS; no client code needs to repeat "is this student allowed?" checks.

## 7. Realtime subscriptions

```ts
supabase
  .channel('classes-batch-<id>')
  .on('postgres_changes', {
    event: 'UPDATE', schema: 'public', table: 'classes', filter: `batch_id=eq.<id>`
  }, payload => updateCache(payload.new))
  .subscribe();
```

Used for:
- Class status flips (`scheduled → live → ended`).
- Attendance insert on the student's own row (history screen updates instantly).
- Membership updates after payment.
- Notifications inbox (new notification row).
- Content ready (clip/recording transcoded).

Channels are scoped as tightly as possible to minimize bandwidth.

## 8. Webhook receiver conventions

All webhook endpoints:
- Validate HMAC before reading body.
- Reject events older than 5 minutes (`X-Event-Time` or provider-specific).
- Use the provider's event id as an idempotency key (store in `webhook_events(provider, event_id)` table).
- Return 200 quickly; do heavy work asynchronously via internal pgmq queue if needed.
- Log every received event (sanitized) to Supabase logs.

## 9. Type sharing

- `supabase gen types typescript` generates the Database types.
- Output stored in `packages/types/src/database.ts`.
- Both apps import from `@coachingos/types`.
- Zod schemas for Edge Function inputs/outputs live in `packages/types/src/contracts/` and are consumed by both client callers and server handlers.

## 10. Example folder layout for Edge Functions

```
supabase/functions/
├── _shared/
│   ├── auth.ts             # JWT validation, role lookup
│   ├── supabase.ts         # service role client
│   ├── hmac.ts
│   ├── razorpay.ts
│   ├── hms.ts
│   ├── bunny.ts
│   ├── expo.ts
│   ├── rate-limit.ts
│   └── errors.ts
├── issue-qr-token/
├── consume-qr-token/
├── create-100ms-room/
├── issue-100ms-token/
├── finalize-class/
├── recording-webhook/
├── sign-bunny-url/
├── update-watch-position/
├── upload-material-url/
├── finalize-material/
├── request-material-url/
├── create-clip/
├── clip-ready-webhook/
├── generate-thumbnail/
├── create-razorpay-order/
├── verify-razorpay-payment/
├── razorpay-webhook/
├── generate-invoice-pdf/
├── send-expiry-reminders/
├── enforce-expiry/
├── class-reminders/
├── expo-push-fanout/
├── send-announcement/
├── manual-mark-attendance/
└── health/
```

## 11. Testing the API

- **Deno test** per Edge Function, with mocked external calls.
- **pgTAP** for stored functions and RLS policies. A test suite that:
  - Logs in as student A, tries to read student B's attendance → expects 0 rows.
  - Logs in as teacher, tries to read payment → expects 0 rows.
  - Logs in as admin, confirms access.
- **Contract tests** comparing zod schemas in `packages/types/contracts` against live Edge Function responses in staging.
- CI gates merges on all three.
