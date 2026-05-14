# Spec: Authentication

Admin-issued credentials. Email + password. No phone OTP. Three role groups (student, teacher, admin) with admin further split into owner/staff.

---

## 1. Goals

- Admin creates every user — no self-signup.
- Students log in with email + password issued by admin.
- Initial password is admin-set or auto-generated and emailed.
- Forced password change on first login.
- Secure session handling: short-lived access JWT, long-lived rotating refresh token in device secure store.
- Admin accounts protected by TOTP MFA.
- Account lockout after repeated failures.
- Suspension flow.

## 2. Non-Goals (MVP)

- Self-signup
- Phone OTP login (the existing OTP UI is replaced)
- Social login
- Parent login
- Biometric login (Face ID, fingerprint) — deferred

## 3. Roles

| Role | Logs in via | MFA | Granted by |
|---|---|---|---|
| `student` | Mobile app | Off | Admin at admission |
| `teacher` | Mobile app | Optional | Admin |
| `staff_admin` | Web panel | TOTP required | Owner admin |
| `owner_admin` | Web panel | TOTP required | Bootstrap script or another owner |

Multiple roles per user are allowed (`user_roles` is many-to-one against `app_users`). Examples:
- `teacher` + `staff_admin` is a common combo.
- Owner is usually `owner_admin` only.

Role-gated UI:
- Mobile app inspects `user_roles` on session resume; routes to `(student)` or `(teacher)` group. If both, shows a one-tap role switcher in the menu.
- Admin panel: middleware blocks non-admin sessions.

## 4. Admission / User Creation Flow

Owner or staff admin uses the web panel:

```
Admin Web Panel → New Student form
  fields: full_name*, email*, phone, parent_phone_1, parent_phone_2,
          dob, gender, batch_id*, school_name, board, current_class,
          address, parent_consent_attestation*

[Submit]
  ↓
POST /functions/v1/auth-bootstrap
  ↓
auth-bootstrap edge fn:
  1. Validate input (zod).
  2. Check email not in use.
  3. Create auth.users row (service-role admin API).
     - Generates a 12-char random password OR uses admin-provided one.
     - Sets must_change_password = true.
  4. Create app_users row with full_name, email, phone, dob, gender.
  5. Create students row (batch_id, parent fields, consent).
  6. Insert user_roles ('student').
  7. Trigger Supabase email: "Welcome to FyneStudy" with initial password.
  8. Write audit_log entry.
  9. Return { user_id, initial_password } to admin so they can also share verbally.
```

Teacher creation: same flow, replace student fields with `teachers` row + `subjects[]`, role `teacher`.

Admin creation: owner-only; role `staff_admin` or `owner_admin`. TOTP enrollment is forced on first login.

## 5. Initial Login Flow (Student)

```
[Login Screen]
  email, password
  [Forgot password?]
       ↓
  supabase.auth.signInWithPassword
       ↓
  401? → "Invalid credentials. Attempts left: N"
       ↓ (success)
  Read app_users.must_change_password
       ↓
  true → Force-Password-Change screen
       ↓
  user picks new password (zod: ≥10 chars, mix req)
       ↓
  supabase.auth.updateUser({ password })
  flip must_change_password = false
       ↓
  Dashboard
```

Password rules:
- Min 10 characters
- At least 1 uppercase, 1 lowercase, 1 digit
- No spaces
- Cannot equal email
- Not in top-1000 common passwords (HIBP API on edge fn `check-password-pwned`, optional MVP)

## 6. Returning Login

```
App launch
  ↓
Read refresh token from expo-secure-store
  ↓
Not found / expired? → Login Screen
Present? → supabase.auth.setSession(refresh_token) → silently refresh
  ↓
Read user_roles, route to role group
```

Session details:
- Access JWT: 1 hour
- Refresh token: 30 days, rotated on every refresh
- App refreshes access token automatically on focus and 5 min before expiry
- Server-side suspension flips `app_users.is_active = false`; next refresh returns 401 → app shows "Account suspended" screen with admin contact

## 7. Password Reset

User taps "Forgot password" on login screen:

```
Email input
  ↓
supabase.auth.resetPasswordForEmail(email, {
  redirectTo: 'fynestudy://reset'
})
  ↓
Email sent with magic link
  ↓
User taps link on phone → deep link opens app /reset?token=...
  ↓
App shows New Password screen → updateUser({ password })
  ↓
Login automatically with new password → Dashboard
```

Rate limits (Supabase native + our enforcement):
- 3 reset requests per email per 15 minutes
- 5 reset requests per IP per hour

Admin-side reset:
- Admin can also "Reset password for student" from the web panel.
- Calls `auth-bootstrap` with `mode = 'reset'` flag.
- Generates a new temp password, sets `must_change_password = true`, emails it.

## 8. Account Lockout

Tracked in Supabase Auth (built-in rate limiter) + supplemented by a `login_attempts` table for finer-grained per-IP tracking.

- 5 failed password attempts on the same email within 15 minutes → email locked for 15 minutes.
- 20 failed attempts from the same IP within 1 hour → IP soft-blocked for 1 hour (server returns 429).
- Lockouts cleared automatically; admin can also clear from web panel.

## 9. Admin MFA (TOTP)

On first admin login after enrollment:

```
[Login] email + password → success
       ↓
  No TOTP enrolled?
       ↓
[2FA Enroll]
   Show QR code (otpauth://) + secret
   User scans with Google Authenticator / Authy
   User enters 6-digit code to confirm
       ↓
   Generate 10 recovery codes → user downloads PDF
   Save TOTP factor via supabase.auth.mfa.enroll
       ↓
[Dashboard]

Subsequent logins:
[Login] email + password → 
[2FA Verify] 6-digit code → 
[Dashboard]
```

Teacher MFA: optional, off by default; admin can toggle on per teacher in web panel.

## 10. Suspension & Termination

Admin clicks "Suspend Student":

```
PUT /functions/v1/auth-suspend { user_id, reason }
  ↓
auth-suspend edge fn:
  1. Verify caller is admin.
  2. Set app_users.is_active = false, suspended_at = now(), suspended_reason.
  3. Revoke all active refresh tokens via Supabase admin API.
  4. Audit log.
  ↓
  Returns success.
  ↓
Affected user's app:
  Next refresh returns 401 → "Account suspended" screen.
```

Reactivation: admin flips `is_active` back; user can log in fresh.

Termination (graduation / withdrawal):
- Soft-delete: set `is_active = false`, set `graduated_at` or `withdrawn_at`.
- Hard-delete (DPDP right-to-be-forgotten request): cascading DELETE via admin web panel "Delete Permanently" button. Removes auth.users row + all FK-cascading data. Aggregated stats (`mastery`, `leaderboard`) are anonymized — student_id replaced with a tombstone.

## 10A. Profile Editability Matrix (D-016, D-017)

Students and teachers **cannot** self-change identity-critical fields. The admin panel is the only path. This is enforced both at the UI level (read-only inputs with "Contact admin to change" hint) and at the RLS level (no UPDATE policy for these columns for non-admin roles).

| Field | Student self-edit | Teacher self-edit | Admin edit |
|---|---|---|---|
| `full_name` | ❌ | ❌ | ✅ |
| `email` | ❌ | ❌ | ✅ |
| `phone` | ❌ | ❌ | ✅ |
| `dob` | ❌ | ❌ | ✅ |
| `gender` | ❌ | ❌ | ✅ |
| `address` | ❌ | ❌ | ✅ |
| `school_name`, `board`, `current_class` | ❌ | n/a | ✅ |
| `parent_phone_1`, `parent_phone_2` | ❌ | n/a | ✅ |
| `batch_id` (and derived `course_id`) | ❌ | n/a | ✅ |
| `subjects[]` (teacher) | n/a | ❌ | ✅ |
| `password` | ✅ | ✅ | ✅ (reset only) |
| `avatar_path` | ✅ | ✅ | ✅ |
| `bio` (teacher) | n/a | ✅ | ✅ |
| MFA enrollment | n/a (off by D-023) | ✅ optional | ✅ required |
| Theme / display preferences | ✅ | ✅ | ✅ |

UI: profile screen renders identity fields as plain text (not inputs), with a small "Need to change something? Contact your admin." note at the bottom. Tap takes them to a pre-filled mailto / WhatsApp link to the institute's contact channel (configured in `institute_config`).

## 11. Force Logout

Useful for: password change everywhere, admin-triggered force-logout.

- Calls Supabase admin API `auth.admin.signOut(user_id)`.
- Revokes all refresh tokens.
- All devices: next refresh fails → login screen.

## 12. Security Considerations

- Passwords hashed by Supabase using bcrypt (cost 10).
- Refresh tokens in `expo-secure-store` (Android Keystore, iOS Keychain). Never in AsyncStorage.
- Access tokens never persisted; only held in memory.
- All auth events (login success, login fail, password change, MFA enroll, suspend) emit audit log entries.
- Email verification not required for admin-issued accounts because admin attests email validity at creation time. However, the welcome email serves as a soft check (if it bounces, admin sees notification).
- CORS: Supabase configured with allowed origins = admin app domain + Expo dev URLs. No `*`.
- CSRF: not applicable for mobile (no cookies). Admin panel uses Supabase SSR cookies with SameSite=Lax and CSRF tokens on mutating actions.

## 13. UI / Screens

| Screen | Path | Trigger |
|---|---|---|
| Login | `app/login.tsx` | Default unauthenticated route |
| Force password change | `app/force-password-change.tsx` | After login if `must_change_password` |
| Forgot password | `app/forgot-password.tsx` | Login screen link |
| Reset password (from deep link) | `app/reset.tsx` | Deep link from email |
| Account suspended | `app/suspended.tsx` | On 401 after refresh w/ suspension reason |
| Admin login | `apps/admin/app/login` | Admin panel default |
| Admin 2FA enroll | `apps/admin/app/2fa/enroll` | First admin login |
| Admin 2FA verify | `apps/admin/app/2fa/verify` | Every admin login post-enrollment |

## 14. Data Model Touchpoints

- `auth.users` — Supabase managed.
- `public.app_users` — domain mirror, `must_change_password` flag.
- `public.user_roles` — role grants.
- `public.students` / `public.teachers` — role-specific profile.
- `public.login_attempts` (optional) — per-IP rate tracking.
- `public.audit_log` — every auth-relevant action.

## 15. Edge Function Map

| Function | Caller | Purpose |
|---|---|---|
| `auth-bootstrap` | Admin web | Create user + profile + role + email creds |
| `auth-suspend` | Admin web | Suspend / unsuspend |
| `auth-force-reset` | Admin web | Issue new temp password |

## 16. Testing

- Unit: zod validators for email + password rules.
- Integration: full flow via Supabase test client — create student via `auth-bootstrap`, sign in, force change, sign in again with new pass.
- Manual (recurring): admin creates a student, verifies email received with creds, student logs in from a clean device.

## 17. Open Items / Followups

- HIBP "have I been pwned" password check — implement if cheap, defer if not.
- Biometric login on returning sessions — phase 2 nice-to-have.
- Magic-link-only login as an option for low-tech students — evaluate after demo.
