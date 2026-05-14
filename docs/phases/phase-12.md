# Phase 12 — Admin Completion, Hardening, Demo Prep, Production Deploy

> The closing phase. Fill the remaining admin pages (audit, settings, bulk import, remaining oversight). Tighten everything (rate limits, security pass, perf pass, E2E tests). Build demo seed data. Stand up the production Supabase project, run a final QA, and cut over.

---

## 1. Goal

Take the system from "feature complete" to "production-ready, demo-able, deployed". This is the phase where every loose end is tied off. After Phase 12, the app is live for the institute.

## 2. Prerequisites

- [ ] Phase 11 accepted.
- [ ] Production Supabase project (`fynestudy-prod`) created earlier (Phase 1) but unused so far.
- [ ] Production YT channel decided (can be the same as dev or a separate one; recommendation: same channel — dev/prod are app-side, not video-side).
- [ ] Production Gupshup app credentials.
- [ ] Production Sentry + PostHog projects.
- [ ] Decision: production domain (`fynestudy.in` or chosen) — DNS configured.
- [ ] Decision: demo date locked (we plan against that date).

## 3. Scope

### In
- Admin: complete remaining pages — `/audit`, `/admins`, `/attendance` (corrections + bulk), `/settings`, bulk CSV student import.
- `withAudit` wrapper applied to **every** admin write action (sweep).
- Login attempts table + IP-based lockout (refining Phase 2's basic rate limit).
- MFA recovery codes table.
- Rate limits applied to **every** public edge fn (sweep).
- Sentry source-maps wired (mobile + admin) on release builds.
- PostHog events covering every meaningful interaction.
- Security review pass: RLS audit script, secret rotation drill, owner-only path audit.
- Performance pass: bundle audit, list virtualization audit, WebView lifecycle audit on real Redmi 8A device.
- E2E test suite (Maestro) for the demo flow.
- Demo seed: 30 students, 4 teachers, 3 batches, 50 quizzes, 1 scheduled live class, 1 completed exam — pre-baked accounts.
- iOS + Android final QA on real low-end + flagship devices.
- Production Supabase project setup (migrations, seeds, Vault entries).
- Production Vercel deployment.
- Production EAS submission (Android + iOS).
- Runbook (`docs/runbook.md`), incident playbook (`docs/incident-playbook.md`), deployment guide (`docs/deploy-guide.md`).
- Sentry alert rules; PostHog dashboards.
- Gitleaks + dep-audit in CI.

### Out
- Anything not in MVP scope per `decisions.md §"Out of MVP"`.

## 4. Specs in play

- `docs/spec/admin-panel.md §11-19` — remaining admin scope.
- `docs/spec/security.md §17-19` — secrets + observability + incident response.
- `docs/spec/performance.md` — final budget verification.
- `docs/project.md §9` — demo flow.

## 5. Backend / admin completion work

### 5.1 Migration: login attempts + MFA recovery (Checkpoint 1)

`supabase/migrations/0025_security_tables.sql`:

```sql
create table public.login_attempts (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  ip_address  inet,
  success     boolean not null,
  attempted_at timestamptz not null default now()
);

create index login_attempts_email_time_idx on public.login_attempts (email, attempted_at desc);
create index login_attempts_ip_time_idx on public.login_attempts (ip_address, attempted_at desc);

create table public.mfa_recovery_codes (
  user_id   uuid not null references public.app_users(id) on delete cascade,
  code_hash text not null,
  used_at   timestamptz,
  primary key (user_id, code_hash)
);

alter table public.login_attempts enable row level security;
alter table public.mfa_recovery_codes enable row level security;

create policy la_admin on public.login_attempts for select to authenticated using (public.is_admin());
create policy mfa_self on public.mfa_recovery_codes for select to authenticated using (user_id = public.current_app_user_id());
create policy mfa_admin on public.mfa_recovery_codes for all to authenticated using (public.is_admin()) with check (public.is_admin());
```

Edge fn `auth-record-login-attempt` called from login flow.

### 5.2 Admin: /audit page (Checkpoint 2)

`apps/admin/app/(dashboard)/audit/page.tsx`:
- DataTable on `audit_log` with server-side pagination (50/page).
- Filters: actor, role, action, entity_table, entity_id, date range.
- Click row → side panel with before/after JSON diff (use a diff viewer like `react-diff-viewer-continued`).
- Export CSV (admin only).

### 5.3 Admin: /admins page (Checkpoint 3)

Owner-only.

`apps/admin/app/(dashboard)/admins/page.tsx`:
- List admin users with role tier.
- "+ New Admin": email, role (owner/staff). Calls `auth-bootstrap` with admin role.
- Promote/demote actions.
- Force-logout button (calls `auth.admin.signOut(user_id)`).
- Delete admin (cannot delete self; cannot delete the last owner).

### 5.4 Admin: /attendance corrections + reports (Checkpoint 4)

`apps/admin/app/(dashboard)/attendance/page.tsx` extends Phase 4:
- Bulk attendance edit (with reason per cell, audit logged).
- Per-batch / per-date reports.
- Export attendance to CSV.

### 5.5 Admin: bulk student import (Checkpoint 5)

`apps/admin/app/(dashboard)/students/import/page.tsx`:
- Upload CSV.
- Server parses + validates each row → preview with errors highlighted.
- Admin confirms valid rows.
- Server calls `auth-bootstrap` in batches of 25.
- Final report: created N, failed M with reasons.

Edge fn: `students-bulk-import`.

### 5.6 Admin: /settings (Checkpoint 6)

Owner-only.

`apps/admin/app/(dashboard)/settings/page.tsx`:
- Institute info: name, logo upload, primary color, contact URL/email.
- Timezone + term dates.
- Default marking schemes (presets).
- Default class duration.
- 2FA enforcement toggles (staff/teacher).
- Demo data toggle (admin can seed/reset demo accounts — dev/prod gated).

### 5.7 withAudit sweep (Checkpoint 7)

Walk every server action in admin app. Wrap with `withAudit`. Verify by reading audit_log after each action type.

### 5.8 Rate limits sweep (Checkpoint 8)

For every edge fn, ensure rate limit applied. Use `_shared/ratelimit.ts` per `spec/security.md §7`. Spot-check a few via load test (50 concurrent requests).

### 5.9 Sentry source maps + PostHog events sweep (Checkpoint 9)

- EAS build profiles upload source maps on production builds.
- Vercel + Sentry integration: source maps on every deploy.
- PostHog: add events for any feature that doesn't have one yet (audit checklist in `spec/performance.md §8.2`).

### 5.10 Security review pass (Checkpoint 10)

Run an audit script `scripts/security-audit.ts`:

For each table in `information_schema.tables` (schema='public'):
- Assert RLS is enabled.
- Assert at least one policy exists.
- Assert no `for all to anon` policies.

For each Storage bucket:
- Assert `public = false`.

For each edge fn:
- Assert it verifies caller JWT (lint-style check).
- Assert it does NOT use anon key.

Run gitleaks: no committed secrets.

Run `pnpm audit` / `npm audit`: no high-severity vulns.

Generate a report, fix anything found.

### 5.11 Performance pass (Checkpoint 11)

On a Redmi 8A reference device:
- Cold start: measure with stopwatch + record in `docs/perf-baselines/phase-12.md`.
- Screen-to-screen p95.
- Dashboard cold load.
- Exam attempt screen render time.
- Live class memory profile (Android Studio Profiler).
- Bundle size: `npx expo export` → analyze.

Fix anything above budget per `spec/performance.md §1`.

### 5.12 E2E tests with Maestro (Checkpoint 12)

`apps/mobile/.maestro/`:
- `login.yaml`: open app → enter creds → force PW change → land on dashboard.
- `attendance.yaml`: open attendance → QR present.
- `quiz.yaml`: start a seeded quiz → submit → view solution.
- `exam.yaml`: enter a seeded scheduled exam → submit.
- `live.yaml`: open a seeded live (pre-recorded simulation) → chat works.

Run via `maestro test apps/mobile/.maestro/`. Add as a CI step (with Android emulator).

### 5.13 Demo seed data (Checkpoint 13)

`supabase/seed.sql` (rewritten):
- 1 institute with branded name, logo (placeholder).
- 4 courses (already seeded), 6 batches across 2 courses.
- 4 teachers, each on 2 batches.
- 30 students distributed across 3 batches.
- 50 quizzes covering 10 topics, each with 5–15 questions.
- 1 completed exam with released results.
- 1 scheduled live class (10 min in the future at demo time — admin can re-schedule).
- 10 video lessons (link existing YT unlisted videos).
- 5 PDF notes (placeholder content).
- Attendance: 30 days of varied history.
- Mastery: realistic distribution.
- Streaks: a few students at 12 days, 30 days, 90 days.
- Badges: a few earned.

Demo accounts:
- `demo.student@fynestudy.in` / shown on screen
- `demo.teacher@fynestudy.in` / shown on screen
- `demo.admin@fynestudy.in` / shown on screen

`scripts/seed-demo.ts` — idempotent re-run.

### 5.14 Production Supabase setup (Checkpoint 14)

- Link prod project: `supabase link --project-ref fynestudy-prod`.
- Run `supabase db push` against prod.
- Run `scripts/bootstrap-owner.ts` against prod with the actual owner email.
- Manually run `seed.sql` if demo data desired in prod (probably not — prod is real institute).
- Add Vault entries to prod: YT_CLIENT_*, GUPSHUP_*, HMAC secrets (new secrets, not dev's).
- Deploy all edge functions to prod.
- pg_cron schedules added.
- Enable PITR.

### 5.15 Production Vercel deploy (Checkpoint 15)

- Vercel project: import repo, root `apps/admin`, env vars set (prod Supabase URLs, prod Sentry DSN, prod PostHog key).
- Custom domain `admin.fynestudy.<tld>` linked.
- HSTS + security headers configured (CSP per `spec/security.md §11`).
- Production build green.

### 5.16 Production EAS submission (Checkpoint 16)

- `apps/mobile/eas.json` production profile uses prod env.
- `eas build --profile production --platform all`.
- iOS: submit via TestFlight first; final submit to App Store.
- Android: submit via Play Console as internal track → closed testing → production.
- Configure EAS Update channels: `production` channel for OTA hotfixes.

### 5.17 Sentry alerts + PostHog dashboards (Checkpoint 17)

Sentry alert rules:
- Any unhandled error in edge fn → alert immediately.
- Mobile crash rate > 0.5% of sessions → alert.
- WhatsApp send failure rate > 5% over 1 hour → alert.
- p95 transaction duration for exam-submit > 2s → alert.

PostHog dashboards:
- DAU / MAU.
- Attendance marked per day.
- Quiz completion rate.
- Live class join rate.
- Retention curve.

### 5.18 Documentation (Checkpoint 18)

- `docs/runbook.md`: how to operate the system day-to-day (backup verify, secret rotation, scaling actions).
- `docs/incident-playbook.md`: contact list, detect→contain→eradicate→recover steps, notification templates.
- `docs/deploy-guide.md`: how to deploy hotfix (mobile OTA, admin Vercel, edge fn).
- `docs/onboarding.md`: how a new engineer ramps up (read order: project.md → CLAUDE.md → decisions.md → relevant spec).

### 5.19 Demo dry run (Checkpoint 19)

Walk through the demo flow per `docs/project.md §9`:
1. Open mobile app on real phone with demo student account.
2. Show dashboard, schedule, streak, mastery.
3. Switch to attendance → display QR.
4. Switch device → demo teacher account → open scanner → scan QR → attendance marked.
5. Back to student → library → play a video lesson.
6. Take a practice quiz → submit → view solution.
7. Join a scheduled live class.
8. Switch to admin web → student detail → "Generate Parent Report" → WhatsApp arrives.

Record the dry run on video. Iron out any rough edges.

### 5.20 Production cutover (Checkpoint 20 — explicit go signal required)

**STOP. Do not proceed without the user saying "go live".**

When green-lit:
1. Submit final EAS build to stores.
2. Flip admin Vercel domain to production.
3. Send credentials to institute owner.
4. Initial owner-bootstrap on prod.
5. Owner creates first teachers + batches via admin (no seed data on prod).
6. Monitor Sentry + PostHog for 24h.

## 6. Frontend work (summary)

### Mobile — final polish
- Strip Phase 1 debug button if not done.
- Settings screen mirrors admin's institute_config (branding only).
- Final QA visual sweep on iOS + Android.

### Admin — pages added
- `/audit`
- `/admins`
- `/students/import`
- `/settings`

### Admin — pages edited
- `/attendance` (corrections + bulk + reports)
- Every page: confirm `withAudit` wrap.

### Edge fns added
- `students-bulk-import`, `auth-record-login-attempt`, `mfa-recovery-verify`

## 7. Files changed (summary)

### Mobile
- `lang/en.ts` final strings (i18n-ready).
- `app.json` final bundle ID + version.
- `.maestro/` E2E flows.
- Any stripped debug code.

### Admin
- Pages above.
- `middleware.ts` extended with login_attempts logging.

### DB
- 1 migration (security tables).

### Docs
- `docs/runbook.md`, `docs/incident-playbook.md`, `docs/deploy-guide.md`, `docs/onboarding.md`, `docs/perf-baselines/phase-12.md`.

### CI
- `.github/workflows/security-audit.yml` (gitleaks + RLS audit).
- E2E job (Maestro) on PRs.

## 8. Acceptance criteria

1. All admin pages from `spec/admin-panel.md §5` exist and function.
2. Audit log captures every admin write — verified by smoke test (do 10 actions, see 10 rows).
3. Bulk CSV import: 50-row CSV imports successfully; partial-failure cases reported.
4. RLS audit script passes on every table.
5. Storage bucket audit: all 5 buckets private.
6. Gitleaks: no secrets in history.
7. `pnpm audit`: no high-severity vulns.
8. Mobile cold start on Redmi 8A: < 3 s.
9. Bundle size: < 35 MB OTA, < 80 MB store.
10. Memory during live class on Redmi 8A: < 350 MB.
11. Maestro E2E: all 5 flows pass on emulator.
12. Demo seed: `scripts/seed-demo.ts` is idempotent.
13. Demo dry run: full 10-min flow executed without errors; video recorded.
14. Production Supabase: migrations applied; owner-bootstrap done; Vault populated.
15. Production Vercel: admin live at production domain with HTTPS + HSTS.
16. Production EAS builds: Android + iOS produced; installable.
17. Sentry alert rules active.
18. PostHog dashboards saved.
19. Runbook + incident playbook + deploy guide written.
20. Owner has been onboarded to admin panel.
21. Owner has TOTP enrolled with recovery codes saved.
22. CI green on main; all phase tests retained.

## 9. Test plan

### Automated
- Full CI: lint + typecheck + unit + integration + RLS + Maestro E2E.

### Manual
- Demo dry run end-to-end.
- Cross-device QA: Pixel 6, Redmi 8A, iPhone 8, iPad — flagship & low-end on each platform.
- Network conditions: 4G simulation, weak Wi-Fi, airplane mode toggle.
- Cold start measured on Redmi 8A.

### Security
- Penetration self-test: try to access another batch's data via crafted REST calls.
- Try to call edge fn with no JWT, expired JWT, wrong role.
- Try to bypass rate limit with burst.

## 10. Rollback plan

If production cutover goes badly:
1. Revert Vercel to previous deployment.
2. EAS OTA push a known-good update.
3. Pause Gupshup messaging from admin panel.
4. Database: PITR to a recent good point.

Document a 4-hour RTO target.

## 11. Definition of done

- [ ] All 22 AC pass.
- [ ] Owner formally accepts the system.
- [ ] Demo executed in front of client (or scheduled date confirmed).
- [ ] First 24h post-cutover monitored; no critical alerts.
- [ ] User says "Phase 12 accepted. We are live."

## 12. After Phase 12

The MVP is live. Post-launch backlog (already prioritized in `decisions.md §"Out of MVP"`):
- Phase 13 (future): Razorpay payments + fee management.
- Phase 14 (future): Push notifications.
- Phase 15 (future): Multi-branch / multi-tenant.
- Phase 16 (future): Offline downloads (with DRM consideration).
- Phase 17+ (future): AI features.

Each future phase follows the same vertical-slice + acceptance-driven pattern.
