Everytime you code, don't just guess. Be precise; if in doubt, ask. Test everything (incl. Supabase backend) and make it perfect.

# FyneStudy — Coaching OS

> Hybrid coaching institute OS for JEE/NEET/CUET prep. One mobile app (students + teachers, role-gated). One web admin panel. One Supabase backend. Live classes via wrapped YouTube. Attendance via rotating QR. Practice quizzes + graded exams. Weekly parents' WhatsApp PDF.

## Status (mobile + backend phases)
Phase docs in `docs/phases/phase-N.md §14/§15`. Decisions in `docs/decisions.md`.

- **Phase 0 ✅** — UI scaffolding. Dead screens (OTP/verify/select-course) deleted in P2.
- **Phase 1 ✅ 2026-05-14** (PR #1, merge `bea08b2`). pnpm monorepo, Supabase `orqwyazvcthgxoadfxfv`, `health` edge fn, mobile `lib/`, Vercel admin `https://fyne-study-app-admin.vercel.app/`, CI, EAS. Deferred ACs: Sentry (#7), PostHog (#8), Android APK install (#15).
- **Phase 2 ✅ 2026-05-15.** Identity tables + RLS in `private` schema (D-146). 4 edge fns: `auth-bootstrap`, `auth-suspend` (D-147 `mode`), `auth-force-reset`, `auth-clear-must-change`. Admin login + TOTP + students CRUD. Mobile email+pw + force-pw-change + role gates; auth wrapped in `withTimeout` (D-148). Carry-overs: #3 TOTP recovery, #10 profile phone/DOB display, #19 Redmi 8A cold-start. Uncommitted on `main`.
- **Phase 3 ✅ 2026-05-15.** CP1-CP12 green. 6 migrations (courses_batches, students_batch_required, batch_rls, teacher_app_users_read, mfa_recovery_codes). 7 edge fns (`batch-transfer`, `curriculum-mutate`, `batch-mutate`, `auth-change-own-password`, `mfa-codes-issue`, `mfa-codes-consume`, `auth-bootstrap` v2). Admin: `/courses` `/batches` `/teachers` `/2fa/recovery` `/2fa/enroll` (10 SHA-256-hashed codes). Mobile: profile shows batch/course/phone/DOB read-only (closes P2 #10); teacher home lists batches; batch-detail roster RLS-scoped. Carry-overs to P4: Vercel deploy fix, P12-dep "Reset MFA" UI, Android cold-start, Sentry+PostHog, 16 perf-advisor INFOs. Lessons: **D-152** teacher batch-scope on `app_users` needed for `students(app_users!user_id(full_name))` embed; **D-153** mobile NEVER calls `supabase.auth.updateUser` in force-pw flow — use `auth-change-own-password` edge fn; **D-154** 30s `withTimeout` + post-timeout `sessionLanded()` fallback (iOS Expo Go slow Keychain write). Uncommitted on `main`.
- **Phase 4 ✅ 2026-05-18.** CP1-CP13 green. 7 migrations (sessions_attendance, attendance_rls, qr_secret_accessor, qr_sign_attempts, qr_verify_attempts, materialize_sessions, realtime_attendance). 7 edge fns (`attendance-qr-sign/-verify/-correct/-bulk-mark/-manual-mark` D-156, `-unmark` D-165, `session-create-ad-hoc`). 1 Vault secret `QR_TOKEN_SECRET_V1` (D-115); pg_cron `materialize-sessions-nightly`; Realtime += `public.attendance`. Mobile student: `(student)/attendance.tsx` 30s rotating QR + history; home wired to real Today's Schedule + attendance % (CP11). Teacher: `(teacher)/scan.tsx` camera + denied-fallback; `(teacher)/classes.tsx` segmented + ad-hoc FAB; `app/roster/[sessionId].tsx` outside `(teacher)` tabs (D-157) with pill marks + correction + tap-active-toggles-unmarked (D-164). Admin `/attendance` matrix + CSV (CP12). RLS 24/24; HMAC in Vault; rate-limit RPCs (D-115). Lessons: **D-159** Metro singleton dedup via `resolveRequest` override for `react`/`react-dom`/`react-native`/`expo-modules-core` (pnpm `shamefully-hoist` duplicates); **D-160** `<CameraView>` `absoluteFill` SIBLING not parent (SDK 54); **D-161** `react-native-css-interop@0.2.3` `stringify` patched (`Object.entries` crashes on `@react-navigation` throwing getters); **D-162** swap `className`→inline `style` for freezing static subtrees; **D-158** Metro hot-reload can't propagate `_layout.tsx`/route file moves — full `pnpm dev:mobile -- --clear` + force-quit Expo Go. Carry-overs to P5: §B13-B15 two-device QA, §E perf + Redmi 8A, Vercel fix, Sentry+PostHog, `auth_leaked_password_protection`, `auth_rls_initplan` on `app_users`, `attendance-unmark` smoke, `sessions.subject_id` backfill in materialize. Uncommitted on `main`.
- **Phase 5 ✅ 2026-05-19.** CP1-CP13 + iOS manual QA (§A-§E) green; §G/§H deferred; 6 post-QA patches landed same day. 5 migrations (content_library, content_rls, storage_content_buckets, playback_secret_accessor, content_updated_at_search_path). **9** edge fns (`content-presign-upload`, `content-finalize`, `content-create-video`, `yt-playback-sign`, `yt-thumb-sign`, `content-toggle-publish`, `content-promote-coursewide`, `content-pdf-sign`, `content-delete`). 1 Vault secret `PLAYBACK_SIGN_SECRET_V1`. 2 private buckets: `study-materials` ≤50MB pdf+image, `profile-pictures` ≤5MB image (deny-all `storage.objects`). Mobile: `(student)/library.tsx` Subject→Chapter→Topic→Item w/ search + per-view FlatList keys + `useFocusEffect`; `app/video/[contentId].tsx` (wrapped YT + Resume sheet 10s threshold); `app/pdf/[contentId].tsx` (WebView + pdf.js body-scroll + viewport watermark + page memory, `scrollEnabled=true`); `(teacher)/content.tsx` video URL OR PDF presign+upload+finalize. Admin `/content` filter/search/publish/promote/delete + CSV (en-IN/IST). Metro: redirect `react-native-webview` to `lib/` build + SINGLETON dedup extends to subpath imports of `react-native` (D-159 superset). Shared: `_shared/{playback,youtube,watermark}.ts`; mobile `lib/{yt-player,pdf,watermark}.ts`; components `live/{WrappedYtPlayer,Watermark,PdfWatermark}.tsx`; hooks `features/library/{useLibraryTree,useContentItem,useVideoProgress,usePdfProgress,useTeacherCurriculum}.ts`. Tests 25/25 + 7/7 RLS + 30/30 edge-fn + 53/53 jest. Seed `pnpm seed:content-manual-test`. Lessons: **D-166** search_path on new trigger fns; **D-167** pnpm patch hunk-header counts; **D-168** WebView+pdf.js > react-native-pdf for Expo Go; **D-169** video/pdf screens outside `(student)` tabs (mirrors D-157); **D-170** Supabase CLI deploy needs `--workdir` when config.toml has legacy keys; **D-171** PDF signed URL via `content-pdf-sign` edge fn (direct `storage.createSignedUrl` blocked by deny-all); **D-172** admin server-actions ALWAYS through edge fn for `audit_log` before/after; **D-173** NO `controls=0` on YT iframe on mobile (autoplay needs visible play button as gesture proxy); **D-174** in-WebView PDF body-scroll + `scrollEnabled=true` (inner `overflow:auto` breaks pinch-zoom origin; `scrollEnabled=false` disables pan-after-zoom). Carry-overs to P6: §G1 cold-start Redmi 8A, §G3 long-session memory + §G4 airplane-mode, `YT_DATA_API_KEY` + `INSTITUTE_CHANNEL_ID` Vault, bundle pdf.js locally, seed cleanup flag. Uncommitted on `phase-4`.
- **Phase 6 🟡 CODE-COMPLETE, MANUAL QA PENDING 2026-05-19.** ⚠ NOT manually verified — bugs in render/KaTeX/nav/modal/admin EXPECTED. CP1-CP13 code-complete + automated tests green. 4 migrations (question_bank, quizzes, quiz_rls, storage_exam_images). 5 edge fns (`quiz-start`, `quiz-submit`, `quiz-attempt-result`, `quiz-image-presign`, `quiz-admin-mutate`). 1 private bucket `exam-images` ≤5MB jpeg/png/webp. Mobile student `app/quiz/[id].tsx` 4-stage state machine (intro→attempt→result→solution) top-level (D-169); `MathText` mounts WebView only when math detected (D-178); debounced auto-save `quiz_answers`; server-anchored timer; nav grid; flag toggle; retake. Teacher: `(teacher)/quizzes.tsx` tab + `app/quiz-builder/[quizId].tsx` cascading topic picker + inline editor + "Add from bank". Dashboard wires `useWeakTopics`; library shows quizzes at topic level. Admin `/quizzes` + `/questions` CSV + filters + publish + archive + delete via `quiz-admin-mutate` (D-172). Tests: 27/27 (`pnpm test:quiz`), 12/12 RLS, 26/26 edge-fn, 53/53 jest. Decisions **D-175..D-178**. Seed `pnpm seed:quiz-manual-test --reset`. P7+ carry-overs: local KaTeX bundle, mastery-recompute wiring, component-jest, image-picker UX, Redmi 8A. Uncommitted on `phase-4`. **Do NOT mark done until QA signs off `docs/phases/phase-6-manual-tests.md`.**
- **Phase 7 ✅ 2026-05-21.** Server-timed graded MCQ exams: locked-down UI, server-anchored timer, tab-switch logging, manual/instant release, regrade-with-audit, offline scores. **3 migrations** (exams, exams_rls, exam_answers_deadline_cut). 9 edge fns (`server-time` `--no-verify-jwt`, `exam-start`, `exam-tab-switch`, `exam-submit`, `exam-release-results`, `exam-regrade`, `offline-score-upsert`, `exam-attempt-result`, `exam-admin-mutate`). Mobile: 4 top-level Stack screens per D-169 (`app/exam/[id].tsx`, `exam-builder/[examId].tsx`, `exam-results/[examId].tsx`, `offline-scores.tsx`), `(teacher)/exams.tsx` (teacher bar now 8 — crowded; P8 may consolidate), `TabSwitchBanner`, 13 hooks, `lib/edge-fn.ts`. Dashboard surfaces Exams above Weak Topics. Admin `/exams` + `/offline-scores` via `exam-admin-mutate` (D-172). Manual QA iOS + admin (§A-§E) → 6 patches; notably **D-183** server-time defense-in-depth (60s `useServerTimeOffset` resync + server-side `exam_answers` deadline cut), instant-exam re-open routing fix, atomic builder question-replace. Tests: 26/26 (`pnpm test:exam`) + RLS (T4b post-deadline-write 403 + T10 no-leak) + 26/26 edge-fn + 53/53 jest. Decisions **D-179..D-183**. Seed `pnpm seed:exam-manual-test --reset`. P8 carry-overs: real `mastery-recompute` (no-op stub in submits), consolidate Quizzes+Exams tabs, swap `(student)/classes.tsx` placeholder, component-jest, Redmi 8A. Uncommitted on `phase-4`.
- **Phase 8 🟡 CODE-COMPLETE, MANUAL QA PENDING 2026-05-21.** ⚠ Mobile + backend only (NO admin); render/realtime/heatmap/streak/next-card bugs EXPECTED. CP1-CP13 + automated tests green. **10 migrations** (mastery_streaks + _rls; DB fns `mastery_recompute`/`streak_recompute`/`student_dashboard`/`teacher_dashboard`/`teacher_batch_overview`; `video_progress_activity` trigger; `dashboard_cron`; `revoke_trigger_fn_execute`). 2 edge fns (`mastery-recompute`, `streak-recompute` — admin wrappers over DB fns) + `quiz-submit` v2 / `exam-submit` v3 inline mastery feeder. pg_cron: `streak-recompute` 02:00 IST + `mastery-sweep` 02:30 IST (DB fns direct, no pg_net). Mobile: rebuilt `(student)/{index,classes,profile,modal}.tsx` + `(teacher)/{index,batch/[id]}.tsx`; `features/dashboard/*` hooks (`supabase.rpc`) + `components/dashboard/*` (8) + `components/teacher/*` (PendingList, BatchHeatmap, TopicMasteryBars, AtRiskList); attendance-realtime + focus-refetch (sessions not in pub). Tests: 16/16 (`pnpm test:dashboard`), 9/9 RLS, 11/11 fns, jest 53/53; `student_dashboard` EXPLAIN 13.5ms. Decisions **D-184..D-189** (rolling-N EXISTS-dedup + per-attempt clamp; from-scratch gaps-and-islands streak; dashboard fns SECURITY DEFINER + own-or-admin guard accepting `authenticated_security_definer` WARN; deploy via `npx supabase functions deploy --workdir`; inline await mastery feeder; video≥50% SECURITY DEFINER trigger w/ EXECUTE revoked). Seed `pnpm seed:dashboard-manual-test --reset` (A1 Streak Star / A2 At Risk / A3 Fresh Start). P9+ carry-overs: Tests-tab consolidation, `live_class`/`upcoming_session` next-card → `/classes` until P9, add `sessions` to realtime pub if needed, mastery per-attempt drill-down, Redmi 8A. Uncommitted on `phase-4`. **Do NOT mark done until QA signs off.**
- **Phase 9 ✅ ACCEPTED 2026-05-27** (incl. §G real-OBS dry-run on iOS+Android). Mobile + backend only (NO admin). Post-QA bug-hunt: 5 mobile fixes + 1 RLS migration (`20260527101000_phase9_raise_hand_moderation`: banned can't raise hands; no resolved_by spoof); **3 LOW-sev edge-fn guards (golive-cancelled, stop-dup-message, yt-api retry-split) STAGED for P12 deploy** — see `phase-9.md §15.11`. **YouTube provisioned 2026-05-26: 5 Vault secrets (YT_CLIENT_ID/SECRET/REFRESH_TOKEN, INSTITUTE_CHANNEL_ID, YT_DATA_API_KEY) + published OAuth app (permanent refresh token) on dev TEMP channel "NOvA FX" `UCSa8awrJseI_8r_oZQjuvYQ` (live-enabled).** `yt-api.ts` returns real keys (no 503). Handover: `docs/phases/phase-9-youtube-client-handover.md`. NOTE: `smoke:live-fns` "503 not configured" assertion no longer holds. **3 migrations** (live_chat; `live_chat_rls` = `private.can_access_session/is_session_teacher/is_session_live` + policies + Realtime pub; `chat_message_trigger` = denormalize author + 5-msgs/30s rate-limit). **6 edge fns** (`yt-broadcast-create`, **`yt-broadcast-golive`** [flips `sessions.status='live'` since teachers lack direct UPDATE], `yt-broadcast-stop`, `yt-playback-sign` extended `kind=live|recording`, `chat-delete`, `chat-ban`) + `_shared/yt-api.ts` (OAuth refresh + broadcast/stream/bind/transition + 401-retry/5xx-backoff). Realtime pub += `chat_messages`, `raise_hand_events`, `chat_bans`. Mobile: top-level `app/live/[sessionId]`, `recording/[sessionId]`, `live-control/[sessionId]` (D-169; deleted `live-session.tsx`); `(teacher)/classes.tsx` Schedule-Live FAB + `ScheduleLiveSheet`; `(student)/classes.tsx` Live/Upcoming/Recorded segments; hooks `features/chat/useChatChannel` + `features/live/{useRaiseHand,useSessionState,usePlaybackSign,useLiveSession,chat-replay}`; components `live/{ChatPane,ChatComposer,RaiseHandButton,PinnedBanner,LobbyCountdown,ChatReplay}`; `WrappedYtPlayer` got `playbackRate`. Pin/announcement/end-of-class are `chat_messages` rows (`kind`); chat = direct RLS insert with author + rate-limit via 1 SECURITY DEFINER trigger; stream key never persisted (idempotent re-fetch via `boundStreamId`). Tests: `pnpm test:live` 9 grp, RLS 14, fns 34, jest 53/53. Decisions **D-190..D-196**. Seed `pnpm seed:live-manual-test --reset`. P12 carry-overs: deploy 3 staged guards + Redmi 8A live-session memory profile. Uncommitted on `phase-4`.
- **Phase 10 ✅ ACCEPTED 2026-05-27.** Mobile + backend only. Batch-scoped composite leaderboard (0.60Q + 0.25A + 0.15S, D-071) + 11 sticky badges + streak flame + celebration. On-device visual QA signed off + post-QA 4 mobile fixes (multi-badge confetti re-fire, double-celebration race, public-card crash guard, schedule-live batch default) + 1 SQL migration (`20260527100000_phase10_badge_fact_fixes`: early_bird excl cancelled, mastery attempt_count≥1, rollover temp-table guard) — see `phase-10.md §15.11`. CP1-CP12 + tests green. **12 migrations**: badges/badge_earnings; leaderboard_weekly/_alltime `security_invoker` views (client-revoked); `my_batch_leaderboard` SECURITY DEFINER RPC + own-batch/teacher/admin guard + tie-break; `evaluate_student_badges` + `leaderboard_weekly_rollover` SECURITY DEFINER (**EXECUTE revoked from authenticated**); leaderboard_snapshots; `streak_recompute` badge sweep; `badge-assets` bucket; **`student_dashboard` rank+recent_badges + `teacher_batch_overview` composite-risk** (deliberate P8-surface change); student_public_card. 3 edge fns (`badge-evaluate`, `leaderboard-weekly-rollover`, `badge-icon-sign`) + 3 redeployed feeders (inline eval, D-188). pg_cron `leaderboard-weekly-rollover` Sun 18:29 UTC (idempotent, D-106). 11 **PLACEHOLDER** badge SVGs in private bucket (D-200). Mobile: `(student)/leaderboard.tsx` + **Ranks tab** (student bar now 7) + `RankRow`/`RankBadge`/`ScopeTabs`/`LeaderboardCalcModal` + tap-row `student_public_card` modal; Profile→Badges grid + `BadgeEarnedModal` confetti + unseen-badge poll on focus; dashboard rank pill live + recent-badges strip; streak modal lists streak badges; teacher at-risk now composite<0.4. Tests: 60/60 (`pnpm test:leaderboard`), 14/14 RLS, 18/18 fns, jest 53/53; `my_batch_leaderboard` EXPLAIN 9.9ms. Decisions **D-197..D-202**. Seed `pnpm seed:leaderboard-manual-test --reset` (Topper #1/RunnerA #2/RunnerB #3/Streak Star 7d/At Risk <0.4/Centurion quiz_100; 3 unseen-badge celebrations). Uncommitted on `phase-4`.
- **Phase 11 ⏭️ SKIPPED** (D-203). Roadmap goes P10→P12. Drops Gupshup; `students.parent_phone` collected-but-unused; `docs/spec/parents-report.md` deferred.
- **Phase 12 🟡 CODE-COMPLETE & VERIFIED 2026-05-27.** **No new prod Supabase** — existing `fynestudy-dev` IS prod (cut ship time); Sentry/PostHog still deferred. Admin: real Overview (8 live metric cards + recent-activity feed, killed P2 placeholder); `/audit` (filter role/action/entity/date + pagination + before/after JSON dialog + CSV); `/admins` (owner-only via `auth-bootstrap`); `/students/import` (bulk CSV preview→loops `auth-bootstrap` + downloadable creds CSV); "Phase 11" labels removed; `apps/admin/lib/audit.ts` (`listRecentAudit`/`listAudit`/`resolveActorNames`). Mobile: **build-blocker fixed** — `eas.json` embeds `EXPO_PUBLIC_SUPABASE_URL` + publishable anon key in build `env` (was git-ignored `.env.local` only → would crash on launch) + `appVersionSource: remote`; `app.json` dropped unused `RECORD_AUDIO` (+ expo-camera `recordAudioAndroid:false` else plugin re-adds); **dead student `Menu` tab removed** (placeholder-only; student bar 7→6: Home·Classes·Library·Attendance·Ranks·Profile — Profile is sole settings/sign-out surface). Verified: typecheck + lint + admin `next build` + Supabase advisors (0 ERROR; known SECURITY-DEFINER + leaked-pw WARNs) green. Docs: `docs/play-store-upload-guide.md`, `docs/legal/privacy-policy.md`, `docs/phases/phase-12-manual-tests.md` (~1006-line §A-§J). **Pending (user):** Play Console acct, `eas build`, on-device QA, Play submission. Deferred: admin `/settings`, login IP lockout, Maestro E2E, Sentry/PostHog, `/privacy` Vercel route, P9/10 staged edge-fn deploys, `auth_leaked_password_protection`. Uncommitted on `phase-4`.

## Roadmap & current focus (updated 2026-05-27)
- **🚀 Launch playbook:** [`START-HERE.md`](START-HERE.md) (root) → `docs/play-store-upload-guide.md` → `docs/vercel-admin-deploy.md`. Owner+reviewer logins in `CREDENTIALS.local.md` (git-ignored). Prod DB reset clean (owner + badge catalog kept).
- **Now: Phase 12 (final).** ✅ Accepted: P1-5, 7, 9, 10. ⚠ P6 & P8 still 🟡 (manual QA in flight) — confirm sign-off before P12 demo sweep relies on quizzes/dashboards.
- **P11 skipped** (D-203) — drop "P11 prereq" + exclude parents-report from demo + remove WhatsApp Sentry alert + Gupshup rollback in `phase-12.md`.
- **P9 YouTube fully provisioned 2026-05-26** on dev TEMP "NOvA FX". Live-control has Copy buttons for RTMP server/key (phone→laptop). Two planned additive options: client-channel handover (`docs/phases/phase-9-youtube-client-handover.md`), own-channel picker (`docs/phases/phase-9-youtube-own-channel.md`, not built). Full setup+OBS: `docs/phases/phase-9-youtube-setup.md`.

## 🌐 Web App Conversion (`apps/web` — Phase 4 code-complete 2026-05-28 on `web-phase-1`)
Phase docs in root [`Phases/`](Phases/); start at `Phases/00-overview-and-architecture.md` (W-01..W-23 decisions). New conv per phase via [`Phases/PHASE-PROMPTS.md`](Phases/PHASE-PROMPTS.md). **Locked:** separate Next.js 15 + Tailwind 4 + shadcn 4.7 + `@supabase/ssr` cookie auth + TanStack Query + serwist PWA. Web equivalents (W-11..W-16): QR scan `@yudiel/react-qr-scanner`, QR display `qrcode.react`, video `react-youtube`, PDF `react-pdf`, math `katex`+`react-katex`, upload `<input type=file>`+presign. Screenshot-prevent not enforceable on web (W-20) — watermark only. Same hard rules: anon key only, privileged via edge fns, server-auth exam timer + QR, no `is_correct`/stream keys, private buckets via signed URLs, realtime cleanup on unmount. Only backend change: add web origin to Supabase Auth redirect URLs + edge-fn CORS.

- **Web P1 ✅ code-complete 2026-05-28** (QA in flight). Foundation: Next.js 15 + Tailwind 4 + shadcn + `@supabase/ssr` + middleware role gating + TanStack Query + serwist PWA + 15 Fyne primitives. 13/13 unit, 21 E2E (6 skipped pending multi-role/suspended), 25 routes, sw.js, no service-role-key in static bundle.
- **Web P2 ✅ code-complete 2026-05-28** (QA pending). Student surfaces: 9 routes (Dashboard, Profile 3-tab, Leaderboard, Attendance rotating QR, Classes shell, Library tree, Menu, `/video/[id]`, `/pdf/[id]`), 21 TanStack hooks, ~30 components, real-time attendance channel, lazy badge confetti, `react-youtube` + `react-pdf` w/ bundled pdfjs worker, 5-pos CSS-anim video watermark + 3×4 tiled diagonal PDF watermark, 10s/5s leading-edge throttles, URL-state library drill. 41/41 unit + new E2E (dashboard/profile/leaderboard/attendance/library/security), build clean, CSP extended for YT + pdf.js. Plan: `Phases/phase-2-manual-tests.md`. Honours D-016/061/070/153/171/172/173/174/186/200/202.
- **Web P3 ✅ code-complete 2026-05-28** (QA pending). Quiz (4-stage) + exam (5-stage locked). 2 routes (`/quiz/[id]`, `/exam/[id]` OUTSIDE `(protected)`/AppShell so no side-rail during attempts). 10 hooks (`useQuizStart/AutoSave/Submit/AttemptResult`, `useExamStart/AutoSave/Submit/AttemptResult/TabSwitchLogger/ServerTimeOffset/PreInfo`). 10 components (`MathText` via `katex`+`react-katex` per W-15+D-178, `QuestionCard`, `OptionRadio` 5-state, `NavigationGrid`, `FlagButton`, `TimerPill`, `SolutionCard`, `SubmitConfirmDialog`, `TabSwitchBanner`, `LockedResultCard`). Server-anchored countdown w/ 60s `server-time` resync + on-focus resync (D-183); tab-switch via Page Visibility API + `window.blur` fire-and-forget (D-182); instant-vs-manual release routing (D-181). Locked UI (`select-none` + `contextmenu preventDefault`); 250ms quiz / 500ms exam auto-save into `quiz_answers`/`exam_answers`; resume on refresh. Discovery: LibraryClient practice-quizzes→`/quiz/[id]`; StudentClasses exam rows→`/exam/[id]`; WeakTopicsList `quiz_id`→`/quiz/[id]`. 91/91 unit (15 files; +6: MathText, TimerPill, NavigationGrid, attemptHelpers, cacheKeySecurity scan, serverTimeOffset + formatRemainingMmSs, examTabSwitchLogger). 27 routes, build clean, 0 service-role matches in `.next/static`. Plan: `Phases/phase-3-manual-tests.md`. Honours D-178/179/180/181/182/183.
- **Web P4 ✅ code-complete 2026-05-28** (QA pending — full Track 4A + 4B). Track 4A (student live + recordings): 2 top-level routes (`/live/[sessionId]`, `/recording/[sessionId]` OUTSIDE `(protected)` per W-23/D-169). Track 4B (full teacher portal): 6 top-level FocusLayout routes (`/quiz-builder/[quizId]`, `/exam-builder/[examId]`, `/exam-results/[examId]`, `/offline-scores`, `/roster/[sessionId]`, `/live-control/[sessionId]`) + 6 `(protected)` teacher tabs (`/` teacher branch, `/scan` webcam QR, `/classes` teacher branch with Schedule-Live + Ad-hoc FABs, `/content` Video/PDF upload, `/quizzes`, `/exams`, `/batch` + `/batch/[id]`). 21 teacher hooks (`features/teacher/*` incl. `useScanVerify` 500ms debounce + dedup, `useRoster` realtime `teacher-roster-{id}`, `useTeacherDashboard` on-focus invalidate, `useSessionBans` realtime `bans-{id}`, mutations bundle wraps every edge-fn write so audit_log captures before/after). 14 teacher components (`ScannerOverlay`, `WebcamScanner` lazy `next/dynamic({ ssr:false })` GATED on `active`, `RosterRow`+`CorrectionDialog`, `SessionCreateSheet`, `CurriculumPicker`, `QuestionBankSheet`, `ConfirmDialog`, `ChatModerationMenu` Radix DropdownMenu kebab, `ExamRegradeDialog` 3-mode, plus `PendingList`/`AtRiskList`/`BatchHeatmap`/`TopicMasteryBars`). Webcam scan starts ONLY on Start-camera press (iOS Safari gesture safety) + Reset-camera re-mounts (`resetKey`++) for backgrounding recovery + permission-denied → roster fallback link. Live-control: Setup phase (broadcast-create + Copy buttons via `navigator.clipboard.writeText` + inline error+Retry keeps form state) → Live phase (tabbed Stream / Moderate — one YT iframe at a time) → End class ConfirmDialog → `yt-broadcast-stop`. **Stream key in `useState` ONLY** — never React Query / localStorage (asserted by source-scan test). Builder writes use direct RLS PostgREST writes — `quiz-admin-mutate`/`exam-admin-mutate` are admin-only (`isAdmin()` at line 36/38) so the kickoff prompt's "all via *-admin-mutate" was incorrect; mobile precedent applies. Atomic question-replace (upsert THEN delete; never empty). Middleware: added 6 teacher-only path prefixes; `/live`/`/recording` stay open to both roles. 196/196 unit tests (24 files; Track 4B +7: scanToastMapper 15, rosterCorrectionState 9, builderQuestionReplace 12, offlineScoreValidation 12, raiseHandQueue 5, cameraGesture 5, streamKeyNoCache 2). realtimeCleanupAudit grew 11→34 (auto-discovers Track-4B hooks). 36 routes, build clean, 0 service-role matches. Adds `@yudiel/react-qr-scanner`. New E2E specs (`teacher-{scan,classes,builders,results,roster,content}.spec.ts` + `live-control.spec.ts`). Honours D-152/157/164/169/172 (deviation logged W-DEC-4B.6)/173/179/181/190..196. Plan: `Phases/phase-4-manual-tests.md` 1908 lines (§A–§L + §M.3a audit + §N.2a responsive teacher screens + §O 196 + 36-route + §P 13 tickboxes). **Web app is now at full feature parity with the mobile app**; Phase 5 = hardening + Vercel + on-device QA + Sentry/PostHog. Uncommitted on `web-phase-1`.

## Authoritative docs (read these first)
| Question | Open |
|---|---|
| Product? | `docs/project.md` |
| Why did we decide X? | `docs/decisions.md` (source of truth when specs disagree) |
| Where's the file for X? | `docs/file-structure.md` |
| DB schema / RLS / edge fn? | `docs/backend-architecture.md` |
| How does feature X work? | `docs/spec/<feature>.md` |
| Performance budget? | `docs/spec/performance.md` |
| Security baseline? | `docs/spec/security.md` |
| Convert app to web? | `Phases/` (root) → `Phases/00-overview-and-architecture.md` then 1→5 |

## Tech Stack
| Layer | Choice |
|---|---|
| Mobile | RN 0.81 + Expo SDK 54, iOS + Android both first-class |
| Routing | Expo Router 6 (file-based) |
| Styling | NativeWind 4 + Tailwind 3 |
| Mobile build | EAS Build + EAS Update |
| Admin | Next.js 15 + Tailwind + shadcn/ui on Vercel |
| Backend | Supabase (Postgres + Auth + Storage + Realtime + Edge Functions), `ap-south-1` |
| Live stream | YouTube Live Unlisted, wrapped via `react-native-youtube-iframe` |
| Chat | Supabase Realtime |
| PDF | `pdf-lib` in Edge Functions |
| WhatsApp | Gupshup *(deferred — P11 skipped)* |
| Crash / Analytics / CI / Math | Sentry / PostHog / GitHub Actions / KaTeX |

## Roles & Onboarding
Admin issues every account. **No self-signup, ever.**
1. Admin enters student + assigns batch (course derived).
2. System creates Supabase auth user + emails creds.
3. Student logs in → forced password change on first login.
4. Same for teachers.
5. Students/teachers cannot change own `batch`, `course`, `email`, `phone`, `dob`, `full_name`, `parent_phone` — must ask admin (D-016; matrix in `spec/authentication.md §10A`).
6. Multi-role supported (teacher + staff_admin common).

| Role | Logs in via | MFA | Notes |
|---|---|---|---|
| `student` | Mobile | off | One batch at a time |
| `teacher` | Mobile | optional | Can be in multiple batches |
| `staff_admin` | Web | TOTP req | Ops; cannot manage admins or institute settings |
| `owner_admin` | Web | TOTP req | Everything |

## Module Map
| Feature | Spec | Primary mobile route | Edge fn(s) |
|---|---|---|---|
| Auth | `spec/authentication.md` | `app/login.tsx`, `app/force-password-change.tsx` | `auth-bootstrap`, `auth-suspend` |
| Student dashboard | `spec/student-dashboard.md` | `app/(student)/index.tsx` | `mastery-recompute` |
| Attendance | `spec/attendance.md` | `app/(student)/attendance.tsx`, `app/(teacher)/scan.tsx`, `app/(teacher)/roster/[id].tsx` | `attendance-qr-sign`, `attendance-qr-verify`, `attendance-correct` |
| Practice quizzes | `spec/practice-quizzes.md` | `app/(student)/quiz/[id].tsx` | `quiz-start`, `quiz-submit` |
| Exams | `spec/examinations.md` | `app/(student)/exam/[id].tsx`, `app/(teacher)/exam-builder.tsx` | `exam-start`, `exam-submit`, `exam-release-results`, `exam-regrade`, `exam-tab-switch` |
| Live + recordings | `spec/youtube-live-stream.md` | `app/(student)/live/[id].tsx`, `app/(teacher)/live-control/[id].tsx` | `yt-broadcast-create`, `yt-broadcast-stop`, `yt-playback-sign` |
| Library | `spec/study-materials.md` | `app/(student)/library.tsx`, `app/(student)/video/[id].tsx`, `app/(student)/pdf/[id].tsx` | `content-presign-upload`, `content-finalize`, `content-create-video` |
| Leaderboard | `spec/leaderboard-and-gamification.md` | `app/(student)/leaderboard.tsx`, `app/(student)/profile.tsx?tab=badges` | `streak-recompute`, `leaderboard-weekly-rollover`, `badge-evaluate` |
| Parents' report ⏭️ *(P11 skipped)* | `spec/parents-report.md` | (server only) | `parent-report-generate`, `whatsapp-send`, `gupshup-callback`, `whatsapp-retry` |
| Admin panel | `spec/admin-panel.md` | `apps/admin/app/(dashboard)/*` | all |
| Teacher panel | `spec/teacher-panel.md` | `app/(teacher)/*` | per feature |
| Security / Performance | `spec/security.md` / `spec/performance.md` | n/a | n/a |

## Hard rules — always
- **iOS + Android both** verified every change. Don't ship one ahead.
- **Every user-data table has RLS on.** Service-role key only in edge fns.
- **Every privileged write goes through an edge function.** No service-role from app code.
- **Every edge fn checks `app_users.is_active = true`** after JWT verify. Suspended users get 401 even with cached token (closes ≤1h leak after `auth-suspend`).
- **Every admin write → `audit_log`** row with before/after JSON (`apps/admin/lib/audit.ts → withAudit`).
- **No `console.log` in prod builds.** Babel strips it; write better.
- **No PII in Sentry events.** Scrubbed in `Sentry.beforeSend`.
- **All Storage buckets private.** Access via short-lived signed URLs only.
- **Server is sole truth for exam timer + QR validity.** Never trust device clock.
- **Mobile-first.** Test on a real low-end device (Redmi 8A class) before declaring done.

## Hard rules — never
- ❌ Add self-signup (even temporarily / behind a flag).
- ❌ Send `is_correct` to client during a quiz/exam attempt.
- ❌ Expose YouTube video IDs or stream keys to non-creators.
- ❌ App-layer encryption on PII columns (over-eng; breaks RLS).
- ❌ Bypass RLS via service-role from app code.
- ❌ Cron job without idempotency check.
- ❌ Commit a `.env*` or any secret.
- ❌ `git push --force` to `main`, `--no-verify`, or destructive ops without explicit OK.
- ❌ Self-edit input for any identity field (D-016).

## Low-end device rules (full in `spec/performance.md`)
- Reference: Redmi 8A class (Android 9, 2 GB RAM).
- Cold start ≤ 3s; transitions ≤ 200ms; bundle ≤ 35MB OTA.
- `FlatList`/`SectionList` for lists > 20 items.
- `expo-image` with explicit dimensions + `memory-disk` cache.
- Only one WebView (wrapped YT) mounted at a time. Unmount on blur.
- Always unsubscribe Realtime channels on unmount.
- Exam screen: no Reanimated, no charts, no images outside questions.
- Animations default 200ms; respect `isReduceMotionEnabled`.

## Where bugs hide
- **Auth not resuming on focus** → `apps/mobile/lib/supabase.ts` + `lib/secure-store.ts`. Refresh token from `expo-secure-store`, not AsyncStorage.
- **QR scan failing** → `attendance-qr-verify`. Check HMAC freshness + session match + replay constraint. Server clock authoritative.
- **Exam timer drift** → client syncs `server_now` on entry + every 60s. Display only; server enforces cut.
- **Live class blank** → check `yt-playback-sign` payload, then `react-native-youtube-iframe` log; verify YT broadcast `status='live'`.
- **WebView memory creep** → cleanup on unmount; only one mounted; PostHog `live_class_left` should fire.
- **Realtime "ghost" subs** → grep `supabase.channel(` without matching `removeChannel`.
- **WhatsApp `template_param_error`** → variable count in payload must match approved Gupshup template exactly.
- **RLS empty result where data exists** → policies don't union; check helper `current_app_user_id()` non-null; verify `auth.uid()` present.
- **Mastery stale** → trigger `mastery-recompute` manually or wait for nightly cron; recompute is idempotent.

## When making changes
1. Find the spec (`docs/spec/<feature>.md`).
2. Check `docs/decisions.md` for binding constraints.
3. Trace data flow in `docs/backend-architecture.md`.
4. Order: schema migration → edge fn → mobile feature → UI.
5. Add/update tests next to source as `*.test.ts`.
6. Does this write deserve an `audit_log` row?
7. Run `pnpm typecheck && pnpm lint && pnpm test` before PR.

## Coding conventions
- TS strict. No `any` without justification comment.
- No comments explaining *what* — code says it. Only *why* when non-obvious.
- Files kebab-case. Components PascalCase. Hooks `useFoo`. Edge fns `verb-noun`. DB tables `snake_case` plural.
- Server state: TanStack Query. Client state: `useState`/`useReducer`; Zustand only if cross-cutting.
- Forms: react-hook-form + zod schemas from `packages/shared/validation/`.
- Path aliases `@/*` rooted at app root.

## Asking for guidance
- Where X implemented → spec first.
- Why we did X → `docs/decisions.md`.
- New feature → write `docs/spec/<name>.md`, link in module map, then code.
- Change a decision → new dated entry in `decisions.md` referencing superseded one. **Never delete.**

## Demo & doubt
- Demo flow + seed + accounts in `docs/project.md §9`. Demo must be boringly reliable.
- Reliability > cleverness · Server enforcement > client trust · Smaller bundles > richer animations · Documented > undocumented · Boring tech > novel tech.

## File entry points
- Mobile: `apps/mobile/app/_layout.tsx`
- Admin: `apps/admin/app/layout.tsx`
- Edge fns: `apps/functions/*/index.ts`
- Migrations: `supabase/migrations/`
- Shared: `packages/shared/`, `packages/supabase-types/`

## Help
- `/help` for Claude Code. Issues: https://github.com/anthropics/claude-code/issues.
