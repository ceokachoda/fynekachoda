# Phase 01 — Foundation & Core Architecture

## Goal

Stand up the repo, Supabase project, base schema with RLS, auth, CI/CD, observability, and the React Native + Next.js shells that compile and log in. After this phase, every later phase builds features on a stable substrate — no retroactive schema surgery.

## Why this phase exists

Every bug fixed later is 10x cheaper if the foundation is right. Skipping RLS now = rewriting every query later. Skipping CI now = losing half a day per release. Skipping types now = runtime errors at the client demo.

## Scope

### In-scope
- Monorepo structure.
- Supabase cloud project (dev + staging + prod).
- Core schema migrations (users, roles, batches, courses, enrollments, classes, attendance, content, payments, notifications, audit_log).
- RLS policies for every table (deny-by-default).
- Supabase Auth (phone OTP primary, email+password fallback for admin/teacher).
- Generated TypeScript types from Supabase.
- RN app (Expo, TS, Expo Router) bootable to a "Hello, {name}" screen after OTP login.
- Next.js admin app bootable to a "Signed in as {email}" screen.
- Shared `@coachingos/types` package for DB types + zod schemas.
- GitHub Actions: lint, typecheck, test, EAS preview build on PR.
- Sentry wired in RN + Next.js + Edge Functions.
- `.env` templating and secret handling.

### Out-of-scope
- Any feature screen (dashboard, attendance, classes, payments).
- 100ms, Bunny, Razorpay integrations.
- Push notifications (Expo device token storage can land here as a stub, but fanout lives in P8).

## User roles impacted
All. Everyone gets a row in `users` and a role.

## Screens to build
- RN: Splash, OTP entry, OTP verify, minimal "Home (signed in)" placeholder.
- Next.js: Sign-in page, minimal admin landing placeholder.

## Frontend tasks

### Monorepo setup
- [ ] Initialize pnpm workspace at repo root.
- [ ] `apps/mobile` — Expo SDK 52+, TypeScript, Expo Router.
- [ ] `apps/admin` — Next.js 15 App Router, TypeScript, shadcn/ui.
- [ ] `packages/types` — generated Supabase types, zod schemas, shared enums.
- [ ] `packages/config` — eslint, tsconfig, prettier presets.
- [ ] Root `turbo.json` for task orchestration.

### RN app bootstrap
- [ ] Install Expo Router, NativeWind, Reanimated 3, Moti, `@tanstack/react-query`, `zustand`, `@supabase/supabase-js`, `expo-secure-store`, Sentry.
- [ ] Create `lib/supabase.ts` (singleton client, uses `expo-secure-store` as auth storage adapter).
- [ ] Create `providers/` (QueryClientProvider, ThemeProvider, AuthProvider wrapping Supabase session listener).
- [ ] Auth screens: `(auth)/phone.tsx`, `(auth)/otp.tsx`.
- [ ] Protected layout: `(app)/_layout.tsx` redirects to `(auth)/phone` if no session.
- [ ] EAS project created; dev client build profile.
- [ ] Sentry DSN injected via `expo-constants` + EAS secrets.

### Admin app bootstrap
- [ ] Next.js with App Router, Tailwind, shadcn/ui installed.
- [ ] `@supabase/ssr` for cookie-based server sessions.
- [ ] Middleware that gates all `/admin/*` routes behind a role check (`role in ('admin','teacher')`).
- [ ] Sign-in page (email + password; admin/teacher accounts created manually in P7).
- [ ] Placeholder dashboard page showing `session.user.email` and role.

## Backend tasks

### Supabase project setup
- [ ] Create 3 projects in Supabase cloud: `coachos-dev`, `coachos-staging`, `coachos-prod`.
- [ ] Enable: Auth (phone provider via MSG91 or Twilio), Storage, Realtime.
- [ ] Configure phone provider (MSG91 recommended for India — cheaper than Twilio, better INR pricing).
- [ ] Connect repo → Supabase CLI for migrations (`supabase/migrations/*.sql`).

### Base schema (see `DATABASE-SCHEMA-AND-STORAGE-PLAN.md` for full DDL)

Migration `0001_init.sql` introduces:
- `public.profiles` (mirrors `auth.users` with app-side fields: full_name, phone, role, batch_id, avatar_url, is_active, created_at).
- `public.roles` as enum: `student | teacher | admin`.
- `public.batches` (id, name, course_id, year, start_date, end_date, is_active).
- `public.courses` (id, name, subject, description).
- `public.enrollments` (student_id, batch_id, enrolled_at, status).
- `public.classes` (id, batch_id, teacher_id, subject, scheduled_at, duration_min, type: `live|offline|hybrid`, status, room_id, recording_asset_id).
- `public.attendance` (id, student_id, class_id, marked_at, method: `qr|manual`, scanner_id, is_valid).
- `public.qr_tokens` (id, student_id, token_hash, issued_at, expires_at, consumed_at).
- `public.content_items` (id, type: `pdf|image|doc|recording|clip|link`, title, description, batch_id, course_id, subject, storage_path, video_asset_id, visibility, created_by, created_at).
- `public.memberships` (id, student_id, plan_id, starts_at, expires_at, status).
- `public.plans` (id, name, duration_days, amount_inr, features).
- `public.payments` (id, student_id, plan_id, amount_inr, status, razorpay_order_id, razorpay_payment_id, paid_at).
- `public.device_tokens` (id, user_id, platform, expo_token, last_seen_at).
- `public.notifications` (id, user_id, type, payload, sent_at, read_at).
- `public.audit_log` (id, actor_id, action, target_table, target_id, diff, created_at).

### Indexes (P1 subset)
- `attendance (student_id, class_id)` unique.
- `qr_tokens (student_id, expires_at)` partial where `consumed_at is null`.
- `classes (batch_id, scheduled_at)`.
- `content_items (batch_id, type, created_at desc)`.
- `memberships (student_id)` with partial `status = 'active'`.

### RLS (deny by default)
Enable RLS on every public table. Write policies for each role:

Examples (full list in `DATABASE-SCHEMA-AND-STORAGE-PLAN.md`):
```sql
-- profiles: user reads own row; admin reads all
create policy "profiles self-read" on profiles
  for select using (id = auth.uid());
create policy "profiles admin-read" on profiles
  for select using (exists(select 1 from profiles p where p.id=auth.uid() and p.role='admin'));

-- attendance: student reads own; teacher reads batch; admin reads all; only staff inserts
create policy "attendance self-read" on attendance
  for select using (student_id = auth.uid());
```

### Helper SQL functions
- `is_admin()` → boolean.
- `is_teacher_of(batch_id uuid)` → boolean.
- `has_active_membership(student_id uuid)` → boolean.
These are called from RLS policies for readability.

### Edge Functions (skeletons, no logic yet)
- `issue-qr-token` — student-authenticated, returns short-lived JWT.
- `consume-qr-token` — scanner-authenticated, validates and writes attendance.
- `razorpay-webhook` — placeholder.
- `create-100ms-room` — placeholder.
- `expo-push-fanout` — placeholder.

### Seed data
A `supabase/seed.sql` that inserts: 1 admin, 2 teachers, 1 batch, 1 course, 5 students, 2 classes (one past, one future), 1 plan, memberships for all students.

## Database / data model needs
Handled in the schema above; complete ERD in `DATABASE-SCHEMA-AND-STORAGE-PLAN.md`.

## APIs / services needed
Only Supabase Auth endpoints (OTP + session) in this phase. Everything else is Postgres via `postgrest` through `@supabase/supabase-js`.

## Third-party integrations
- **MSG91** for phone OTP (Supabase phone provider).
- **Sentry** for error tracking.
- **EAS** for builds.

## Recommended libraries / tools
| Purpose | Package |
|---|---|
| Supabase client | `@supabase/supabase-js`, `@supabase/ssr` (admin) |
| Auth secure storage (RN) | `expo-secure-store` |
| State | `@tanstack/react-query`, `zustand` |
| Forms | `react-hook-form`, `zod`, `@hookform/resolvers` |
| Styling (RN) | `nativewind`, `react-native-reanimated`, `moti` |
| Styling (Web) | `tailwindcss`, `shadcn/ui`, `lucide-react` |
| Routing | `expo-router`, Next.js App Router |
| CI | GitHub Actions, `eas-cli`, `turbo` |
| Types | `supabase gen types typescript` |
| Errors | `@sentry/react-native`, `@sentry/nextjs`, `sentry` Edge Function integration |

## Edge cases
- User's `auth.users` row exists but `profiles` row doesn't → use a Postgres trigger `handle_new_user()` that inserts a matching profile. Covered in migration.
- User changes phone number → admin-only action; handled in P7.
- RLS policy misconfiguration locks everyone out → policies are tested via a `supabase/tests/` SQL test suite; CI runs `supabase db test`.

## Risks
| Risk | Mitigation |
|---|---|
| RLS gets in the way during dev and people disable it | Never disable. Use `supabase.auth.admin` server-side only. CI fails if any table has RLS off. |
| Supabase OTP provider flakiness | Prepare fallback: email magic link in admin; for students, wire MSG91 directly from an Edge Function as a backup. |
| Monorepo tool fatigue | Keep it minimal: pnpm + turbo only. No Nx, no Rush. |

## Dependencies on earlier phases
None. This IS the earliest phase.

## Acceptance criteria
- [ ] Fresh clone + `pnpm install` + `supabase start` (local) + `pnpm dev` boots mobile + admin.
- [ ] A seeded student can log into the RN app via OTP and see their own name.
- [ ] A seeded admin can log into the Next.js panel with email+password.
- [ ] `supabase db reset` re-applies all migrations and seeds cleanly.
- [ ] RLS is on for every table in `public.`; `select *` from a random table as anon returns 0 rows.
- [ ] CI green on PR: lint, typecheck, unit tests, EAS preview build posted to PR.
- [ ] Sentry receives a test event from each of: RN app, admin app, Edge Function.

## Definition of done
- Everything in acceptance criteria.
- Root `README.md` has a "How to run" section that a new engineer can follow.
- Every Edge Function skeleton deploys.
- `.env.example` files in `apps/mobile`, `apps/admin`, and repo root.
- Schema documented in `DATABASE-SCHEMA-AND-STORAGE-PLAN.md` matches actual migrations.

## Suggested folder / module breakdown

```
fynestudylive/
├── apps/
│   ├── mobile/                  # Expo RN app
│   │   ├── app/                 # Expo Router
│   │   │   ├── (auth)/
│   │   │   ├── (app)/
│   │   │   └── _layout.tsx
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── features/
│   │   │   ├── lib/             # supabase, analytics, push
│   │   │   ├── providers/
│   │   │   ├── hooks/
│   │   │   └── theme/
│   │   ├── assets/
│   │   ├── app.config.ts
│   │   └── eas.json
│   │
│   └── admin/                   # Next.js 15 admin panel
│       ├── app/
│       │   ├── (auth)/
│       │   └── (panel)/
│       ├── components/
│       ├── lib/
│       └── middleware.ts
│
├── packages/
│   ├── types/                   # generated + zod
│   └── config/                  # shared tsconfig/eslint/prettier
│
├── supabase/
│   ├── migrations/
│   ├── functions/               # Edge Functions
│   │   ├── issue-qr-token/
│   │   ├── consume-qr-token/
│   │   ├── razorpay-webhook/
│   │   ├── create-100ms-room/
│   │   └── expo-push-fanout/
│   ├── tests/
│   └── seed.sql
│
├── .github/workflows/
├── turbo.json
├── pnpm-workspace.yaml
└── README.md
```

## Suggested order of implementation (inside this phase)

1. pnpm workspace + turbo + tsconfig + eslint/prettier.
2. Supabase project created, CLI linked, first migration with `profiles` + trigger.
3. RN app skeleton with Expo Router and Supabase auth; verify OTP login locally using a Supabase test phone.
4. Add all remaining tables + RLS + seed.
5. Generate types; wire `packages/types`.
6. Admin Next.js skeleton + middleware + sign-in.
7. Edge Function skeletons + Sentry.
8. CI pipeline + EAS preview + `.env.example`.
9. Write and run RLS test suite.
10. Tag `v0.1.0-foundation`.
