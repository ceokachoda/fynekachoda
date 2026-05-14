# Spec: Security & Privacy (Cross-Cutting)

This document is the consolidated security posture for FyneStudy. Every feature spec defers to this file for details on auth, RLS, secrets, rate limiting, audit, PII handling, and DPDP Act 2023 compliance.

---

## 1. Threat Model (Summary)

| Threat actor | Goals | Mitigations |
|---|---|---|
| **Curious student** | See others' grades, share quiz answers, fake attendance, fake leaderboard rank | RLS, server-side grading, server-side QR verification, server-side leaderboard computation |
| **Malicious student** | Cheat on exams, leak class recordings, impersonate others, share creds | Server timer, tab-switch logging, watermarks, MFA optional, audit log, session revocation |
| **Compromised teacher** | Mass-promote inappropriate content, leak student data, grade-fix | Role boundaries, audit log on every write, admin override, MFA optional-but-recommended |
| **Compromised admin** | Mass-export PII, delete data, force-add admins | TOTP required, owner/staff split, audit log, deletion confirmation flows, optional outbound monitoring |
| **External attacker (network)** | Steal traffic, brute force | TLS everywhere, Supabase rate limits, lockout, signed JWTs, no plaintext secrets |
| **External attacker (app)** | Reverse-engineer the app, abuse public APIs | Edge fn auth checks, RLS, rotated HMAC secrets, server-side validation of all inputs |
| **Insider with DB access** | Disable RLS, query freely | Hosted Supabase (limited insider risk); service-role key in Vault only; production access requires owner sign-off |

## 2. Authentication & Session

| Item | Spec |
|---|---|
| Method | Email + password (Supabase Auth) |
| Password hashing | bcrypt cost 10 (Supabase managed) |
| Password rules | ≥10 chars, mixed case + digit, ≠email, not in top-1000 (if enabled) |
| Access token | JWT, 1-hour TTL, in-memory only on client |
| Refresh token | 30-day rolling, in `expo-secure-store` (Android Keystore / iOS Keychain) or Next.js SSR HttpOnly cookies |
| Multi-device | Allowed |
| Force logout | Admin can revoke all refresh tokens |
| Lockout | 5 attempts / email / 15 min; 20 / IP / 1 hour |
| MFA | TOTP **required** for admin; optional for teacher; off for student |
| Password reset | Email magic link OR admin-issued temp password (forces change on next login) |

## 3. Authorization

### 3.1 Role Hierarchy

```
owner_admin ⟶ everything
staff_admin ⟶ everything except admin mgmt, billing, course CRUD, deletions
teacher     ⟶ assigned-batch reads + scoped writes
student     ⟶ self reads + scoped writes (own attendance, attempts, etc.)
```

### 3.2 Row-Level Security (RLS)

Every user-data table has RLS enabled. Direct anon access reads **nothing**. Authenticated users get policies derived from:

- `auth.uid()` → `app_users.id` via helper `current_app_user_id()`
- `user_roles` for role checks
- `batch_teachers` / `students.batch_id` for scoping

Policies tested per table in `apps/functions/_shared/rls.test.ts`.

Privileged writes (attendance mark, exam grade, content promote, etc.) **do not have INSERT/UPDATE policies for authenticated**. They go through edge functions using service-role.

### 3.3 Service-Role Key

- Never on a client.
- Stored only in Supabase env (auto-injected into edge functions).
- Never in git, never in Vercel client env, never in Expo public env.
- Rotated quarterly.

## 4. Edge Function Security

| Control | Spec |
|---|---|
| Auth check | First step of every fn: verify JWT, resolve `app_user`, check role |
| **`is_active` check** | **Mandatory after auth: reject with 401 if `app_users.is_active = false`. Closes the ≤1h leak window between admin `auth-suspend` and JWT expiry.** |
| Input validation | zod schemas; reject early |
| Rate limit | Postgres-backed token bucket per `(user_id, fn_name)` |
| Audit | Side-effectful fns write `audit_log` before returning |
| Idempotency | Where applicable, use a request key or natural unique constraint |
| Errors | Generic messages to client; full stack to Sentry; never leak SQL or internal IDs |

A reference helper in `apps/functions/_shared/auth.ts` performs the full sequence:

```ts
export async function verifyCaller(req: Request): Promise<AppUserContext> {
  const jwt = extractJwt(req);                  // 401 if missing/invalid
  const userId = await resolveAppUserId(jwt);   // 401 if no app_users row
  const user = await getAppUser(userId);
  if (!user.is_active) throw new HttpError(401, 'Account suspended');
  return { userId, roles: user.roles, ip: extractIp(req) };
}
```

Every edge function's first non-import line is `const ctx = await verifyCaller(req);` (unless it's a public endpoint like `health` or `server-time`).

## 5. HMAC Tokens (QR + Playback)

### 5.1 QR token

- Payload: `{ v, sid (session_id), uid (student_id), exp, jti }`
- HMAC-SHA-256 over payload using `QR_TOKEN_SECRET` from Vault.
- TTL 30 seconds.
- Verified server-side; replay protected by `(session_id, student_id)` unique constraint on `attendance`.

### 5.2 Playback token

- Payload: `{ v, kind, video_id, watermark, session_id, exp, sig }`
- HMAC over fields using `PLAYBACK_SIGN_SECRET`.
- TTL 1 hour for live, 4 hours for recordings.
- Verified client-side (public verification key shipped with app) AND server-side on subsequent re-issues.

### 5.3 Secret rotation

- Quarterly rotation via admin action.
- Old secret remains valid for 24h grace window — server tries new then old on verify.

## 6. Storage Security

| Bucket | Privacy | Signed URL TTL | Notes |
|---|---|---|---|
| `profile-pictures` | private | 1h | |
| `study-materials` | private | 1h | |
| `exam-images` | private | 1h | |
| `generated-pdfs` | private | 24h | Parent reports |
| `badge-assets` | private | 24h | Cached on device |

Upload presigning enforced by edge function (size + MIME validation).

Direct uploads via signed PUT to Storage. No server-side proxy upload (saves bandwidth).

## 7. Rate Limiting

Per-user + per-IP token buckets in Postgres (`rate_limits` table). Limits:

| Action | Limit |
|---|---|
| Login attempt | 5 / 15 min / email |
| Password reset request | 3 / 15 min / email; 5 / hour / IP |
| QR sign | 1 / 5s / student |
| QR verify | 2 / s / teacher |
| Quiz submit | 1 / 2s / student |
| Exam submit | 1 / 2s / student |
| WhatsApp send | 100 / min / institute (Gupshup limit) |
| Parent report on-demand | 1 / 30 min / student |
| Admin write actions | 30 / min / admin |

429 returned on breach with `Retry-After` header.

## 8. Audit Log

Every admin write logged. Schema in `backend-architecture.md §3.9`.

Logged fields:
- `actor_user_id`, `actor_role`
- `action` (`create` / `update` / `delete` / `release_results` / `suspend` / etc.)
- `entity_table`, `entity_id`
- `before_data`, `after_data` (JSON)
- `ip_address`, `user_agent`
- `occurred_at`

Retention: 2 years, then anonymize (strip IP/UA, set `actor_user_id = null` for deleted users).

Viewable in admin panel `/audit`.

## 9. CORS & CSRF

- Supabase CORS: explicit allow list (admin app domain + Expo dev URLs). No `*`.
- Mobile is cookieless → no CSRF surface.
- Admin (Next.js) uses Supabase SSR cookies (`SameSite=Lax`, `Secure`, `HttpOnly`) + built-in server-action CSRF.
- Webhook endpoints verify HMAC signature (`X-Gupshup-Signature`).

## 10. Transport Security

- TLS 1.2+ everywhere.
- HSTS on admin domain (1 year, preload).
- Mobile app pinned to Supabase Production certs via `expo-secure-network` (later phase; reduces ATS leakage in proxy MITM).

## 11. Client-Side Hardening

### Mobile
- Detect emulator / rooted device → soft warning (logged to PostHog; not blocking).
- Refresh tokens never leave secure storage.
- WebView for YT player has `javaScriptEnabled = true` but `allowFileAccess = false`, `domStorageEnabled = true` (required for YT iframe), `setSupportZoom = false`.
- Sentry breadcrumbs filtered for PII (no full names in URLs, no phone numbers in events).
- No `console.log` in production builds (stripped by Babel plugin).

### Admin Web
- Content Security Policy:
  - `default-src 'self'`
  - `script-src 'self' 'unsafe-eval' https://*.supabase.co https://*.sentry.io https://*.posthog.com` (`unsafe-eval` required for Next; will revisit)
  - `style-src 'self' 'unsafe-inline'`
  - `img-src 'self' data: blob: https://*.supabase.co`
  - `connect-src 'self' https://*.supabase.co https://*.sentry.io https://*.posthog.com`
  - `frame-ancestors 'none'`
- X-Frame-Options: DENY
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera=(), microphone=(), geolocation=()

## 12. Data Classification

| Class | Examples | Storage | Encryption |
|---|---|---|---|
| Public | course names, subject names, badge icons | Postgres + Storage | At-rest (Supabase managed) |
| Internal | session schedules, batch composition | Postgres | At-rest, RLS-protected |
| Confidential PII | name, email, phone, parent phone, DOB, address | Postgres | At-rest + RLS |
| Highly Confidential | passwords (hashed), TOTP secrets, refresh tokens | Postgres (auth.* + Vault) | bcrypt for passwords, KMS/Vault for secrets |
| Operational secrets | Gupshup key, YT refresh token, HMAC secrets | Supabase Vault | KMS-encrypted |

App-layer encryption on PII is NOT added (over-engineering risk, breaks RLS-by-column-value patterns).

## 13. DPDP Act 2023 Compliance

### 13.1 Consent

- Adult students (≥18): consent captured at login (privacy policy acceptance flow on first launch).
- Minor students (<18): **parent consent** captured by admin at admission, attested by admin user with `parent_consent_at`, `parent_consent_method`, `parent_consent_by` fields on `students` table.

### 13.2 Data Principal Rights

- **Access** — student can view all their stored data via Profile → Data tab.
- **Correction** — student can request via in-app form; admin actions it.
- **Erasure** — student can request via in-app form. Admin sees request, executes "Permanent Delete" → cascading delete + anonymization of aggregates.
- **Portability** — student can export their data as a single JSON file via Profile → Export.

### 13.3 Retention

- Active students: indefinite while enrolled.
- After graduation / withdrawal: 2 years, then anonymize.
- Audit log: 2 years, then anonymize.
- Generated PDFs: 90 days, then delete.

### 13.4 Breach Notification

- Sentry / PostHog alert + admin notification on any access-control failure spike.
- Process: owner notified within 4 hours; user notification within 72 hours; DPDP Board notified per Act.

### 13.5 Cross-Border Transfer

- Default: all data stays in `ap-south-1` (Mumbai).
- Third-party processors used:
  - Supabase (data residency in our region)
  - YouTube (videos — students implicitly consent via terms)
  - Gupshup (India-resident; PII limited to phone + names in templates)
  - Sentry (US-resident; PII scrubbed)
  - PostHog (consider EU-resident project; no PII in events)
  - Vercel (admin assets only, no PII)

A processor list is maintained in `docs/spec/security.md §13.6`.

### 13.6 Processor Registry (To Maintain)

| Processor | Region | Data | Purpose | Contract |
|---|---|---|---|---|
| Supabase | ap-south-1 | All | Database + auth + storage | DPA in place |
| Google (YouTube) | Global | Video content (not PII) | Live + recorded video | Standard YT TOS |
| Gupshup | India | Phone, names, report links | WhatsApp delivery | DPA TBD |
| Sentry | US | Stack traces (PII scrubbed) | Error tracking | DPA in place |
| PostHog | US/EU | Event analytics (no PII) | Product analytics | DPA TBD |
| Vercel | Global | Admin app assets | Hosting | DPA in place |

## 14. PII Handling Specifics

- `auth.users.email` — required for login; full email visible to admins + self.
- `app_users.phone`, `parent_phone_*` — restricted; admin + self read; never logged.
- `app_users.dob` — admin + self read; not displayed in any client UI by default.
- `students.address` — admin only.
- Last-2 phone digits used in leaderboard / chat for disambiguation; rest is masked.
- Watermark uses first name + last-4 phone digits — visible to that student only.

### Sentry scrubbing

`Sentry.beforeSend`:
- Remove keys: `phone`, `parent_phone_1`, `parent_phone_2`, `dob`, `address`, `email` (replaced with `<email:hash>` for diagnosis).
- Strip URL query params containing `email=` / `phone=`.

### Logging

- Server logs (Supabase function logs): never log raw PII. Use IDs.
- Admin panel server actions: log action + entity ID, not values.

## 15. Mobile App Security

- `expo-secure-store` for refresh tokens and any cached credentials.
- `AsyncStorage` only for non-sensitive cache (course IDs, last-seen counters).
- No deep-link parameters carry PII.
- Universal links validated against `assetlinks.json` / `apple-app-site-association`.
- App allowlist domains in NSAppTransportSecurity (iOS) and network_security_config (Android).
- Screenshots in app switcher: blank screen when app is backgrounded if on a sensitive screen (exam attempt, parent report PDF) — using `expo-screen-capture`.

## 16. Backup & Recovery

- Supabase managed daily Postgres backup. 7-day retention on prod.
- Point-in-Time Recovery (PITR) enabled at launch.
- Storage buckets snapshot to a secondary location daily (GH Action triggered).
- Restore drill: quarterly tabletop test.

## 17. Secrets Inventory

| Secret | Location | Rotation |
|---|---|---|
| Supabase anon key | `EXPO_PUBLIC_*` env, public — non-secret in practice | n/a |
| Supabase service-role key | Edge function env only | Quarterly |
| Sentry DSN | App envs (non-secret) | On compromise |
| Sentry auth token (release upload) | EAS + Vercel env | Quarterly |
| YouTube OAuth refresh token | Supabase Vault | On compromise; refresh transparent |
| Gupshup API key | Supabase Vault | Quarterly |
| QR HMAC secret | Supabase Vault | Quarterly |
| Playback HMAC secret | Supabase Vault | Quarterly |
| Parent-report HMAC secret | Supabase Vault | Quarterly |
| PostHog server key | Supabase Vault | Quarterly |
| Gupshup webhook secret | Supabase Vault | Quarterly |

## 18. Incident Response Playbook (Brief)

1. **Detect** — Sentry/PostHog alert, user report, or admin notice.
2. **Contain** — revoke compromised tokens; rotate secret(s); disable affected user(s).
3. **Eradicate** — patch root cause; deploy via emergency channel (EAS Update for mobile; Vercel for admin).
4. **Recover** — restore from backup if needed; confirm via test.
5. **Notify** — owner immediately; users within 72h; DPDP Board if applicable.
6. **Post-mortem** — within 7 days; doc in `docs/incidents/` (folder created on first incident).

## 19. Periodic Reviews

- Monthly: audit log spot-check, rate-limit thresholds vs. actual usage, Sentry top issues.
- Quarterly: secret rotation, backup restore drill, processor registry review, RLS policy audit.
- Annually: full pentest (external if budget allows).

## 20. Open Items

- Pentest plan + budget (post-MVP, before scale).
- Certificate pinning rollout for mobile.
- Tighter CSP — remove `'unsafe-eval'` after Next experiments.
- Move PostHog to EU project if user-base demographics warrant.
- DLP scanning of generated PDFs for accidental over-sharing (e.g., contact details).
