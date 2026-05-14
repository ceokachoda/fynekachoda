# FyneStudy — Coaching OS

> Hybrid coaching institute OS for JEE/NEET/CUET prep. One mobile app (students + teachers, role-gated). One web admin panel. One Supabase backend. Live classes via wrapped YouTube. Attendance via rotating QR. Practice quizzes + graded exams. Weekly parents' WhatsApp PDF.

## Status
- **Phase 0 (UI scaffolding) ✅ done** — `apps/mobile/` had all student screens before the new phased plan started. Dead screens (OTP, verify, select-course) deleted in Phase 2.
- **Phase 1 (Foundation & Infrastructure) ✅ done — 2026-05-14** (PR #1, commit `ef8c0cf` merged to main as `bea08b2`). pnpm monorepo, Supabase dev project (`orqwyazvcthgxoadfxfv`), `health` edge fn, mobile lib/ wired, Vercel admin (`https://admin-kohl-sigma.vercel.app/`), CI workflows, EAS project. Full ledger in `docs/phases/phase-1.md §13`. Three ACs deferred by explicit user decision: Sentry (#7), PostHog (#8), Android APK install (#15).
- **Phase 2 (Auth & Onboarding) ✅ done — 2026-05-15.** Identity tables + RLS in `private` schema (D-146), 4 edge fns (`auth-bootstrap`, `auth-suspend` with `mode` field per D-147, `auth-force-reset`, `auth-clear-must-change`), admin login + TOTP + students CRUD, mobile email+password + force-password-change + role gates, mobile auth wrapped in `withTimeout` per D-148. Ledger in `docs/phases/phase-2.md §14`. Three ACs deferred/partial: #3 (TOTP recovery codes — Phase 3 carry-over), #10 (profile phone/DOB display — Phase 3 carry-over), #19 (Redmi 8A cold-start measurement — needs hardware). Work sits uncommitted on `main` pending the Phase 2 PR.
- **Phase 3 (Courses, Batches, Curriculum) — next.** Picks up with `docs/phases/phase-3.md`. Adds course/batch/curriculum tables, makes `students.batch_id` NOT NULL via migration with a default first batch, adds the teacher batch-scope RLS policy. Also picks up the Phase 2 carry-overs (TOTP recovery codes, profile phone/DOB, schema-doc drift sweep).

## Authoritative docs (read these first when working)
| Question | Open |
|---|---|
| What is this product? | `docs/project.md` |
| Why did we decide X this way? | `docs/decisions.md` (source of truth when specs disagree) |
| Where's the file for feature X? | `docs/file-structure.md` |
| What's the DB schema / RLS / edge fn? | `docs/backend-architecture.md` |
| How does feature X actually work? | `docs/spec/<feature>.md` |
| How do I keep performance budget? | `docs/spec/performance.md` |
| Security baseline | `docs/spec/security.md` |

## Tech Stack
| Layer | Choice |
|---|---|
| Mobile | React Native 0.81 + Expo SDK 54, iOS + Android both first-class |
| Routing | Expo Router 6 (file-based) |
| Styling | NativeWind 4 + Tailwind 3 |
| Mobile build | EAS Build + EAS Update |
| Admin | Next.js 15 + Tailwind + shadcn/ui on Vercel |
| Backend | Supabase (Postgres + Auth + Storage + Realtime + Edge Functions), `ap-south-1` |
| Live stream | YouTube Live Unlisted, wrapped via `react-native-youtube-iframe` |
| Chat | Supabase Realtime |
| PDF | `pdf-lib` in Supabase Edge Functions |
| WhatsApp | Gupshup Business API |
| Crash | Sentry |
| Analytics | PostHog |
| CI | GitHub Actions |
| Math | KaTeX |

## Roles & Onboarding Flow
Admin issues every account. **No self-signup, ever.**

1. Admin enters student details + assigns batch (→ course is derived).
2. System creates Supabase auth user + emails initial credentials.
3. Student opens app → logs in → forced password change on first login.
4. Same pattern for teachers.
5. **Students/teachers cannot change** their own `batch`, `course`, `email`, `phone`, `dob`, `full_name`, or `parent_phone`. They must ask admin. See `decisions.md D-016` and the editability matrix in `spec/authentication.md §10A`.
6. Multi-role users are supported (teacher + staff_admin is common).

| Role | Logs in via | MFA | Notes |
|---|---|---|---|
| `student` | Mobile app | off | One batch at a time |
| `teacher` | Mobile app | optional | Can be in multiple batches |
| `staff_admin` | Web panel | TOTP required | Ops; cannot manage admins or institute settings |
| `owner_admin` | Web panel | TOTP required | Everything |

## Module Map — where things live
| Feature | Spec | Primary mobile route | Edge function(s) |
|---|---|---|---|
| Auth | `spec/authentication.md` | `app/login.tsx`, `app/force-password-change.tsx` | `auth-bootstrap`, `auth-suspend` |
| Student dashboard | `spec/student-dashboard.md` | `app/(student)/index.tsx` | `mastery-recompute` |
| Attendance | `spec/attendance.md` | `app/(student)/attendance.tsx`, `app/(teacher)/scan.tsx`, `app/(teacher)/roster/[id].tsx` | `attendance-qr-sign`, `attendance-qr-verify`, `attendance-correct` |
| Practice quizzes | `spec/practice-quizzes.md` | `app/(student)/quiz/[id].tsx` | `quiz-start`, `quiz-submit` |
| Exams | `spec/examinations.md` | `app/(student)/exam/[id].tsx`, `app/(teacher)/exam-builder.tsx` | `exam-start`, `exam-submit`, `exam-release-results`, `exam-regrade`, `exam-tab-switch` |
| Live + recordings | `spec/youtube-live-stream.md` | `app/(student)/live/[id].tsx`, `app/(teacher)/live-control/[id].tsx` | `yt-broadcast-create`, `yt-broadcast-stop`, `yt-playback-sign` |
| Library | `spec/study-materials.md` | `app/(student)/library.tsx`, `app/(student)/video/[id].tsx`, `app/(student)/pdf/[id].tsx` | `content-presign-upload`, `content-finalize`, `content-create-video` |
| Leaderboard + gamification | `spec/leaderboard-and-gamification.md` | `app/(student)/leaderboard.tsx`, `app/(student)/profile.tsx?tab=badges` | `streak-recompute`, `leaderboard-weekly-rollover`, `badge-evaluate` |
| Parents' report | `spec/parents-report.md` | (server only) | `parent-report-generate`, `whatsapp-send`, `gupshup-callback`, `whatsapp-retry` |
| Admin panel | `spec/admin-panel.md` | `apps/admin/app/(dashboard)/*` | all of the above |
| Teacher panel | `spec/teacher-panel.md` | `app/(teacher)/*` | per feature |
| Security & compliance | `spec/security.md` | n/a | n/a |
| Performance budget | `spec/performance.md` | n/a | n/a |

## Hard rules (do these always)
- **iOS and Android both** must be verified on every change. Don't ship one ahead of the other.
- **Every user-data table has RLS on.** Service-role key is only in edge functions.
- **Every privileged write goes through an edge function.** No service-role usage from app code.
- **Every edge function checks `app_users.is_active = true`** after JWT verification. Suspended users get 401 even if their cached access token is still valid. (Closes the ≤1h leak window after `auth-suspend`.)
- **Every admin write produces an `audit_log` row** with before/after JSON (`apps/admin/lib/audit.ts → withAudit`).
- **No `console.log` in production builds.** Babel strips it; don't rely on the strip — write better.
- **No PII in Sentry events.** Scrubbed in `Sentry.beforeSend`.
- **All Storage buckets private.** Access via short-lived signed URLs only.
- **Server is the only source of truth for exam timer + QR validity.** Never trust device clock.
- **Mobile-first.** Test on a real low-end device (Redmi 8A class) before declaring done.

## Hard rules (never do these)
- ❌ Add self-signup (even temporarily / behind a flag).
- ❌ Send `is_correct` to the client during a quiz/exam attempt.
- ❌ Expose YouTube video IDs or stream keys to non-creators.
- ❌ Add app-layer encryption on PII columns (over-engineering; breaks RLS).
- ❌ Bypass RLS via service-role from app code.
- ❌ Add a cron job without an idempotency check.
- ❌ Commit a `.env*` file or any secret.
- ❌ Use `git push --force` to `main`, `--no-verify`, or destructive ops without explicit user OK.
- ❌ Add a self-edit input for any identity field (see `decisions.md D-016`).

## Low-end device rules (excerpt — full in `spec/performance.md`)
- Reference device: Redmi 8A class (Android 9, 2 GB RAM).
- Cold start ≤ 3 s; screen transitions ≤ 200 ms; bundle ≤ 35 MB OTA.
- `FlatList`/`SectionList` for any list > 20 items.
- Use `expo-image` with explicit dimensions + `memory-disk` cache.
- Only one WebView (wrapped YT player) mounted at a time. Unmount on screen blur.
- Always unsubscribe Realtime channels on unmount.
- Exam screen: no Reanimated, no charts, no images outside questions.
- Animations default 200 ms; respect `isReduceMotionEnabled`.

## Where bugs hide (debugging map)
- **Auth not resuming on app focus** → `apps/mobile/lib/supabase.ts` + `lib/secure-store.ts`. Refresh token must come from `expo-secure-store`, not AsyncStorage.
- **QR scan failing** → `attendance-qr-verify` edge fn. Check HMAC freshness + session match + replay constraint. Server clock authoritative.
- **Exam timer drift** → client must sync `server_now` on entry + every 60 s. Display only; server enforces submission cut.
- **Live class blank screen** → check `yt-playback-sign` returned payload, then `react-native-youtube-iframe` log; verify YT broadcast `status='live'`.
- **WebView memory creep on long sessions** → confirm cleanup on unmount; only one mounted; PostHog event for `live_class_left` should fire.
- **Realtime "ghost" subscriptions** → grep for `supabase.channel(` without a matching `removeChannel` in cleanup.
- **WhatsApp send `template_param_error`** → variable count in payload must match approved Gupshup template exactly.
- **RLS empty result where data exists** → policies don't union; check helper `current_app_user_id()` returned non-null; verify `auth.uid()` present in request.
- **Mastery stale** → trigger `mastery-recompute` manually or wait for nightly cron; recompute is idempotent.

## When making changes
1. Find the **spec** (`docs/spec/<feature>.md`).
2. Check **`docs/decisions.md`** for any binding constraint.
3. Trace the **data flow** in `docs/backend-architecture.md`.
4. Touch code in this order: schema migration → edge function → mobile feature → UI.
5. Add/update tests next to source as `*.test.ts`.
6. Confirm: does this write deserve an `audit_log` entry?
7. Run `pnpm typecheck && pnpm lint && pnpm test` before opening a PR.

## Coding conventions
- TypeScript strict. No `any` without a justification comment.
- No comments that explain *what* — code should say it. Only *why* when non-obvious.
- Files kebab-case. Components PascalCase. Hooks `useFoo`. Edge fns `verb-noun`. DB tables `snake_case` plural.
- Server state: TanStack Query. Client state: `useState`/`useReducer` first; Zustand only if cross-cutting.
- Forms: react-hook-form + zod schemas from `packages/shared/validation/`.
- All path aliases use `@/*` rooted at the app root.

## Asking for guidance
- Looking for where X is implemented → spec first.
- Looking for why we did X → `docs/decisions.md`.
- Adding a new feature → write the spec under `docs/spec/<name>.md`, link it in `CLAUDE.md`'s module map, then code.
- Changing a decision → add a new dated entry in `decisions.md` referencing the superseded one. **Never delete.**

## Demo strategy
Demo flow + seed data + pre-baked accounts are in `docs/project.md §9`. Demo must be boringly reliable.

## When in doubt
- Reliability beats cleverness.
- Server enforcement beats client trust.
- Smaller bundles beat richer animations.
- Documented beats undocumented.
- Boring tech beats novel tech.

## File entry points (don't grep — bookmark)
- Mobile root: `apps/mobile/app/_layout.tsx`
- Admin root: `apps/admin/app/layout.tsx`
- Edge fn root: `apps/functions/*/index.ts`
- Supabase migrations: `supabase/migrations/`
- Shared types: `packages/shared/`, `packages/supabase-types/`

## Help / feedback
- `/help` for Claude Code commands.
- Issues at https://github.com/anthropics/claude-code/issues.
