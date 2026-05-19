Everytime you code , dont just guess. Be precise, if you have any doubts then ask me. Make sure whatever you do - you do tests and make it purely perfect for everything include supabase backend and everything.
# FyneStudy — Coaching OS

> Hybrid coaching institute OS for JEE/NEET/CUET prep. One mobile app (students + teachers, role-gated). One web admin panel. One Supabase backend. Live classes via wrapped YouTube. Attendance via rotating QR. Practice quizzes + graded exams. Weekly parents' WhatsApp PDF.

## Status
- **Phase 0 (UI scaffolding) ✅ done** — `apps/mobile/` had all student screens before the new phased plan started. Dead screens (OTP, verify, select-course) deleted in Phase 2.
- **Phase 1 (Foundation & Infrastructure) ✅ done — 2026-05-14** (PR #1, commit `ef8c0cf` merged to main as `bea08b2`). pnpm monorepo, Supabase dev project (`orqwyazvcthgxoadfxfv`), `health` edge fn, mobile lib/ wired, Vercel admin (`https://admin-kohl-sigma.vercel.app/`), CI workflows, EAS project. Full ledger in `docs/phases/phase-1.md §13`. Three ACs deferred by explicit user decision: Sentry (#7), PostHog (#8), Android APK install (#15).
- **Phase 2 (Auth & Onboarding) ✅ done — 2026-05-15.** Identity tables + RLS in `private` schema (D-146), 4 edge fns (`auth-bootstrap`, `auth-suspend` with `mode` field per D-147, `auth-force-reset`, `auth-clear-must-change`), admin login + TOTP + students CRUD, mobile email+password + force-password-change + role gates, mobile auth wrapped in `withTimeout` per D-148. Ledger in `docs/phases/phase-2.md §14`. Three ACs deferred/partial: #3 (TOTP recovery codes — Phase 3 carry-over), #10 (profile phone/DOB display — Phase 3 carry-over), #19 (Redmi 8A cold-start measurement — needs hardware). Work sits uncommitted on `main` pending the Phase 2 PR.
- **Phase 3 (Courses, Batches, Curriculum) ✅ done — 2026-05-15.** All twelve checkpoints (CP1–CP12) green. 6 new migrations applied (courses_batches, students_batch_required, batch_rls, teacher_app_users_read, mfa_recovery_codes), 7 new edge fns deployed (`batch-transfer`, `curriculum-mutate`, `batch-mutate`, `auth-change-own-password`, `mfa-codes-issue`, `mfa-codes-consume` + `auth-bootstrap` v2). Admin: `/courses`, `/batches`, `/teachers` (+ details), `/2fa/recovery` live; `/2fa/enroll` issues 10 SHA-256-hashed recovery codes on success. Mobile: student profile shows batch + course + phone + DOB read-only (closes Phase 2 carry-over #10); teacher home lists assigned batches with student count + next session; teacher batch-detail roster reads RLS-scoped students. Ledger in `docs/phases/phase-3.md §14`. Carry-overs into Phase 4: Vercel deployment fix (currently stuck on Phase 1 placeholder), Phase-12-dependent admin "Reset MFA" UI, Android cold-start hardware, Sentry+PostHog wiring, 16 performance advisor INFOs (intentional multi-policy pattern + fresh unused indexes). Three hard-learned lessons memorialised: (1) D-152 — teacher batch-scope on `app_users` is required to resolve student names through `students(app_users!user_id(full_name))` embed; (2) D-153 — mobile must NOT call `supabase.auth.updateUser` itself in the force-password-change flow; use `auth-change-own-password` edge fn; (3) D-154 — mobile auth calls use 30s `withTimeout` + post-timeout `sessionLanded()` fallback because iOS Expo Go can be slow writing the session to Keychain after `/token` returns. Work sits uncommitted on `main` pending the Phase 3 PR.
- **Phase 6 (Practice Quizzes) ✅ code-complete — 2026-05-19.** CP1–CP13 all green; manual QA pending. 4 new migrations applied (`question_bank`, `quizzes`, `quiz_rls`, `storage_exam_images`), 5 edge fns deployed (`quiz-start`, `quiz-submit`, `quiz-attempt-result`, `quiz-image-presign`, `quiz-admin-mutate`), 1 new private Storage bucket (`exam-images` ≤5 MB jpeg/png/webp). Mobile: rebuilt student `app/quiz/[id].tsx` as a 4-stage state machine (intro → attempt → result → solution) at top-level per D-169, with `MathText` rendering KaTeX via WebView only when math is detected (D-178), debounced auto-save to `quiz_answers` via PostgREST (RLS-permitted for in-flight attempts), server-anchored countdown timer, navigation grid, flag toggle, retake. Mobile teacher: new `(teacher)/quizzes.tsx` tab + top-level `app/quiz-builder/[quizId].tsx` with cascading topic picker + inline question editor + "Add from bank" sheet. Mobile student dashboard wires `useWeakTopics` proxy (avg <70% per topic) and library shows quizzes at topic level. Admin: `/quizzes` and `/questions` pages with CSV export + filters + publish toggle + archive + delete — all mutations routed through `quiz-admin-mutate` so `audit_log` captures before/after (D-172). Tests: 27/27 helper unit smokes (`pnpm test:quiz`), 12/12 RLS scenarios (`pnpm smoke:quiz-rls`) including T12 stringify-and-grep proving zero `"is_correct"` leak in `quiz-start` response, 26/26 edge-fn HTTP assertions (`pnpm smoke:quiz-fns`), 53/53 mobile jest, typecheck + lint green; advisor sweep clean (only Phase-1 `auth_leaked_password_protection` backlog WARN remains). Four hard-learned lessons memorialised: D-175 (`quiz-attempt-result` re-fetch fn — spec calls for re-openable solution view + image URLs expire), D-176 (PostgREST `Prefer: return=representation` evaluates BOTH WITH CHECK and USING on the inserted row — cross-scope inserts in fixtures must use service role), D-177 (one admin-mutate edge fn per resource family — reaffirms D-151; `quiz-admin-mutate` carries 4 ops), D-178 (`MathText` mounts a WebView only when KaTeX delimiters are detected — plain text renders to native `<Text>` for low-end perf). Phase 7+ carry-overs: local KaTeX bundle, mastery-recompute wiring, component-level jest, image-picker UX in quiz-builder, Redmi 8A cold-start (still hardware-blocked from Phase 5). Manual test plan at `docs/phases/phase-6-manual-tests.md` + fresh fixture script `pnpm seed:quiz-manual-test` (with `--reset` flag from day one — closes Phase-5 seed-hygiene carry-over). Ledger in `docs/phases/phase-6.md §14`. Work sits uncommitted on `phase-4` branch pending the consolidated PR.
- **Phase 5 (Study Materials Library) ✅ done — 2026-05-19.** All twelve checkpoints (CP1–CP12) green; CP13 wraps tests + advisor sweep + ledger; post-ledger audit pass added 2 bug-fix edge fns; manual-QA pass on iOS Expo Go (§A + §B + §C + §D + §E all ok; §G/§H deferred per below) shook out 6 patches landed same day. 5 new migrations (`content_library`, `content_rls`, `storage_content_buckets`, `playback_secret_accessor`, `content_updated_at_search_path`), **9** new edge fns (`content-presign-upload`, `content-finalize`, `content-create-video`, `yt-playback-sign`, `yt-thumb-sign`, `content-toggle-publish`, `content-promote-coursewide`, `content-pdf-sign`, `content-delete`), 1 new Vault secret (`PLAYBACK_SIGN_SECRET_V1`), 2 new private Storage buckets (`study-materials` ≤50 MB pdf+image; `profile-pictures` ≤5 MB image) with deny-all `storage.objects` policy. Mobile: rebuilt `(student)/library.tsx` as Subject→Chapter→Topic→Item navigation with search + per-view FlatList keys (post-QA fix #2) + `useFocusEffect` auto-refetch (post-QA fix #4); added `app/video/[contentId].tsx` (wrapped YT player + Resume sheet, threshold lowered to 10 s per post-QA fix #5) and `app/pdf/[contentId].tsx` (WebView + pdf.js body-scroll viewer + viewport watermark + page memory, `scrollEnabled=true` per post-QA fix #6); rebuilt `(teacher)/content.tsx` for video URL OR PDF presign+upload+finalize. Admin: `/content` moderation page with filter/search/publish toggle/promote/delete + CSV export (timestamp pinned to `en-IN`/IST per post-QA fix #1). Metro config now redirects `react-native-webview` to its `lib/` build AND extends SINGLETON dedup to subpath imports of `react-native` (post-QA fix #3 — D-159 superset). New shared libs: `_shared/{playback,youtube,watermark}.ts` + new mobile `lib/{yt-player,pdf,watermark}.ts` + components `live/{WrappedYtPlayer,Watermark,PdfWatermark}.tsx` + hooks `features/library/{useLibraryTree,useContentItem,useVideoProgress,usePdfProgress,useTeacherCurriculum}.ts`. Tests: 25/25 helper unit smokes (`pnpm test:content`), 7/7 RLS scenarios (`pnpm smoke:content-rls`), **30/30** edge-fn HTTP assertions (`pnpm smoke:content-fns`), 53/53 mobile jest, typecheck + lint green; advisor sweep cleared 0011 search_path on the new trigger. Manual test plan at `docs/phases/phase-5-manual-tests.md` + fresh fixture script `pnpm seed:content-manual-test`. **Nine** hard-learned lessons memorialised: D-166 (search_path on all new trigger fns), D-167 (pnpm patch hunk-header counts), D-168 (WebView+pdf.js over react-native-pdf for Expo Go), D-169 (video/pdf screens outside (student) tab group, mirrors D-157), D-170 (Supabase CLI deploy needs temp workdir when config.toml has legacy keys), D-171 (PDF signed URL via `content-pdf-sign` edge fn — direct `storage.createSignedUrl` blocked by deny-all storage RLS), D-172 (admin server-action mutations always through edge fn so `audit_log` captures before/after — see `content-delete`), **D-173 (no `controls=0` on YT iframe on mobile — autoplay-with-audio needs the visible play button as a user-gesture proxy)**, **D-174 (in-WebView PDFs must use body-level scroll AND leave `scrollEnabled=true` on iOS — inner `overflow:auto` wrapper breaks pinch-zoom origin, `scrollEnabled=false` disables pan-after-zoom)**. Phase 6 carry-overs: §G1 cold-start on Redmi 8A (hardware), §G3 long-session memory check + §G4 airplane-mode recovery (optional spot-checks), `YT_DATA_API_KEY` + `INSTITUTE_CHANNEL_ID` Vault provisioning (Phase 9 ops), bundle pdf.js locally (Phase 9 hardening), seed-script cleanup flag (test hygiene). Ledger in `docs/phases/phase-5.md §14`. Work sits uncommitted on `phase-4` branch pending the consolidated PR.
- **Phase 4 (Sessions & Attendance) ✅ done — 2026-05-18.** All thirteen checkpoints (CP1–CP13) green. 7 new migrations applied (`sessions_attendance`, `attendance_rls`, `qr_secret_accessor`, `qr_sign_attempts`, `qr_verify_attempts`, `materialize_sessions`, `realtime_attendance`), 7 new edge fns deployed (`attendance-qr-sign`, `attendance-qr-verify`, `attendance-correct`, `attendance-bulk-mark`, `attendance-manual-mark` per D-156, `attendance-unmark` per D-165, `session-create-ad-hoc`). 1 new Vault secret (`QR_TOKEN_SECRET_V1` per D-115), 1 new pg_cron job (`materialize-sessions-nightly`), 1 new Realtime publication member (`public.attendance`). Mobile student: rebuilt `(student)/attendance.tsx` with 30 s rotating QR + history; `(student)/index.tsx` wired to real `Today's Schedule` + attendance % (CP11). Mobile teacher: `(teacher)/scan.tsx` camera scanner with denied-fallback, `(teacher)/classes.tsx` segmented Today/Upcoming/Past + ad-hoc FAB, `app/roster/[sessionId].tsx` outside the (teacher) tab group per D-157 with pill marks + correction sheet + tap-active-toggles-to-unmarked per D-164. Admin `/attendance` matrix with correction modal + CSV export (CP12). RLS extended to 24/24 tests; HMAC secret in Supabase Vault; rate-limit RPCs (D-115). Ledger in `docs/phases/phase-4.md §14`. Five hard-learned lessons memorialised: (1) D-159 — Metro singleton dedup via `resolveRequest` override for `react` / `react-dom` / `react-native` / `expo-modules-core` because pnpm `shamefully-hoist` creates duplicate copies; (2) D-160 — `<CameraView>` must be an `absoluteFill` sibling, not parent, in SDK 54; (3) D-161 — `react-native-css-interop@0.2.3` `stringify` is patched in `patches/` because its `Object.entries` walk crashes on `@react-navigation`'s throwing getters; (4) D-162 — bypass css-interop for static-style subtrees that freeze by switching `className` to inline `style`; (5) D-158 — Metro hot-reload cannot propagate `_layout.tsx` edits or route file moves; full `pnpm dev:mobile -- --clear` restart + force-quit Expo Go required after route surgery. Phase 5 carry-overs: §B13–§B15 two-device QA, §E perf sanity + Redmi 8A cold-start (hardware), Vercel deployment fix, Sentry+PostHog wiring, `auth_leaked_password_protection` (Phase 1 backlog), `auth_rls_initplan` on `app_users` (Phase 1 backlog), `attendance-unmark` smoke test, `sessions.subject_id` backfill in `materialize_sessions`. Work sits uncommitted on `main` pending the consolidated Phase 2 + 3 + 4 PR.

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
