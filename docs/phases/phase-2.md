# Phase 2 — Identity & Authentication

> Email + password auth via Supabase. Admin issues every account. Forced first-login password change. Role-gated routes. Existing OTP and course-selection screens deleted. By the end of this phase, an admin creates a student in the admin panel, the student logs in on the mobile app, and lands on the dashboard (which is still mostly placeholder).

---

## 1. Goal

Wire authentication end-to-end and lock the role boundaries before any other feature touches data. Auth is the foundation every later RLS policy assumes.

## 2. Prerequisites

- [ ] Phase 1 accepted.
- [ ] You have admin email address(es) ready. Owner admin is created via a one-time bootstrap script (no auth-bootstrap fn yet at first run).
- [ ] Supabase dev project email service enabled (default Supabase SMTP is fine for dev; production SMTP in Phase 12).
- [ ] Decide on owner's TOTP authenticator (Google Authenticator / Authy / 1Password).

## 3. Scope

### In

- DB tables: `app_users`, `user_roles`, `students`, `teachers` (only identity-related columns — batch/course wiring is Phase 3 stub-only here).
- Helper SQL functions: `current_app_user_id()`, `has_role(text)`, `is_admin()`.
- RLS baseline on the four tables.
- Edge functions: `auth-bootstrap`, `auth-suspend`, `auth-force-reset`.
- Mobile: replace OTP / course-select screens with email-password login + force-password-change + forgot-password. Reorganize `(tabs)` → `(student)`, scaffold `(teacher)`.
- Mobile: lib/auth (useSession, useRole, useUser).
- Admin: `/login`, `/2fa/enroll`, `/2fa/verify`, middleware (auth gate + role gate + 2FA enforcement), `/students` list, `/students/new`, `/students/[id]` (basic).
- Owner-bootstrap script (one-time, idempotent).
- Audit log skeleton table + `withAudit` wrapper in admin.
- E2E manual flow: admin creates student → student logs in mobile → forced PW change → dashboard.

### Out

- Profile editing of identity fields (D-016 — not in scope; UI shows read-only).
- Batch / course association (Phase 3).
- Attendance, library, quizzes, exams (later phases).
- Password recovery flows beyond email magic link (no SMS OTP recovery).
- Bulk student import (Phase 11).
- Full admin pages beyond `/students`.

## 4. Specs in play

- `docs/spec/authentication.md` — primary.
- `docs/spec/admin-panel.md §4, §7` — admin auth + students page.
- `docs/spec/security.md §2, §3, §4` — auth + authorization + edge fn security.
- `docs/backend-architecture.md §3.1, §5` — identity schema + RLS.
- `docs/decisions.md` D-001 to D-005, D-016, D-017, D-020 to D-027.

## 5. Backend work

### 5.1 Migration: identity (Checkpoint 1)

`supabase/migrations/0001_init_users_roles.sql`:

```sql
create extension if not exists pgcrypto;

create table public.app_users (
  id                   uuid primary key default gen_random_uuid(),
  auth_user_id         uuid not null unique references auth.users(id) on delete cascade,
  full_name            text not null,
  email                text not null unique,
  phone                text,
  dob                  date,
  gender               text check (gender in ('male','female','other','prefer_not')),
  avatar_path          text,
  is_active            boolean not null default true,
  suspended_at         timestamptz,
  suspended_reason     text,
  must_change_password boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.user_roles (
  user_id    uuid not null references public.app_users(id) on delete cascade,
  role       text not null check (role in ('student','teacher','staff_admin','owner_admin')),
  granted_at timestamptz not null default now(),
  granted_by uuid references public.app_users(id),
  primary key (user_id, role)
);

create table public.students (
  user_id                uuid primary key references public.app_users(id) on delete cascade,
  batch_id               uuid,                                          -- FK added in Phase 3
  enrollment_no          text unique,
  school_name            text,
  board                  text,
  current_class          text,
  address                text,
  parent_phone_1         text,
  parent_phone_2         text,
  parent_consent_at      timestamptz,
  parent_consent_method  text,
  parent_consent_by      uuid references public.app_users(id),
  joined_at              timestamptz not null default now(),
  graduated_at           timestamptz
);

create table public.teachers (
  user_id  uuid primary key references public.app_users(id) on delete cascade,
  subjects text[] default array[]::text[],
  bio      text
);

-- updated_at trigger
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger app_users_set_updated_at
  before update on public.app_users
  for each row execute function public.set_updated_at();
```

### 5.2 Migration: helpers + RLS (Checkpoint 2)

`supabase/migrations/0002_auth_helpers_rls.sql`:

```sql
create or replace function public.current_app_user_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.app_users where auth_user_id = auth.uid();
$$;

create or replace function public.has_role(r text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = public.current_app_user_id() and role = r
  );
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role('owner_admin') or public.has_role('staff_admin');
$$;

alter table public.app_users enable row level security;
alter table public.user_roles enable row level security;
alter table public.students enable row level security;
alter table public.teachers enable row level security;

-- app_users: self read; admin all.
create policy app_users_self_read on public.app_users for select to authenticated
  using (auth_user_id = auth.uid());
create policy app_users_admin_all on public.app_users for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- user_roles: self read; admin all.
create policy user_roles_self_read on public.user_roles for select to authenticated
  using (user_id = public.current_app_user_id());
create policy user_roles_admin_all on public.user_roles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- students: self read; admin all. (Teacher batch-scope policy added in Phase 3 when batch_teachers exists.)
create policy students_self_read on public.students for select to authenticated
  using (user_id = public.current_app_user_id());
create policy students_admin_all on public.students for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- teachers: self read; admin all.
create policy teachers_self_read on public.teachers for select to authenticated
  using (user_id = public.current_app_user_id());
create policy teachers_admin_all on public.teachers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Mutating from app code requires admin role. Privileged writes happen via edge fns.
```

**STOP. Checkpoint 2.** Verify via `supabase db push --linked`; check tables and policies in Supabase dashboard.

### 5.3 Migration: audit log skeleton (Checkpoint 3)

`supabase/migrations/0003_audit_log.sql`:

```sql
create table public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.app_users(id),
  actor_role    text,
  action        text not null,
  entity_table  text not null,
  entity_id     text,
  before_data   jsonb,
  after_data    jsonb,
  ip_address    inet,
  user_agent    text,
  occurred_at   timestamptz not null default now()
);

create index audit_log_occurred_at_idx on public.audit_log (occurred_at desc);
create index audit_log_entity_idx on public.audit_log (entity_table, entity_id);

alter table public.audit_log enable row level security;
create policy audit_log_admin_read on public.audit_log for select to authenticated
  using (public.is_admin());
-- No insert/update/delete policies → writes only via service-role (edge fns).
```

### 5.4 Bootstrap script for first owner-admin (Checkpoint 4)

`scripts/bootstrap-owner.ts` — a one-time idempotent Node script run with `tsx` + service-role key. It:

1. Reads `OWNER_EMAIL`, `OWNER_INITIAL_PASSWORD`, `OWNER_FULL_NAME` from env.
2. Creates the `auth.users` row via Supabase admin API.
3. Inserts `app_users` row.
4. Inserts `user_roles` rows: `owner_admin`.
5. Idempotent: if email already exists, exits with a friendly message.

You run this **once** locally:
```bash
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… OWNER_EMAIL=you@x.com OWNER_INITIAL_PASSWORD=temp pnpm tsx scripts/bootstrap-owner.ts
```

After running, the owner can log into the admin panel. From then on, **never** run this script again — all subsequent admins are created via the admin UI.

**STOP. Checkpoint 4.** Verify: owner admin row exists; manual login attempt (next checkpoint) succeeds.

### 5.5 Edge fn: auth-bootstrap (Checkpoint 5)

`apps/functions/auth-bootstrap/index.ts`:

Input zod schema:
```ts
{
  full_name: string (1..100),
  email: string (email format),
  phone: string optional (E.164),
  role: 'student' | 'teacher' | 'staff_admin' | 'owner_admin',
  // student-only:
  dob?: ISO date, gender?: enum, parent_phone_1?: string, parent_phone_2?: string,
  school_name?: string, board?: string, current_class?: string,
  parent_consent_method?: 'verbal'|'written'|'form',
  // teacher-only:
  subjects?: string[], bio?: string,
}
```

Steps (server-side):
1. Verify caller's JWT and role. Only `owner_admin` can create another admin; `staff_admin` and `owner_admin` can create teachers and students.
2. Generate a 14-char random password (alphanumeric + 2 special chars).
3. Call `auth.admin.createUser({ email, password, email_confirm: true })`.
4. Insert `app_users` row with `must_change_password = true`.
5. Insert `user_roles` row.
6. Insert role-specific extension (`students` or `teachers`).
7. Insert `audit_log` row with `action='create_user'`, `before_data=null`, `after_data={...}`.
8. Email the credentials via Supabase Auth's built-in email or a separate template (in dev: return them in the response so admin can copy).
9. Return `{ user_id, email, initial_password }` (initial password only returned in dev; in prod, only sent via email).

Error mapping:
- Email already exists → 409.
- Validation failure → 400 with field list.
- Caller not authorized → 403.

`auth-suspend` and `auth-force-reset` are similar — verify admin caller, flip `is_active` / generate new temp password.

### 5.6 Admin: login + 2FA + middleware (Checkpoint 6)

`apps/admin/middleware.ts`:
- Reads Supabase session via `@supabase/ssr` cookie helpers.
- If no session and path is not `/login` / `/2fa/*` → redirect to `/login`.
- If session exists but no admin role → render `403`.
- If session has admin role but MFA not yet completed → redirect to `/2fa/verify` (or `/2fa/enroll` if no factor).
- Owner-only paths (`/admins`, `/settings`, `/courses/*` create/edit) → check `owner_admin` role; otherwise 403.

`apps/admin/app/login/page.tsx`:
- Email + password form (zod + react-hook-form).
- On submit: `supabase.auth.signInWithPassword`. On success, push to `/2fa/verify`.

`apps/admin/app/2fa/enroll/page.tsx`:
- Calls `supabase.auth.mfa.enroll({ factorType: 'totp' })`.
- Renders QR code (`react-qr-code`) + secret.
- User enters 6-digit code → `supabase.auth.mfa.challengeAndVerify`.
- On success, generate + display 10 recovery codes (stored in `mfa_recovery_codes` table — added in Phase 12; for now, just shown once and user is told to save them).
- Redirect to `/`.

`apps/admin/app/2fa/verify/page.tsx`:
- Reads factor id from session.
- Prompts 6-digit code → verify → redirect to original destination.

`apps/admin/lib/audit.ts`:

```ts
export async function withAudit<T>(meta: AuditMeta, fn: () => Promise<{ data: T; error: any }>) {
  const before = meta.entityId ? await fetchEntityForAudit(meta.entityTable, meta.entityId) : null;
  const result = await fn();
  if (!result.error) {
    await writeAuditLog({ ...meta, before_data: before, after_data: result.data });
  }
  return result;
}
```

(Implementation reads the row before mutating to capture `before_data`; complex updates pass `before` explicitly.)

### 5.7 Admin: students list + create (Checkpoint 7)

`apps/admin/app/(dashboard)/layout.tsx`:
- Sidebar with: Overview, Students, Teachers, Admins (owner-only), Batches, Courses, … (placeholder links for unbuilt pages).

`apps/admin/app/(dashboard)/page.tsx`:
- Overview: simple counts ("594 students" — placeholder until Phase 3 has data).

`apps/admin/app/(dashboard)/students/page.tsx`:
- DataTable querying `app_users` join `user_roles` where role='student'.
- Columns: name, email, phone, status, created.
- Filters: status, search.
- "+ New Student" button → `/students/new`.

`apps/admin/app/(dashboard)/students/new/page.tsx`:
- Multi-section form: Identity → Contact → Parent Consent (batch picker hidden / disabled until Phase 3).
- On submit → calls `auth-bootstrap` edge fn → on success, shows modal with email + initial password ("Copy to clipboard" button) + instruction to share with the student.

`apps/admin/app/(dashboard)/students/[id]/page.tsx`:
- Profile header + tabs (Identity, Activity, Audit — Activity is empty for now; Audit shows audit_log filtered by this user).
- Actions: Edit (only identity fields for now), Suspend, Reset password.

**STOP. Checkpoint 7.** Verify: log into admin → create a student → modal shows credentials.

### 5.8 Mobile rewrites (Checkpoint 8)

Delete:
- `apps/mobile/app/index.tsx` (old OTP login)
- `apps/mobile/app/verify.tsx` (old OTP verify)
- `apps/mobile/app/select-course.tsx` (course selection is admin-only now per D-143)

Rename:
- `apps/mobile/app/(tabs)/` → `apps/mobile/app/(student)/`
- Inside the renamed folder, rename `check-in.tsx` → `attendance.tsx` (Phase 4 rebuilds it; for Phase 2 it stays static).

Create stub:
- `apps/mobile/app/(teacher)/_layout.tsx` — tab bar with placeholder tabs (Home, Scan, Classes, Library, Batch, Profile). Each route is an empty screen with "Coming in Phase X".

Create new auth screens:

`apps/mobile/app/index.tsx` (new — splash + role router):
```tsx
- On mount: read session via supabase.auth.getSession().
- If no session → router.replace('/login')
- If session.must_change_password === true → /force-password-change
- If session has role='student' → /(student)
- If session has role='teacher' → /(teacher)
- If session has BOTH student + teacher (multi-role) → role chooser (one-time per session)
- If session has any admin role → show "Please use the admin web panel" with a link.
```

`apps/mobile/app/login.tsx`:
- Email + password form.
- "Forgot password?" link → `/forgot-password`.
- On submit → `supabase.auth.signInWithPassword`. Friendly error states.
- After success → checks `must_change_password` flag (from a query on `app_users`) → routes accordingly.

`apps/mobile/app/forgot-password.tsx`:
- Email input.
- Calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: 'fynestudy://reset' })`.
- Shows confirmation message.

`apps/mobile/app/force-password-change.tsx`:
- Password + confirm fields with zod rules (≥10, mixed, ≠email).
- Calls `supabase.auth.updateUser({ password })`.
- Calls an edge fn `auth-clear-must-change` (or directly updates `app_users.must_change_password = false` via admin policy if RLS allows — simpler to do via edge fn for audit).
- Routes to dashboard.

`apps/mobile/app/reset.tsx`:
- Deep link handler. On open with `?token=...`, prompts new password.

`apps/mobile/app/suspended.tsx`:
- Shown when refresh returns 401 due to `is_active = false`. Read-only message + admin contact.

`apps/mobile/features/auth/useSession.ts`:
- Hook around supabase auth listener.
- Returns `{ session, user, role, isLoading }`.

`apps/mobile/features/auth/useRole.ts`:
- Reads user_roles for current user; memoized.

Update `apps/mobile/app/_layout.tsx`:
- Wraps children in `<SupabaseProvider>` and `<RoleGate>`.
- Sets up Sentry user context (without PII).

**STOP. Checkpoint 8.** Verify the full E2E flow: admin creates student → student logs in mobile → forced PW change → lands on dashboard placeholder.

### 5.9 RLS tests (Checkpoint 9)

`supabase/tests/rls/` (using `pgtap` or a custom Deno test runner):

- Test 1: student A cannot read student B's `app_users` row.
- Test 2: teacher cannot yet read any student (batch_teachers not wired — should return empty).
- Test 3: admin can read all students.
- Test 4: unauthenticated reads return empty.
- Test 5: student cannot UPDATE their own `batch_id` (D-016).
- Test 6: student cannot INSERT into `audit_log`.

Add `pnpm test:rls` script that boots a local Supabase instance and runs these.

**STOP. Checkpoint 9.** Verify all RLS tests green.

## 6. Frontend work — summary

### Mobile — files added
- `apps/mobile/app/index.tsx` (new splash/router — replaces old OTP)
- `apps/mobile/app/login.tsx`
- `apps/mobile/app/forgot-password.tsx`
- `apps/mobile/app/force-password-change.tsx`
- `apps/mobile/app/reset.tsx`
- `apps/mobile/app/suspended.tsx`
- `apps/mobile/app/(teacher)/_layout.tsx` (stub)
- `apps/mobile/app/(teacher)/index.tsx`, `scan.tsx`, `classes.tsx`, `content.tsx`, `batch/[id].tsx` (all "Coming soon" stubs)
- `apps/mobile/features/auth/useSession.ts`
- `apps/mobile/features/auth/useRole.ts`
- `apps/mobile/features/auth/loginMutation.ts`

### Mobile — files renamed
- `apps/mobile/app/(tabs)/` → `apps/mobile/app/(student)/`
- `apps/mobile/app/(student)/check-in.tsx` → `apps/mobile/app/(student)/attendance.tsx` (still static; Phase 4 wires it)

### Mobile — files deleted
- `apps/mobile/app/verify.tsx` (old OTP verify)
- `apps/mobile/app/select-course.tsx` (per D-143)
- The Phase 1 debug "Send test error" button on splash

### Mobile — files edited
- `apps/mobile/app/_layout.tsx` — wraps in auth provider, role gate, Sentry user context
- `apps/mobile/app/(student)/_layout.tsx` — role gate at layout level
- `apps/mobile/app/(student)/profile.tsx` — render identity fields read-only with "Contact admin" CTA (D-016)

### Admin — pages added
- `apps/admin/middleware.ts`
- `apps/admin/app/login/page.tsx`
- `apps/admin/app/2fa/enroll/page.tsx`
- `apps/admin/app/2fa/verify/page.tsx`
- `apps/admin/app/(dashboard)/layout.tsx` (sidebar)
- `apps/admin/app/(dashboard)/page.tsx` (overview placeholder)
- `apps/admin/app/(dashboard)/students/page.tsx`
- `apps/admin/app/(dashboard)/students/new/page.tsx`
- `apps/admin/app/(dashboard)/students/[id]/page.tsx`
- `apps/admin/lib/auth.ts`
- `apps/admin/lib/audit.ts`

### Shared packages
- `packages/shared/src/validation/authSchemas.ts` (zod schemas reused by admin form + edge fn)
- `packages/shared/src/enums/roles.ts`

### Edge functions
- `apps/functions/auth-bootstrap/index.ts`
- `apps/functions/auth-suspend/index.ts`
- `apps/functions/auth-force-reset/index.ts`
- `apps/functions/auth-clear-must-change/index.ts`

## 7. Integration & cross-cutting

- Audit log entries: `create_user`, `suspend_user`, `unsuspend_user`, `force_reset_password`, `password_changed`, `login_success`, `login_failed`.
- Telemetry: `auth_login_success`, `auth_login_failed`, `auth_forced_pw_change`, `auth_2fa_enrolled`, `auth_2fa_verified`.
- Sentry: set user context on session (id, role); strip email/phone.
- Email templates: Supabase Auth → customize the "Welcome" and "Reset password" templates with FyneStudy branding (logo placeholder OK).

## 8. Risks & gotchas

| Risk | Mitigation |
|---|---|
| Owner-bootstrap script accidentally re-run, creating duplicate role rows | Idempotent on email lookup; ON CONFLICT DO NOTHING for role insert. |
| RLS recursion if helper fn doesn't have stable security definer | Functions marked `STABLE SECURITY DEFINER SET search_path = public`. |
| `must_change_password` race: user changes password, the flag is still set, app loops | Flip the flag inside the same edge fn that updates the password, then return; client reloads session. |
| Refresh tokens leaking to AsyncStorage if `expo-secure-store` plugin not in app.json | Verified at end of Phase 1; double-check after rebuilding for Phase 2. |
| Deep link `fynestudy://reset` not configured | Confirm `scheme` in app.json + iOS associated domains + Android intent filter; test on real device. |
| 2FA enrollment locks owner out if they lose recovery codes | Document the 10 recovery codes prominently; in Phase 12 we add an "Admin: reset MFA" owner-only flow with audit. |
| Existing screens crash after renaming `(tabs)` → `(student)` | All Expo Router links use file paths; verify by `pnpm typecheck` + manual walk-through. |

## 9. Acceptance criteria

1. Owner-bootstrap script creates the first owner; second run says "Already exists" and exits 0.
2. Owner logs into admin at Vercel preview URL with email + password.
3. Owner is forced to enroll TOTP on first login. Recovery codes displayed once.
4. Owner logs out, logs back in, prompted for TOTP, succeeds.
5. Owner creates a test student via `/students/new`. Modal shows credentials.
6. Owner can see student in `/students` list with status "Active".
7. Student opens mobile app → login screen.
8. Student logs in with admin-issued creds → forced password change screen.
9. Student picks a new password (≥10 chars, mixed) → lands on `(student)` dashboard (placeholder content).
10. Student profile shows their name, email (read-only), phone (read-only), DOB (read-only), with "Contact admin to change" CTA.
11. Student cannot navigate to `(teacher)/*` (RouteGuard kicks in).
12. Owner suspends student → on student's next refresh (kill + reopen), suspended screen shows.
13. Owner unsuspends → student logs in normally.
14. Owner force-resets student password → student gets new temp password → must change again on next login.
15. Audit log shows: create_user, suspend, unsuspend, force_reset for each action.
16. All RLS tests pass (`pnpm test:rls`).
17. OTP screens and `select-course.tsx` are gone (grep finds nothing).
18. `(tabs)` folder is renamed to `(student)`; no broken imports (`pnpm typecheck` green).
19. Cold app start still under 3s on Redmi 8A reference.
20. CI green on phase branch.

## 10. Test plan

### Unit tests
- `packages/shared/src/validation/authSchemas.test.ts` — email format, password rules, edge cases (whitespace, common passwords).
- `apps/admin/lib/audit.test.ts` — `withAudit` captures before/after correctly.

### Integration tests
- `apps/functions/auth-bootstrap/test.ts` — happy path, duplicate email, validation failure, unauthorized caller.
- `apps/functions/auth-suspend/test.ts` — admin can suspend; non-admin gets 403.

### RLS tests
- `supabase/tests/rls/users.test.sql` — 6 tests above.

### Manual QA
- Two devices (Android + iOS): full flow.
- 5 failed login attempts → lockout message; wait 15 min → unlock.
- Background app during forced password change → return → state preserved.
- Deep-link reset flow on a real device (iOS Universal Link + Android intent).

### Cross-platform
- Android: SecureStore reads/writes correctly; survives app re-install? (Should NOT — by design.)
- iOS: Keychain integration verified via reinstall.

## 11. Rollback plan

If Phase 2 breaks login or RLS:
1. Revert migrations: `supabase migration down` to Phase 1 state.
2. Revert mobile commits.
3. Owner can still log into Supabase dashboard directly to manipulate data while fixing.
4. Existing Phase 1 splash + connectivity check remains functional.

## 12. Definition of done

- [ ] All 20 Acceptance Criteria pass.
- [ ] RLS test suite green.
- [ ] CI green on `main`.
- [ ] Schema doc updated if drift from `backend-architecture.md §3.1`.
- [ ] `docs/decisions.md` updated for any new decision.
- [ ] User says "Phase 2 accepted".

## 13. Hand-off to Phase 3

Phase 3 picks up with:
- Identity layer live; admin can create users with no batch/course (placeholder).
- `students.batch_id` column exists but is nullable and unconstrained.
- Phase 3 adds the course/batch/curriculum tables, makes `batch_id` NOT NULL via migration with a default first batch, and adds the teacher batch-scope RLS policy.

## 14. Acceptance Ledger — closed 2026-05-15

Phase 2 closed on **2026-05-15** with all checkpoints (CP1–CP9) verified mechanically and manually. Work sits on `main` uncommitted, ready for the Phase 2 PR.

### AC results

| # | Acceptance Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Owner-bootstrap script creates the first owner; second run says "Already exists" and exits 0 | ✅ pass | CP4. `scripts/bootstrap-owner.ts` is idempotent (lookup by email). Demo owner `owner@fynestudy.example.com` (app_users.id `12159494…`) created 2026-05-14. |
| 2 | Owner logs into admin at Vercel preview URL with email + password | ✅ pass | CP6. <https://admin-kohl-sigma.vercel.app/login>; user verified visually. |
| 3 | Owner is forced to enroll TOTP on first login. Recovery codes displayed once | 🟡 **partial** | TOTP enrollment IS enforced via middleware → `/2fa/enroll` redirect on first login. **Recovery codes were not implemented** — Supabase TOTP doesn't generate them by default and we deferred a custom implementation. Owner is instructed to keep their authenticator app intact; a future "Admin: reset MFA" owner-only flow (per phase-2.md §8) will provide the recovery path. |
| 4 | Owner logs out, logs back in, prompted for TOTP, succeeds | ✅ pass | CP6 user verification on 2026-05-15. |
| 5 | Owner creates a test student via `/students/new`. Modal shows credentials | ✅ pass | CP7 + manually re-verified during CP8 Part C (created `manualtest-may15@…`). |
| 6 | Owner can see student in `/students` list with status "Active" | ✅ pass | CP7. FK-hint embed (`user_roles!user_id!inner(role)`) drives the list. |
| 7 | Student opens mobile app → login screen | ✅ pass | CP8. Splash router (`app/index.tsx`) routes to `/login` when no session. |
| 8 | Student logs in with admin-issued creds → forced password change screen | ✅ pass | CP8 Part C verified. Splash router checks `app_users.must_change_password`. |
| 9 | Student picks a new password (≥10 chars, mixed) → lands on `(student)` dashboard | ✅ pass | CP8 Part C (after the timeout hotfix, D-148). Validation covered by 13 jest tests in `features/auth/schemas.test.ts`. |
| 10 | Student profile shows name, email, phone, DOB read-only with "Contact admin" CTA | 🟡 **partial** | Read-only + "Contact admin" pattern is in place. Currently displays name + email + a phone row showing `—` (placeholder); DOB row not yet rendered because `SessionProvider` doesn't load the `students` extension table. The spirit (D-016 immutability) holds; the data surface is a Phase 3 enhancement once batch/course UI ships. |
| 11 | Student cannot navigate to `(teacher)/*` (RouteGuard kicks in) | ✅ pass | `TeacherGate` in `app/(teacher)/_layout.tsx` redirects non-teachers to `/` on every mount. Mirror `StudentGate` for the reverse. |
| 12 | Owner suspends student → next refresh, suspended screen shows | ✅ pass | `pnpm smoke:cp8` Step 10-12 proves it at the data layer (suspended-student JWT still reads own row, sees `is_active=false` → splash routes to `/suspended`). User verified manually in Part D. |
| 13 | Owner unsuspends → student logs in normally | ✅ pass | `pnpm smoke:cp8` Step 13-14 + user Part D. |
| 14 | Owner force-resets student password → student must change again | ✅ pass | `pnpm smoke:cp5` Steps 8-11 cover the full cycle: force-reset → new temp pw → student sign-in → `must_change_password` reasserted. |
| 15 | Audit log shows: create_user, suspend, unsuspend, force_reset, password_changed for each action | ✅ pass | `pnpm smoke:cp5` Step 12 + `pnpm smoke:cp8` Step 16. All five action shapes verified end-to-end. |
| 16 | All RLS tests pass (`pnpm test:rls`) | ✅ pass | CP9. 6/6 from spec §5.9 + 2 sanity sub-tests pass against live dev project. `scripts/test-rls.ts`. |
| 17 | OTP screens and `select-course.tsx` are gone (grep finds nothing) | ✅ pass | `apps/mobile/app/verify.tsx` and `apps/mobile/app/select-course.tsx` deleted. The only remaining "OTP" matches are in `apps/admin/app/2fa/enroll/` (the admin TOTP flow — different feature). |
| 18 | `(tabs)` folder renamed to `(student)`; no broken imports (`pnpm typecheck` green) | ✅ pass | `pnpm -r typecheck` clean across all 6 workspaces. `(student)` + `(teacher)` tab groups in place. |
| 19 | Cold app start still under 3s on Redmi 8A reference | ⛔ **deferred** | User does not own a Redmi 8A reference device. Cold-start sub-3s validated only on iPhone via Expo Go (subjectively well under 1s). Re-test when first Android dev build installs. |
| 20 | CI green on phase branch | ⏳ **pending PR** | All workspace gates (`typecheck`, `lint`, `test`) pass locally. CI run lands when the user opens the Phase 2 PR. |

**Mechanical proof corpus:**
- `pnpm -r typecheck` — 6/6 workspaces clean.
- `pnpm --filter @fynestudy/mobile lint` — 0 errors, 0 warnings.
- `pnpm --filter @fynestudy/mobile test` — 4 suites, 41 tests, all green.
- `pnpm smoke:cp5` — 12 steps, all PASS (CP5 edge functions end-to-end).
- `pnpm smoke:cp8` — 16 steps, all PASS (mobile auth flow against live Supabase).
- `pnpm test:rls` — 6/6 RLS scenarios + 2 sanity sub-tests, all PASS.

### Definition-of-done results

- [x] AC results recorded above.
- [x] RLS test suite green (`pnpm test:rls`, CP9).
- [ ] **Pending PR:** CI green on `main` — local gates clean; PR run is the final gate.
- [ ] **Pending PR:** `docs/backend-architecture.md §3.1` updated to reflect actual schema (private schema for RLS helpers, `audit_log` table, `students.batch_id` nullable, etc.). Tracked as a small doc-drift sweep; spec body still describes Phase 2's intent correctly, the drift is in the table/policy SQL examples.
- [x] `docs/decisions.md` updated — new D-146, D-147, D-148, D-149 capturing private-schema helpers, single `auth-suspend` fn, mobile `withTimeout`, and the no-enumeration forgot-password contract.
- [ ] User says "Phase 2 accepted" — pending this review.

### Deliberate deviations from the original Phase 2 doc

Recorded here so future contributors don't think these were accidents.

1. **RLS helper functions in `private` schema, not `public`** — driven by Supabase advisor lints 0028/0029 which flag `SECURITY DEFINER` functions in `public` (they get auto-exposed as PostgREST RPC). See D-146. The harden migration `20260514222506_harden_auth_helper_schema.sql` moves them and grants `USAGE`/`EXECUTE` only to `authenticated`.
2. **`auth-suspend` is one edge fn with a `mode` field** instead of separate `auth-suspend` and `auth-unsuspend` functions. See D-147.
3. **Mobile auth calls wrap with `withTimeout` (15s)** — the doc didn't anticipate that RN fetch + supabase-js have no native timeout, and a dropped response strands the UI forever. Discovered during CP8 manual verification when the user's "Saving…" button hung after a successful server-side password update. See D-148 and `apps/mobile/features/auth/network-errors.ts`.
4. **Forgot-password flow always reports success** (no email-enumeration disclosure; also handles Supabase's built-in rejection of `.example.com` test addresses). See D-149.
5. **RLS tests via TypeScript runner against the live dev project**, not pgtap / local Supabase. `scripts/test-rls.ts` signs in as real users and exercises the full PostgREST + JWT + RLS pipeline — same pattern as the CP5/CP8 smoke tests. This is a stronger test surface (it catches PostgREST helper bugs that SQL-level pgtap misses) and avoids a separate `supabase start` infra dependency that doesn't run on the user's Windows + OneDrive setup.
6. **CP5 / CP8 smoke tests are TS scripts at `scripts/`** rather than Deno tests inside `apps/functions/*/test.ts`. Same TS toolchain as the rest of the repo, easier to run on Windows.
7. **Live-flow tests use the dev project** (`orqwyazvcthgxoadfxfv`) and leave timestamped fixture rows behind. Cleanup is deferred to a future sweep job; in the meantime each run is idempotent.
8. **Mobile lint: pre-existing Phase 0 scaffolding warnings cleaned proactively** (`(student)/classes.tsx` unused `User` import, `(student)/menu.tsx` `useEffect` deps comment) so `pnpm lint` is 0/0 instead of 0/2.
9. **`auth-clear-must-change` is called on BOTH force-password-change and the email-reset path**, not only force-password-change. The doc described force-change only, but a user who hit the email-reset deep link while `must_change_password=true` would otherwise be bounced back to `/force-password-change` after just resetting. The edge fn is idempotent so this is safe; see `clearMustChange()` in `apps/mobile/features/auth/auth.ts`.
10. **A "no usable role" trapdoor on the splash router** routes signed-in users with empty `roles[]` to `/admin-redirect` (which has a Sign Out CTA), preventing the bounce-loop a misconfigured account would otherwise hit.
11. **Splash router 10s timeout on `isLoading`** — if the session-load network call hangs at cold start, the router proceeds with whatever state is available rather than showing the spinner indefinitely.

### Carry-overs into Phase 3

> **Status (2026-05-15, Phase 3 closed):** three of the five items below were fully resolved in Phase 3. The remaining two (Android cold-start, Sentry+PostHog) have been re-carried into Phase 4's hand-off.

- ✅ **Resolved in Phase 3 CP11.** TOTP **recovery codes** (AC #3) — new `mfa_recovery_codes` table + `mfa-codes-issue` + `mfa-codes-consume` edge fns + admin `/2fa/enroll` codes display + `/2fa/recovery` page. SHA-256-hashed 10-code batch per enrolment; consume = wipe TOTP factor + force re-enrol. See [`phase-3.md §14 C-1`](phase-3.md#14-acceptance-ledger--closed-2026-05-15) and decision **D-155**. The "Admin: reset MFA on another admin" UI from phase-2 §8 was deferred to Phase 12 (depends on admin-management page) — the recovery-code self-service path covers the dominant case.
- ✅ **Resolved in Phase 3 CP9.** Profile **phone + DOB display** (AC #10) — `SessionProvider` now loads phone + dob columns on `app_users`; `(student)/profile.tsx` shows them with lock icons + "Contact admin" CTA. See [`phase-3.md §14 AC #9`](phase-3.md#14-acceptance-ledger--closed-2026-05-15).
- ✅ **Resolved in Phase 3 CP11.** `docs/backend-architecture.md §3.1` **schema drift sweep** — status note rewritten with full 10-migration ledger, §3.1 fixed (`teachers.subjects` default + new CP10 `app_users_teacher_batch_read` policy callout), §3.9 action vocabulary listed, new §3.10 block for `mfa_recovery_codes`.
- ⏳ **Re-carried into Phase 4.** **Android cold-start measurement** (AC #19) — still deferred pending Redmi 8A class hardware.
- ⏳ **Re-carried into Phase 4.** **Sentry + PostHog wiring** still deferred from Phase 1 (drop-in points are `lib/crash.ts` and `lib/analytics.ts`).
