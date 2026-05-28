# Phase Kickoff Prompts — copy-paste these into a NEW conversation

> **What this file is:** five ready-to-paste prompts, **one per phase**. Open a new Claude Code conversation when starting each phase, paste the corresponding block (everything inside the fenced ` ```markdown ... ``` ` box) as your first message, and that conversation will execute exactly that phase.
>
> **Order:** Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5. Each new conversation is started **only after the previous phase is fully accepted** (its acceptance ledger ticked + manual tests signed off).
>
> **Why one conversation per phase:** keeps context small and focused, prevents drift, and matches the mobile project's per-phase discipline.

---

## How to use (every phase)

1. Open a **new** Claude Code conversation in this repo (the project's `CLAUDE.md` + `MEMORY.md` auto-load — the new Claude already knows the product).
2. Copy the **entire** content inside the fenced block for the phase you're starting.
3. Paste it as your very first message.
4. Let it work. When it stops at the "STOP" condition, the phase is done. Verify the acceptance ledger before moving on.

**Common pre-conditions for every phase prompt (Claude will check these too):**
- The current git branch is `web-phase-1` (we use one long-lived branch for the whole web track — commit per phase, don't merge to `main` without your OK).
- The previous phase's acceptance ledger is green (Phase 1 has none; phases 2–5 check the prior).
- `pnpm install` is clean at the repo root.

---

## Prompt 1/5 — Phase 1: Foundation, Auth & App Shell

```markdown
I'm continuing the FyneStudy Web App Conversion. We're executing **Phase 1 — Foundation, Auth & App Shell** today. This is a NEW conversation, so orient yourself before touching any code.

# Step 0 — READ THESE FIRST (in order)
1. `CLAUDE.md` — especially the "🌐 Web App Conversion track" section. Confirms hard rules + locked decisions.
2. `Phases/README.md` — folder index.
3. `Phases/00-overview-and-architecture.md` — the FULL A-to-Z analysis (screen inventory, design tokens, data contract) + the W-01..W-23 engineering decisions table.
4. `Phases/phase-1-foundation-auth-shell.md` — the phase doc you are executing. This is the source of truth for *what to build and how*.
5. The mobile source files referenced in the phase doc — at minimum: `apps/mobile/lib/supabase.ts`, `lib/secure-store.ts`, `lib/edge-fn.ts`, `app/_layout.tsx`, `app/index.tsx`, `app/login.tsx`, `app/forgot-password.tsx`, `app/reset.tsx`, `app/force-password-change.tsx`, `app/suspended.tsx`, `app/admin-redirect.tsx`, `app/role-chooser.tsx`, `features/auth/SessionProvider.tsx`, `features/auth/auth.ts`, `components/FyneStudyLogo.tsx`, `components/SplashOverlay.tsx`, `constants/theme.ts`, `tailwind.config.js`. Open as many as you need for design fidelity.
6. The admin template you'll mirror: `apps/admin/package.json`, `apps/admin/tsconfig.json`, `apps/admin/postcss.config.mjs`, `apps/admin/components.json`, `apps/admin/app/globals.css`, `apps/admin/app/layout.tsx`, `apps/admin/middleware.ts`, `apps/admin/lib/supabase-server.ts`, `lib/supabase-browser.ts`, `lib/supabase-middleware.ts`, `lib/auth.ts`.
7. The mobile decisions referenced in the gotchas: `docs/decisions.md` (D-016, D-152, D-153, D-154, D-173, D-174, D-183) — the hard-won lessons we must NOT re-learn.

# Locked decisions (DO NOT relitigate)
- Separate Next.js 15 app at `apps/web`, mirroring `apps/admin`.
- Full parity (students + teachers); admins are redirected to the admin panel.
- Responsive desktop layout: side-rail + multi-column on `lg+`, bottom-tabs on mobile-web.
- Installable PWA via `@serwist/next`.
- `@supabase/ssr` cookie auth (httpOnly) — NOT mobile's localStorage model.
- Tailwind 4 + shadcn 4.7; mobile palette ported as CSS vars.
- TanStack Query (client) for data; Server Components only for shell/auth.
- Engineering defaults W-01..W-23 (see `Phases/00-overview-and-architecture.md` §4) — follow them.
- Git branch: `web-phase-1` (one branch for the whole web track; commit at end of each phase; don't merge to main without explicit OK).

# Hard rules (carry over from mobile — non-negotiable)
- **Anon key only** in `apps/web`. The service-role key MUST NEVER appear in the web bundle.
- All privileged writes go through edge functions (the same 51 fns the mobile app + admin already use). No service-role from app code.
- Every Storage bucket is private — access via short-lived signed URLs (via `*-sign` edge fns).
- Server is the only source of truth for the exam timer + QR validity (Phase 3 concern; just don't break the foundations here).
- Never send `is_correct` to the client during an attempt.
- Every realtime channel subscribe has a matching `removeChannel` on unmount.
- Be precise. Don't guess. **If you have any doubt, ask me first.** (Per the project's `CLAUDE.md` first line.)

# Your task — execute Phase 1 EXACTLY per `Phases/phase-1-foundation-auth-shell.md`
Build sections A → I in order:
- **A** scaffold `apps/web` (versions pinned to admin's; add Vitest + Playwright test deps + scripts).
- **B** design tokens + the FyneStudy primitive components (FyneLogo, SplashOverlay, AppShell, SideRail, BottomTabs, TopBar, ProfileMenu, PageHeader, EmptyState, Segmented, StatusBadge/Pill, ListRow).
- **C** `@supabase/ssr` clients + `middleware.ts` role machine + `lib/auth.ts` + `lib/edge-fn.ts` (preserves non-2xx status — needed for 423/409/429).
- **D** all 8 auth/entry screens (login, forgot, reset, force-password-change, suspended, admin-redirect, role-chooser, root `/` redirect).
- **E** responsive app shell + role-aware nav + ProfileMenu/sign-out + `FocusLayout` stub.
- **F** PWA manifest + service worker + iOS PWA meta.
- **G** Supabase Auth redirect URLs + edge-fn CORS (add localhost + the Vercel URL).
- **H** deploy first build to a NEW Vercel project rooted at `apps/web`.
- **I** error.tsx / not-found.tsx / loading.tsx + `/privacy` (renders `docs/legal/privacy-policy.md`) + `/terms` + test harness (Vitest + Playwright + the sample tests in the phase doc).

# Verification — DO NOT skip
- `pnpm --filter @fynestudy/web typecheck && pnpm --filter @fynestudy/web lint && pnpm --filter @fynestudy/web test && pnpm --filter @fynestudy/web build` must all be green.
- Playwright `e2e/auth.spec.ts` covers every case in the phase doc's "Automated tests" section.
- RLS smoke script per the phase doc.
- Lighthouse: PWA installable = pass.
- **Write a `Phases/phase-1-manual-tests.md`** (click-by-click, mirroring the format of `docs/phases/phase-N-manual-tests.md` in the mobile docs) covering every numbered item in the phase doc's "Manual test checklist". Walk it through on Chrome desktop + iOS Safari + Android Chrome and fill PASS/FAIL inline. **Wait for me to sign off the manual tests before declaring Phase 1 accepted.**

# Acceptance
- Tick every box in the phase doc's "Acceptance criteria" section.
- Append an acceptance ledger (date, what landed, any `W-DEC` decisions, any carry-overs) to the BOTTOM of `Phases/phase-1-foundation-auth-shell.md`.
- Update `CLAUDE.md`'s "🌐 Web App Conversion track" with "Phase 1 ✅ — <date>" and a one-line summary.
- Save a memory file `project_web-phase-1-status.md` (in the project memory dir) summarising what landed + any W-DECs; add the one-line pointer to MEMORY.md.

# Stop condition
- When Phase 1 is fully accepted (acceptance ledger green + manual tests signed off + memory updated), **STOP**.
- Do NOT start Phase 2. I'll open a new conversation with the Phase 2 prompt.

If anything is ambiguous or any decision feels wrong as you go, ASK me before deviating.
```

---

## Prompt 2/5 — Phase 2: Student Learning Surfaces

```markdown
I'm continuing the FyneStudy Web App Conversion. We're executing **Phase 2 — Student Learning Surfaces** today. This is a NEW conversation, so orient yourself before touching any code.

# Step 0 — READ THESE FIRST (in order)
1. `CLAUDE.md` — "🌐 Web App Conversion track" section.
2. `Phases/README.md` + `Phases/00-overview-and-architecture.md` (skim if recall is fresh; re-read §2.3 design tokens + §4 W-01..W-23 decisions).
3. `Phases/phase-1-foundation-auth-shell.md` — **verify its acceptance ledger is green**. If Phase 1 isn't accepted, STOP and tell me to finish Phase 1 first.
4. `Phases/phase-2-student-learning-surfaces.md` — the phase doc you are executing.
5. The memory file `project_web-phase-1-status.md` — to know exactly what Phase 1 shipped (so you don't duplicate or skip).
6. Mobile source files for the screens we're porting (open each as you build the corresponding web screen):
   - Dashboard: `apps/mobile/app/(student)/index.tsx` + every `apps/mobile/components/dashboard/*` + `apps/mobile/app/modal.tsx` (streak modal).
   - Profile: `apps/mobile/app/(student)/profile.tsx` + components/gamification (`BadgeIcon`, `BadgeShowcase`, `BadgeEarnedModal`).
   - Leaderboard: `apps/mobile/app/(student)/leaderboard.tsx` + `apps/mobile/components/leaderboard/*`.
   - Attendance: `apps/mobile/app/(student)/attendance.tsx` + `apps/mobile/components/attendance/*` + `apps/mobile/features/attendance/{useQrToken,useAttendanceHistory,useAttendanceRealtime,useTodaySessions}.ts`.
   - Library + players: `apps/mobile/app/(student)/library.tsx`, `app/video/[contentId].tsx`, `app/pdf/[contentId].tsx`, `lib/yt-player.ts`, `lib/pdf.ts`, `lib/watermark.ts`, `components/live/{WrappedYtPlayer,Watermark,PdfWatermark}.tsx`, `features/library/*`.
   - Menu: `apps/mobile/app/(student)/menu.tsx`.
   - All `apps/mobile/features/dashboard/*` + `features/gamification/*` + `features/leaderboard/useLeaderboard.ts`.
7. The relevant decisions in `docs/decisions.md`: D-016 (read-only identity fields), D-061 (watermark + screen-capture intent), D-070 (rolling-N mastery), D-153 (auth-change-own-password), D-171 (PDF via `content-pdf-sign`), D-173 (no `controls=0` on YT), D-186 (dashboard RPCs SECURITY DEFINER), D-200 (placeholder badge SVGs).
8. `docs/spec/student-dashboard.md`, `spec/attendance.md`, `spec/study-materials.md`, `spec/leaderboard-and-gamification.md` (skim if any behaviour is unclear).

# Locked decisions + hard rules
Same as Phase 1. Re-read the "Locked decisions" and "Hard rules" sections of `Phases/PHASE-PROMPTS.md` Prompt 1/5 if you need a refresher. Critical reminders for THIS phase:
- TanStack Query for ALL data hooks (no useState/useEffect data-fetching).
- Realtime channels MUST have `removeChannel` cleanup; on event, invalidate the matching Query (W-22).
- Only one media player mounted at a time; unmount on navigate/blur.
- Throttle progress writes: 10s video, 5s PDF.
- Storage is private — PDF URL via `content-pdf-sign`, YT video_id via `yt-playback-sign`, badge icons via `badge-icon-sign`.
- Identity fields are READ-ONLY on profile (D-016).
- Web does NOT enforce screenshot prevention (W-20) — watermark only.

# Git
Continue on the `web-phase-1` branch. Commit at the end of the phase. Don't merge to main.

# Your task — execute Phase 2 EXACTLY per `Phases/phase-2-student-learning-surfaces.md`
Build in order:
- **A** Port ~18 mobile hooks to TanStack Query + realtime (`features/<area>/<hook>.ts`).
- **B** Dashboard (`(student)/`): NextCard, StatsStrip, TodayScheduleStrip, WeakTopicsList, ContinueStrip, RecentBadgesStrip, StreakFlame + BadgeEarnedModal celebration + StreakModal. Desktop = 2-column grid.
- **C** Profile (3 tabs) + Menu — identity is read-only (D-016); change-password uses `auth-change-own-password`.
- **D** Leaderboard with ScopeTabs + RankRow + public-card dialog + calc modal. Carry the public-card crash guard.
- **E** Attendance (`qrcode.react` + 30s rotation + realtime mark + history rings).
- **E2** Classes-tab shell (segmented Live/Upcoming/Recorded + Exams section; only Upcoming works in P2, others are placeholders to be filled in P3/P4).
- **F** Library tree + search + video player (`react-youtube` + Watermark + resume via `video_progress`) + PDF viewer (`react-pdf` + PdfWatermark + page-resume).

# Verification — DO NOT skip
- `pnpm --filter @fynestudy/web typecheck && lint && test && build` green.
- Unit tests for: library tree builder, QR rotation timer, progress-throttle, leaderboard row mapping, mastery color thresholds.
- Playwright E2E: dashboard renders all sections for the seed student; profile tabs switch; leaderboard scope toggle + public-card dialog; attendance QR appears + rotates; library drill-down opens a video and a PDF; resume works.
- **Write `Phases/phase-2-manual-tests.md`** covering every item in the phase doc's "Manual test checklist". Walk it on Chrome desktop + iOS Safari + Android Chrome. **Wait for me to sign off before declaring done.**
- Seed data: run `pnpm seed:dashboard-manual-test --reset` (or the equivalent setup) so the dashboard has real values.

# Acceptance
- Tick every box in the phase doc's "Acceptance criteria" section.
- Append the acceptance ledger to `Phases/phase-2-student-learning-surfaces.md`.
- Update `CLAUDE.md` web-conversion section with "Phase 2 ✅ — <date>".
- Save `project_web-phase-2-status.md` memory + add the MEMORY.md pointer.

# Stop condition
- When Phase 2 is fully accepted, **STOP**. Do NOT start Phase 3.

If anything is ambiguous, ASK me first.
```

---

## Prompt 3/5 — Phase 3: Practice Quizzes + Graded Exams (KaTeX)

```markdown
I'm continuing the FyneStudy Web App Conversion. We're executing **Phase 3 — Assessments (Quizzes + Exams)** today. This is the highest-correctness phase — the server is the only source of truth for the exam timer and `is_correct` MUST NOT reach the client during an attempt.

# Step 0 — READ THESE FIRST (in order)
1. `CLAUDE.md` web-conversion section.
2. `Phases/00-overview-and-architecture.md` (re-read §2.4 data contract + §4 decisions).
3. **Verify Phase 1 and Phase 2 acceptance ledgers are GREEN** (`Phases/phase-1-*.md` and `Phases/phase-2-*.md`). If not, STOP and tell me.
4. `Phases/phase-3-assessments-quizzes-exams.md` — the phase doc you are executing.
5. `project_web-phase-1-status.md` + `project_web-phase-2-status.md` memory files.
6. Mobile source files — open each as you port:
   - Quiz: `apps/mobile/app/quiz/[id].tsx`, every `components/quiz/*`, `features/quiz/{useQuizStart,useQuizAutoSave,useQuizSubmit,useQuizAttemptResult,useQuizDiscovery,useWeakTopics}.ts`.
   - Exam: `apps/mobile/app/exam/[id].tsx`, `components/exam/TabSwitchBanner.tsx`, `features/exam/{useExamStart,useExamAutoSave,useExamSubmit,useExamAttemptResult,useExamTabSwitchLogger,useServerTimeOffset,useStudentExams}.ts`.
   - Math: `apps/mobile/components/quiz/MathText.tsx` (we replace the WebView with native KaTeX).
7. Decisions (read in `docs/decisions.md`): **D-178** (math only when delimiters detected), **D-179** (full-recompute regrade — read for awareness; regrade is teacher-side, Phase 4), **D-181** (instant vs manual release; instant re-open routes to result), **D-182** (tab-switch fire-and-forget + silent-on-submitted), **D-183** (server-time defense-in-depth: client 60s resync + server-side deadline cut).
8. `docs/spec/practice-quizzes.md` and `spec/examinations.md` if anything is unclear.

# Locked decisions + hard rules (CRITICAL FOR THIS PHASE)
- **Never** request or render `is_correct` during an attempt. `quiz-start`/`exam-start` return questions without correctness; only `*-attempt-result` (post-submit / after release) exposes solutions.
- **Server is the timer authority.** `useServerTimeOffset` calls `server-time` on entry + every 60s. Auto-submit at remaining ≤ 0 on the client is *convenience*; the server cuts late writes via the `exam_answers` deadline RLS.
- Web equivalent of `AppState` background-detection = `document.visibilitychange → hidden` + `window.blur`. Use this for the exam tab-switch logger.
- Locked exam UI: no nav rail/tabs (use `FocusLayout`), minimal chrome; disable text-selection/context-menu on the question area (best-effort deterrent only).
- **Resume on refresh:** re-entering the same in-progress attempt must use the same server deadline, not restart.
- Instant exam re-open MUST route to the **result** stage, not restart the attempt (mobile shipped a bug here — don't repeat it).
- Auto-save debounce: quiz 250ms, exam 500ms (match mobile).
- Math: render only when `$…$` or `$$…$$` is detected (same heuristic as mobile `MathText.tsx`).
- All other hard rules from prior phases apply.

# Git
Continue on `web-phase-1` branch. Commit at the end of the phase.

# Your task — execute Phase 3 EXACTLY per `Phases/phase-3-assessments-quizzes-exams.md`
- **A** KaTeX `MathText` (`katex` + `react-katex`); import `katex/dist/katex.min.css`; unit-test against mobile fixtures.
- **B** Quiz `quiz/[id]` 4-stage state machine (intro → attempt → result → solution) with auto-save + resume + grading.
- **C** Exam `exam/[id]` 5-stage (pre → attempt → submitted → result → solution): server-anchored timer + 60s resync, tab-switch via Page Visibility API, auto-submit, **locked UI**, manual/instant release handling, 423-locked-result polling, atomic resume.
- **D** Discovery: wire the Phase-2 placeholders — exam list in classes tab (`useStudentExams`), per-topic quizzes in library, dashboard weak-topics (`useWeakTopics`).

# Verification — DO NOT skip
- `pnpm --filter @fynestudy/web typecheck && lint && test && build` green.
- Unit tests: MathText parser; timer remaining computation with mocked offset; navigation-grid state mapping; auto-submit trigger at remaining ≤ 0.
- Playwright E2E:
  - Quiz: start → answer → flag → submit → result → solution; refresh mid-attempt resumes.
  - Exam: start → answer → switch tab (banner + logged switch) → timer expires → auto-submit; locked result 423; after release shows score.
  - **Security assertion E2E:** intercept network during the attempt and assert NO response contains `is_correct` / option-correctness anywhere.
  - **Clock-skew test:** fake timers ahead of the server deadline; assert a late `exam_answers` write is rejected (server deadline cut).
- **Write `Phases/phase-3-manual-tests.md`**, walk on Chrome desktop + iOS Safari + Android Chrome. Wait for sign-off.
- Seed: `pnpm seed:quiz-manual-test --reset` and `pnpm seed:exam-manual-test --reset`.

# Acceptance
- Tick every box. Append the acceptance ledger to `Phases/phase-3-*.md`.
- Update `CLAUDE.md` with "Phase 3 ✅".
- Save `project_web-phase-3-status.md` + MEMORY.md pointer.

# Stop condition
- When Phase 3 is fully accepted, **STOP**. Do NOT start Phase 4.

If anything is ambiguous (especially around the timer / release / tab-switch behavior), ASK me before guessing.
```

---

## Prompt 4/5 — Phase 4: Live Classes + Teacher Portal (full parity)

```markdown
I'm continuing the FyneStudy Web App Conversion. We're executing **Phase 4 — Live Classes + Teacher Portal** today. This is the LARGEST phase — it finishes student-side live/recordings AND builds the entire teacher experience, including the **browser webcam QR scanner**. After this phase the web app is at full feature parity with the mobile app.

# Step 0 — READ THESE FIRST (in order)
1. `CLAUDE.md` web-conversion section.
2. `Phases/00-overview-and-architecture.md` (re-read §2.4 data contract — esp. the teacher edge fns; §5 native→web equivalents).
3. **Verify Phases 1–3 acceptance ledgers are GREEN.** If any aren't, STOP and tell me.
4. `Phases/phase-4-live-classes-teacher-portal.md` — the phase doc you are executing.
5. `project_web-phase-{1,2,3}-status.md` memory files.
6. Mobile source files — open as you build each track:
   - **Live (4A):** `apps/mobile/app/live/[sessionId].tsx`, `recording/[sessionId].tsx`, every `components/live/*` (ChatPane, ChatComposer, RaiseHandButton, PinnedBanner, LobbyCountdown, ChatReplay, WrappedYtPlayer, Watermark), `features/live/*` (useLiveSession, usePlaybackSign, useRaiseHand, useSessionState, useSessionBans, chat-replay), `features/chat/useChatChannel.ts`.
   - **Teacher portal (4B):** every `apps/mobile/app/(teacher)/*.tsx`, `app/quiz-builder/[quizId].tsx`, `app/exam-builder/[examId].tsx`, `app/exam-results/[examId].tsx`, `app/offline-scores.tsx`, `app/roster/[sessionId].tsx`, `app/live-control/[sessionId].tsx`, every `components/teacher/*` (PendingList, BatchHeatmap, TopicMasteryBars, AtRiskList, RosterRow, ScannerOverlay, AdhocSheet, ScheduleLiveSheet), `features/dashboard/{useTeacherDashboard,useTeacherBatchOverview}.ts`, `features/attendance/{useCameraPermission,useScanVerify,useRoster,useTeacherSessions}.ts`, `features/quiz/{useTeacherQuizzes,useTeacherQuizBuilder,useQuestionBank}.ts`, `features/exam/{useTeacherExams,useTeacherExamBuilder,useExamResultsBoard,useOfflineScores,useBatchSubjects}.ts`, `features/library/useTeacherCurriculum.ts`, `features/org/{useAssignedBatches,useMyBatch}.ts`.
7. Decisions: **D-115** (QR HMAC + rate-limit RPC), **D-152** (teacher batch-scope on `app_users` for embed joins), **D-156** (manual-mark fn), **D-157/D-169** (routes outside tab group for focused screens), **D-164** (tap-active-pill toggles to unmarked), **D-165** (attendance-unmark), **D-172** (admin/teacher mutations via edge fn so audit captures before/after), **D-173** (no `controls=0` on YT), **D-179** (full-recompute regrade), **D-181** (instant vs manual release), **D-190..D-196** (live: chat trigger rate-limit; raise-hand RLS; stream key never persisted; `yt-broadcast-golive` flips status), and the **2026-05-27 Phase 9+10 QA hardening** memory entry.
8. `docs/spec/youtube-live-stream.md`, `spec/attendance.md`, `spec/teacher-panel.md`, `spec/admin-panel.md` (latter for audit pattern parity).

# Locked decisions + hard rules (CRITICAL FOR THIS PHASE)
- **Webcam needs HTTPS + a user gesture.** Start the camera on a button press, not on mount. `playsinline`, `facingMode: 'environment'` for rear camera on phones. Permission-denied fallback → manual-mark via the roster screen.
- **Chat is a direct RLS insert** with rate-limit + denormalize enforced by the SECURITY DEFINER trigger. Do NOT also write author fields from the client.
- **Banned students** can't raise hands, can't post; reflect live via `useSessionState` (Phase-9 RLS fix).
- **Stream key is never persisted** — idempotent re-fetch via `boundStreamId`.
- All teacher mutations go through edge fns (D-172) — direct table writes are forbidden (audit would miss them).
- Realtime cleanup is mandatory on every channel.
- Only one YouTube player mounted in any view at a time.
- All other hard rules from prior phases apply.

# Git
Continue on `web-phase-1` branch. Suggest committing twice — once after Track 4A (live), once after Track 4B (teacher) — to keep history readable.

# Your task — execute Phase 4 EXACTLY per `Phases/phase-4-live-classes-teacher-portal.md`
Split into two tracks; QA each before moving on:

**Track 4A — Live + recordings (student-facing):**
- `live/[sessionId]` lobby→live with chat + raise-hand + pinned + end-of-class + reconnect-reload.
- `recording/[sessionId]` with chat replay + playbackRate.
- Wire the Phase-2 placeholder Live/Recorded segments in `(student)/classes`.

**Track 4B — Teacher portal:**
- Teacher home, scan (webcam QR), classes (schedule-live + ad-hoc), content upload, quizzes + quiz-builder, exams + exam-builder + exam-results (release + regrade), offline-scores, batch list + analytics, roster, live-control.

# Verification — DO NOT skip
- `pnpm --filter @fynestudy/web typecheck && lint && test && build` green.
- Unit tests: chat-replay offset sync; scan-result status→toast mapping; roster correction state; builder question-replace; offline-score validation; raise-hand queue ordering.
- Playwright E2E:
  - Student live (simulated `status='live'`): lobby → player + chat insert (rate-limit at 6th msg/30s) + raise-hand; banned user can't post/raise.
  - Recording: replay reveals messages by time; 1.5x/2x work.
  - Teacher: schedule live → defaults to teacher's batch (carry the Phase-10 fix); upload a PDF (presign→PUT→finalize); build+publish quiz (image presign) + exam; release + regrade an exam; offline scores save; roster correction toggles; live-control create→copy key→go-live→end.
  - **Webcam QR E2E:** mock `getUserMedia` + feed a known QR frame → assert `attendance-qr-verify` called + success toast; denied permission → fallback shown.
- **Write `Phases/phase-4-manual-tests.md`** — and walk it including ONE REAL OBS→YouTube dry-run (per the mobile Phase-9 §G discipline). Wait for sign-off.
- Seed: `pnpm seed:live-manual-test --reset`.

# Acceptance
- Tick every box. Append the ledger to `Phases/phase-4-*.md`.
- Update `CLAUDE.md` with "Phase 4 ✅ — full parity reached".
- Save `project_web-phase-4-status.md` + MEMORY.md pointer.

# Stop condition
- When Phase 4 is fully accepted, **STOP**. Do NOT start Phase 5.

If anything is ambiguous (especially around the webcam scanner, live-control state machine, or builder edge-fn shapes), ASK me first.
```

---

## Prompt 5/5 — Phase 5: Hardening, QA & Launch

```markdown
I'm continuing the FyneStudy Web App Conversion. We're executing **Phase 5 — Hardening, QA & Launch** today. This is the FINAL phase — no new features. After this we ship.

# Step 0 — READ THESE FIRST (in order)
1. `CLAUDE.md` web-conversion section.
2. **Verify Phases 1–4 acceptance ledgers are GREEN.** If any aren't, STOP and tell me. (Phase 4 should be marked "full parity reached".)
3. `Phases/phase-5-hardening-qa-launch.md` — the phase doc you are executing.
4. `project_web-phase-{1,2,3,4}-status.md` memory files — to confirm any carried-over W-DECs that need close-out.
5. The mobile `docs/phases/phase-12-manual-tests.md` and `docs/spec/{security,performance}.md` for the discipline + budgets we're matching.

# Locked decisions + hard rules
Same as prior phases. **Critical for THIS phase:**
- **Launch domain (decided 2026-05-28): the `*.vercel.app` URL.** A custom domain is OPTIONAL and can be added later via Vercel → Domains; if/when added, also update Supabase **Site URL / Redirect URLs** and edge-fn CORS.
- **Sentry + PostHog stay DEFERRED** (parity with the mobile decision). Don't ship a half-wired DSN; ship a `lib/log.ts` shim so wiring later is one file.
- CSP must allow: Supabase origin (auth + edge fns), `https://www.youtube.com` + `https://www.youtube-nocookie.com` (YT iframe), `blob:` + `worker-src` (pdf.js + the service worker), KaTeX fonts (`self`).
- The service worker must NOT cache authenticated API responses — precache only the static shell.
- Don't regress the "no `is_correct` during attempt" guarantee when adding caching/prefetch. Prefetching `quiz-start`/`exam-start` is FINE (no answers); prefetching results before release is NOT.
- All other hard rules from prior phases.

# Git
Continue on `web-phase-1`. At Phase 5 acceptance we'll consider merging the whole branch to `main` — but **only with my explicit OK**, never via force-push.

# Your task — execute Phase 5 EXACTLY per `Phases/phase-5-hardening-qa-launch.md`
- **A** Responsive & visual polish at 375 / 768 / 1280 / 1440 px for every screen; desktop multi-column polish.
- **B** Cross-browser matrix: Chrome desktop, Chrome Android, Safari iOS, Safari macOS, Edge, Firefox.
- **C** Performance budget: code-split `react-pdf` / `react-youtube` / `@yudiel/react-qr-scanner` / `katex` / `canvas-confetti`; `next/image` for images; realtime cleanup audit (grep every `supabase.channel(` for matching `removeChannel`); one media player at a time; Lighthouse targets.
- **D** Security review: run the `rlscheck` skill; confirm no service-role key in `apps/web` (grep build output); signed-URL-only storage; no answer-key leak; CSP + headers; CORS locked to production + localhost; httpOnly cookies.
- **E** PWA finalize: offline shell + icons + splash + install on iOS/Android/desktop.
- **F** Accessibility: keyboard nav, focus trap in modals, `Esc` to close, AA contrast, reduce-motion, alt/aria-label, form labels.
- **G** Full §A–§J manual test plan — **write `Phases/phase-5-manual-tests.md`** mirroring `docs/phases/phase-12-manual-tests.md`. Run on Chrome desktop + iOS Safari + Android Chrome. **Wait for my sign-off.**
- **G2** Basic SEO + meta on public pages + `robots.txt` + `sitemap.ts` (auth-gated routes disallowed).
- **G3** Confirm Sentry/PostHog deferred status + `lib/log.ts` shim.
- **H** Launch: promote to Vercel production, env vars match, Supabase redirect/CORS lists the production origin, run a final smoke on the real Vercel URL on phone + laptop.
- **Docs:** write `docs/web-app-deploy.md` (build / deploy / rollback / env / current Vercel URL / how to attach a custom domain later); update `README.md`; update `CLAUDE.md` to add `apps/web` to the file entry points + module map and mark the web app shipped; record any final `W-DEC` deviations.

# Verification — DO NOT skip
- `pnpm --filter @fynestudy/web typecheck && lint && test && build` green.
- Full Playwright E2E suite green.
- Lighthouse PWA installable + Performance ≥ 80 mobile.
- `rlscheck` clean.
- `phase-5-manual-tests.md` §A–§J all PASS (incl. one real OBS dry-run).
- Production smoke on the live Vercel URL: phone + laptop.

# Acceptance — the conversion is DONE when:
- Every checkbox in `Phases/phase-5-hardening-qa-launch.md` is ticked.
- Production smoke is green on the live Vercel URL.
- `docs/web-app-deploy.md` is written; `README.md` + `CLAUDE.md` updated; final ledger appended to `Phases/phase-5-*.md`.
- Save `project_web-phase-5-status.md` + a `project_web-conversion-complete.md` memory entry summarising what shipped, where it lives, and any deferred items (Sentry/PostHog, custom domain, etc.). Update MEMORY.md pointers.

# Stop condition
- When Phase 5 is fully accepted, **STOP**. The conversion is complete. Tell me the production URL, the deferred-items list, and offer (do not perform without OK) to merge `web-phase-1` to `main`.

If anything in the hardening trips a hard rule (e.g., a CSP fix that would weaken security, a perf fix that would regress correctness), ASK me before deviating.
```

---

## After Phase 5

The web app is live. Three things are *intentionally deferred* (not bugs):
- Sentry + PostHog (parity with mobile; wire later in one file via `lib/log.ts`).
- Custom domain (attach via Vercel → Domains whenever the DNS is ready; update Supabase + CORS allow-lists).
- Anything you and I explicitly logged as `W-DEC` deviations in the phase ledgers.

Any future change should follow the existing mobile pattern: spec → migration (if any) → edge fn → web feature → UI → tests. Web has its own `Phases/` index, but feature additions large enough to deserve a phase doc should land in a new `Phases/phase-6-*.md` (or `Phases/post-launch/` if it's a small change).
