# Phase 03 — Attendance & QR System

## Goal

Ship end-to-end QR-based attendance: a rotating, single-use token issued to the student, scanned by a staff device, validated server-side, and written to `attendance`. Anti-fraud from day one — no static QR.

## Why this phase exists

Attendance is the second-most-demoable module and the one most prone to fraud. Doing this right once means we never have to rewrite it when the institute grows from one branch to many.

## Recommended QR approach

**Rotating, short-lived JWT token per student, scanned by authenticated staff.**

### Full reasoning

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| Static QR per student (their UUID) | Trivial to build | Any photo/screenshot of a student's QR allows a friend to proxy attendance | ❌ Rejected |
| Static signed QR (JWT without exp) | Cryptographic check | Same replay problem | ❌ Rejected |
| Time-bound QR (refresh every N seconds) | Harder to share; tight window | Needs server round-trip each refresh; students on bad internet struggle | ⚠️ Partial |
| **Rotating JWT (15s) signed locally + single-use consumption** | Short window + one-shot ensures no replay; no server call per rotation; works offline for the student | Student's device clock drift must be handled | ✅ **Chosen** |
| Beacon / geofence-based | No QR needed | Needs BLE hardware per classroom; iOS quirks; overkill for MVP | ❌ Rejected |
| Teacher/staff manual tap | Fastest for teacher | No fraud prevention | ❌ Rejected |

### How it works

1. On login, the student's device gets a per-student **signing secret** (not a session token — a stable HMAC secret stored in `qr_secrets(student_id, secret)` server-side, fetched once and cached in `expo-secure-store`).
2. The student's device generates a JWT every 15s locally: `{ sub: student_id, jti: random_uuid, iat, exp: iat+20 }` signed with that per-student secret. The small 5s window between exp and next rotation tolerates scanning latency.
3. The staff device (teacher app in "scanner mode") scans the QR, sends `{ token, class_id }` to Edge Function `consume-qr-token`.
4. Edge Function:
   a. Decodes the JWT header to get `sub`.
   b. Looks up that student's secret from `qr_secrets`.
   c. Verifies signature + `exp` + clock skew ≤30s.
   d. Checks `jti` has not been consumed in the last 10 minutes (via Redis-like table `qr_jti_cache` or `qr_tokens.consumed_at`).
   e. Verifies student is enrolled in the class's batch.
   f. Verifies the class is "in session" (scheduled_at − 15min ≤ now ≤ scheduled_at + duration + 15min).
   g. Inserts `attendance` row (unique on `(student_id, class_id)`) — duplicates silently pass.
   h. Returns student name + batch to scanner for visual confirmation.
5. Student receives a push ping "Attendance marked — Physics, 10:03 AM" + realtime subscription updates their attendance history.

Why a per-student HMAC secret and not just a session JWT? The session JWT is a bearer token for the entire Supabase API — we don't want it on a QR. A per-student symmetric secret scoped only to attendance minimizes blast radius if a QR is somehow leaked.

## Scope

### In-scope
- Student QR screen (full-screen, rotates every 15s, shows a visible timer ring).
- Scanner mode in the teacher app (camera → decode → confirm).
- Edge Function `issue-qr-token` (issues or rotates the per-student signing secret).
- Edge Function `consume-qr-token` (validates and writes attendance).
- `qr_secrets`, `qr_jti_cache` tables.
- Attendance history screen for students.
- Attendance view for teachers (per class).
- Admin manual override (in P7, but schema stubbed here).

### Out-of-scope
- ID-card hardware scanning (future).
- Geofencing (future).
- Batch/bulk scan UI for large classrooms (deferred unless demo specifically requires).

## User roles impacted
- Student: shows QR, views history.
- Teacher / staff: scanner mode, views attendance per class.
- Admin: P7 will add manual override.

## Screens to build
1. `/(app)/attendance/qr` — student QR screen.
2. `/(app)/attendance/history` — student attendance history (calendar heatmap + list).
3. `/(teacher)/scanner` — camera scanner with class picker.
4. `/(teacher)/classes/[id]/attendance` — attendance roster for a class.

## Frontend tasks

### Student QR screen
- [ ] Request QR signing secret on mount; cache in SecureStore keyed by `student_id`.
- [ ] Start 15s interval; generate JWT with `react-native-pure-jwt` or WebCrypto.
- [ ] Render QR using `react-native-qrcode-svg` with high error-correction (H).
- [ ] Timer ring using Reanimated showing seconds-until-rotate.
- [ ] Brightness boost while screen is open (`expo-brightness`).
- [ ] Prevent screenshots: use `expo-screen-capture` to hide in task switcher.
- [ ] Show class name if exactly one class is active now, else "Show this to staff".

### Attendance history
- [ ] Monthly calendar with dots for days attended (use `react-native-calendars`).
- [ ] List view below: grouped by date, each row = class + marked_at + method.
- [ ] Aggregate badge at top: "82% attendance this month".

### Scanner mode
- [ ] Gate by `role in ('teacher','admin')`.
- [ ] Camera via `expo-camera` with `CameraView` in barcode scanning mode (`qr`).
- [ ] Class picker (dropdown) showing classes for this teacher's assignments happening now.
- [ ] On scan: POST `/functions/v1/consume-qr-token` with `{ token, class_id }`.
- [ ] Visual feedback: green check + student avatar + name, red cross + reason.
- [ ] Sound + haptic on success/fail.
- [ ] Debounce: ignore the same `jti` within 2s at the scanner level.

## Backend tasks

### Tables (additions beyond P1)
```sql
create table qr_secrets (
  student_id uuid primary key references profiles(id) on delete cascade,
  secret text not null,             -- 32-byte base64
  rotated_at timestamptz not null default now()
);

create table qr_jti_cache (
  jti uuid primary key,
  student_id uuid not null,
  consumed_at timestamptz not null default now()
);
create index on qr_jti_cache (consumed_at);
-- pg_cron job deletes rows older than 15 minutes

-- attendance already exists; add:
alter table attendance add constraint attendance_unique unique (student_id, class_id);
alter table attendance add column scanner_id uuid references profiles(id);
alter table attendance add column class_window_ok boolean not null default true;
```

### RLS
```sql
-- qr_secrets: only the student themselves can read their own secret
create policy qr_secrets_self on qr_secrets
  for select using (student_id = auth.uid());
-- No direct inserts; must go through issue-qr-token SECURITY DEFINER RPC

-- attendance insert only via consume-qr-token (SECURITY DEFINER). Block direct inserts:
revoke insert on attendance from authenticated;
```

### Edge Functions

**`issue-qr-token`** (student-authenticated)
- Inputs: none (uses JWT).
- Logic: upsert `qr_secrets` for `auth.uid()` if missing or rotated > 30 days. Return `{ secret }`.
- Caches aggressively client-side (only rotates on explicit admin action or every 30 days).

**`consume-qr-token`** (scanner-authenticated)
- Inputs: `{ token: string, class_id: uuid }`.
- Auth: caller role must be `teacher` or `admin`.
- Validation steps as listed in "How it works" above.
- On success: insert attendance, return `{ ok: true, student: {id, name, avatar_url}, class: {subject} }`.
- On failure: return typed error (`EXPIRED`, `REPLAY`, `NOT_ENROLLED`, `CLASS_NOT_ACTIVE`, `UNAUTHORIZED`).

### Notifications
- On successful attendance insert, a trigger enqueues a push notification ("Attendance marked — {subject}") — fanout runs in P8; the trigger writes to `notifications` table immediately so the in-app inbox shows it.

## Database / data model needs
See above schema additions.

## APIs / services needed
Two Edge Functions; see `API-DESIGN-AND-SERVICE-BOUNDARIES.md`.

## Third-party integrations
None specific; uses camera + QR libraries only.

## Recommended libraries
| Purpose | Package |
|---|---|
| QR render | `react-native-qrcode-svg` |
| QR scan | `expo-camera` |
| JWT sign/verify (RN) | `react-native-pure-jwt` |
| JWT sign/verify (Edge) | built-in `jose` in Deno |
| Brightness | `expo-brightness` |
| Secure storage | `expo-secure-store` |
| Screen capture block | `expo-screen-capture` |
| Calendar | `react-native-calendars` |

## Edge cases
- Two staff scan same QR simultaneously → unique `(jti)` means the second is a duplicate and fails gracefully.
- Class scheduled but canceled → `classes.status = 'canceled'` makes the class-window check fail; scanner shows "Class is canceled".
- Student clock drift >30s → scanner returns `EXPIRED`; student screen shows "Please sync device time" hint when 3 consecutive scans fail.
- Student has no active membership → attendance still marks (attendance is independent of membership — per PRD).
- Teacher forgot to pick a class → scanner requires class pick; greyed-out until selected.
- Offline scanner → queue scans in local storage, sync on reconnect; server rejects `jti` older than 30s anyway, so offline scanning has a hard limit of ~15s after capture. Document this clearly in the UI.

## Risks
| Risk | Mitigation |
|---|---|
| Classroom has bad WiFi for staff device | Teachers carry LTE-enabled phone; scanner tolerates 1-2s latency. |
| Student could share QR via screen share | Screen capture blocker + rotating token + single-use JTI ensures window is ~15s. |
| Camera permission confusion on Android | Clear permission-priming screen before first scanner open. |
| Clock drift | NTP check on scanner side; scanner uses server time from the Edge Function response. |

## Dependencies on earlier phases
- Phase 1 (schema, Edge Function infra).
- Phase 2 (student app shell, auth, navigation).

## Acceptance criteria
- [ ] Student QR rotates visibly every 15s with a timer ring.
- [ ] Scanner on a teacher device scans and marks attendance in <1s on good WiFi.
- [ ] Double-scan of same QR in same class shows "Already marked" (no duplicate row).
- [ ] Scan of a screenshot taken 30+ seconds ago fails with `EXPIRED`.
- [ ] Scan when class is not active fails with `CLASS_NOT_ACTIVE`.
- [ ] Attendance history screen shows the marked class within 2s (realtime).
- [ ] Load test: 30 scans in 30 seconds against Edge Function succeed with p95 <500ms.
- [ ] Unit tests cover every failure case of `consume-qr-token`.

## Definition of done
- All acceptance criteria.
- Security review pass: can't forge a token without stealing the `qr_secrets` row from the device (and device storage is SecureStore / Android Keystore).
- Playbook doc: "how to handle classroom with 50 students" (two scanner devices recommended, parallel queues).

## Suggested folder / module breakdown

```
apps/mobile/src/features/attendance/
├── screens/
│   ├── QrScreen.tsx
│   ├── HistoryScreen.tsx
│   └── ScannerScreen.tsx
├── components/
│   ├── RotatingQr.tsx
│   ├── TimerRing.tsx
│   └── ScanResultToast.tsx
├── hooks/
│   ├── useQrSecret.ts
│   ├── useRotatingToken.ts
│   └── useAttendanceHistory.ts
└── api.ts

supabase/functions/
├── issue-qr-token/
│   └── index.ts
└── consume-qr-token/
    └── index.ts
```

## Suggested order of implementation

1. Schema: `qr_secrets`, `qr_jti_cache`, attendance constraints; seed test data.
2. `issue-qr-token` Edge Function + tests (deno test).
3. `consume-qr-token` Edge Function + tests (each failure case).
4. `useQrSecret` hook + SecureStore persistence.
5. `useRotatingToken` hook with JWT signing.
6. Student QR screen.
7. Scanner screen (teacher app role gate).
8. Attendance history screen with realtime subscription.
9. Integration test against seeded data: 3 students × 1 class.
10. Demo pass: end-to-end mark attendance via scanner and see student dashboard update.
