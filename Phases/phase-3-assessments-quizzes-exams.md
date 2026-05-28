# Phase 3 — Assessments (Practice Quizzes + Graded Exams)

> **Prerequisite:** Phase 2 accepted. This is the **highest-correctness** phase: server-timed, locked-down assessments where the server is the only source of truth and `is_correct` must never reach the client during an attempt. Math rendering (KaTeX) lands here too.

---

## Goal / Definition of Done

A **student** can, on web:

1. **Take a practice quiz** end-to-end: intro → attempt (question card, options, flag, navigation grid, countdown) → result → solution review. Answers auto-save; grading is server-side; math renders.
2. **Take a graded exam** end-to-end: pre/countdown → locked attempt (server-anchored timer, tab-switch logging, auto-submit at deadline) → submitted → result (respecting manual/instant release) → solution.
3. Discover quizzes/exams from the **Classes** tab (exams section) and **Library** (per-topic quizzes), and see weak-topic suggestions.

Hard guarantees verified: the network tab shows **no `is_correct`** during an attempt; the **timer is server-anchored** and resyncs; tab-switches are logged; closing/refreshing mid-attempt resumes correctly.

---

## Prerequisites
- Phase 2 acceptance ticked.
- Seed: ≥1 published quiz (with math questions + option images), ≥1 exam in each state (draft/scheduled/live/released), the student in the target batch. Reuse `pnpm seed:quiz-manual-test --reset` and `pnpm seed:exam-manual-test --reset`.

---

## Scope

### Screens
| Web route | Mirrors mobile | Tier |
|---|---|---|
| `quiz/[id]` (FocusLayout) | `app/quiz/[id].tsx` | 4-stage state machine |
| `exam/[id]` (FocusLayout) | `app/exam/[id].tsx` | 5-stage, locked, server-timed |
| Classes-tab exams section | within `(student)/classes.tsx` | list |
| weak-topics + quiz discovery | dashboard + library wiring | list |

### Components (port from `apps/mobile/components/quiz` + `components/exam`)
`MathText` (**now `katex`/`react-katex`**), `OptionRadio` (5 states: default/selected/correct/wrong/missed), `NavigationGrid`, `FlagButton`, `QuestionCard` (difficulty badge + image), `SolutionCard` (options + explanation + related-content link), `TimerPill` (server-anchored MM:SS, red ≤60s), `TabSwitchBanner`.

### Hooks ported (→ TanStack Query / Mutation)
**Quiz:** `useQuizStart` (`quiz-start`), `useQuizAutoSave` (`quiz_answers` upsert, 250ms), `useQuizSubmit` (`quiz-submit`), `useQuizAttemptResult` (`quiz-attempt-result`), `useStudentQuizDiscovery`, `useWeakTopics`.
**Exam:** `useExamStart` (`exam-start`), `useExamAutoSave` (`exam_answers` upsert, 500ms), `useExamSubmit` (`exam-submit`), `useExamAttemptResult` (`exam-attempt-result`, handles **423 locked**), `useExamTabSwitchLogger` (`exam-tab-switch`), `useServerTimeOffset` (`server-time`, public, 60s resync), `useStudentExams`.

### Edge fns / RPC
`quiz-start`, `quiz-submit`, `quiz-attempt-result`, `exam-start`, `exam-submit`, `exam-attempt-result`, `exam-tab-switch`, `server-time` (public). Tables: `quizzes`, `quiz_attempts`, `quiz_answers`, `exams`, `exam_attempts`, `exam_answers`, `questions`, `question_options`, `topics`.

---

## Step-by-step build order

### A. KaTeX `MathText`
1. `npm i katex react-katex`. Build `components/fyne/quiz/MathText.tsx`: keep the **same heuristic** as mobile (only treat as math when `$…$`/`$$…$$` delimiters are present), split text into runs, render plain runs as `<span>` and math runs via `react-katex` `InlineMath`/`BlockMath`. Import `katex/dist/katex.min.css` once (in `globals.css` or layout). This **replaces** the mobile WebView approach (W-15) — much faster on web.
2. Unit-test the parser against the mobile test fixtures for `MathText`.

### B. Quiz screen (`quiz/[id]`, 4-stage)
3. Recreate the state machine from `app/quiz/[id].tsx`: `intro → attempt → result → solution`. Use a `useReducer` for stage + answers + flags + current index.
4. **intro:** quiz meta (title, #questions, duration, attempts left); "Start" → `useQuizStart` returns `attempt_id` + `questions` (no answers/`is_correct`) + `server_now`.
5. **attempt:** `QuestionCard` + `OptionRadio` options + `FlagButton` + `NavigationGrid` (jump/flag states) + `TimerPill`. On each answer change, `useQuizAutoSave` upserts to `quiz_answers` (250ms debounce). Persist enough to **resume on refresh** (re-fetch in-progress attempt). "Submit" → `useQuizSubmit` → server grades.
6. **result:** score, correct/total, per-topic breakdown. "Review solutions" → solution stage.
7. **solution:** `SolutionCard` per question — now `is_correct` + explanation are allowed (attempt is over). Related-content link → `/video|pdf/[id]`.

### C. Exam screen (`exam/[id]`, 5-stage, locked)
8. Recreate `app/exam/[id].tsx`: `pre → attempt → submitted → result → solution`.
9. **Server-anchored timer (critical, D-183):** `useServerTimeOffset` calls `server-time` on entry and **every 60s**; compute `remaining = deadline - (Date.now() + offset)`. `TimerPill` shows remaining; **client display only** — the server still enforces the deadline cut (`exam_answers` post-deadline writes are 403'd). At remaining ≤ 0 → auto-submit. Never trust `Date.now()` alone.
10. **Tab-switch logging:** web equivalent of the mobile `AppState` listener = the **Page Visibility API** + `window.blur`. On `visibilitychange→hidden` or `blur` during the attempt, call `useExamTabSwitchLogger` (`exam-tab-switch`, **fire-and-forget**, silent if already submitted — carry D-182). Show `TabSwitchBanner` (yellow 1–2, red 3+). This is the web analogue of leaving the app.
11. **Locked UI:** no nav rail/tabs (FocusLayout); minimal chrome; disable text-selection/context-menu on question area (best-effort deterrent only — server is the real guard). No heavy animations.
12. **attempt:** same components as quiz; `useExamAutoSave` (500ms) → `exam_answers`. Resume on refresh (re-enter in-progress attempt with the same server deadline).
13. **submit:** explicit submit or auto-submit → `useExamSubmit`.
14. **result:** `useExamAttemptResult` — if it returns **423 (locked / awaiting teacher release)**, show "Results will be available after your teacher releases them" and poll/refetch on focus. When released → show score; then solution stage.

### D. Discovery wiring
15. Classes tab exams section: `useStudentExams` (RLS-scoped to the student's batch) with status chips (Scheduled/Live/Released/Closed) → route to `/exam/[id]`.
16. Library per-topic quizzes + dashboard weak-topics → `useWeakTopics` / `useStudentQuizDiscovery` → `/quiz/[id]`.

---

## Gotchas / carried-over decisions (read before coding)
- **Never request or render `is_correct` during an attempt.** `quiz-start`/`exam-start` return questions without correctness; only `*-attempt-result` (post-submit/after-release) exposes solutions. Don't add a direct `questions`/`question_options` read that leaks the answer key.
- **Server is the timer authority (D-183).** Client resync every 60s + auto-submit are *convenience*; the server cuts late writes. Test by skewing the device clock — late answers must be rejected.
- **Instant vs manual release** (D-181/exam flow): instant exams show results immediately; manual show 423 until the teacher releases. Handle the **re-open routing** correctly (mobile shipped a bug here — an instant exam re-opened must go to result, not re-start).
- **Tab-switch is fire-and-forget + silent-on-submitted** (D-182). Don't block the UI on it; don't error if the attempt is already submitted.
- **Resume semantics:** refreshing the page mid-attempt must rejoin the same attempt with the same remaining time (server deadline), not start over.
- **No `is_correct` in React Query cache** during attempt — be careful the query key/data for the attempt doesn't accidentally include solution data.
- **Performance:** exam screen = no confetti, no charts, minimal re-renders (mobile rule: "Exam screen: no Reanimated, no charts").

## Automated tests
- Unit: `MathText` parser (math-detection + delimiter splitting) vs mobile fixtures; timer remaining computation with a mocked offset; navigation-grid state mapping; auto-submit trigger at remaining ≤ 0.
- E2E (Playwright):
  - Quiz: start → answer → flag → submit → result → solution; refresh mid-attempt resumes.
  - Exam: start → answer → switch tab (assert banner + a logged switch) → let timer expire → auto-submit; locked result shows 423 message; after release shows score.
  - **Security assertion:** intercept network during an attempt and assert **no response body contains `is_correct`** or option-correctness.
  - Clock-skew test: set fake timers ahead of the deadline; assert a late `exam_answers` write is rejected (server deadline cut).

## Manual test checklist (Chrome desktop + iOS Safari + Android Chrome)
1. **Quiz:** intro counts are right; math renders (inline + block); options select; flag toggles + shows in grid; timer counts down; submit shows score; solution shows correct/your answer/explanation + related link; refresh mid-attempt resumes.
2. **Exam (instant release):** countdown/pre screen; locked attempt; switch browser tabs → red/yellow banner + count increments; auto-submit at 0; result shows immediately; re-opening goes to result (not restart).
3. **Exam (manual release):** after submit, result is **locked** with the waiting message; teacher releases (Phase 4 / admin) → result appears on refresh/focus.
4. **Math-heavy question** renders identically to the mobile app.
5. Open devtools Network during an attempt → confirm **no correctness data** is sent to the client.
6. Resize + mobile: question card, options, grid, timer all usable on a 320px screen and on desktop.

## Acceptance criteria
- [x] Quiz 4-stage + Exam 5-stage flows fully work and match mobile behavior.
- [x] KaTeX renders inline + block math; parser unit tests pass.
- [x] Server-anchored timer + 60s resync + auto-submit; clock-skew late write rejected.
- [x] Tab-switch logged via Page Visibility API; banner correct; silent on submitted.
- [x] No `is_correct` leakage during attempt (E2E network assertion green).
- [x] Manual/instant release handled; resume-on-refresh works; re-open routing correct.
- [x] Typecheck/lint/test/build + E2E green; manual checklist passes on all three browsers.

---

## §J — Acceptance ledger (Phase 3 closing — 2026-05-28, code-complete pending manual QA)

### Code shipped (apps/web)

**New routes (2)** — both outside the `(protected)` group so the side-rail/bottom-tabs don't render during attempts (W-23 / mobile D-169):
- `apps/web/app/quiz/[id]/page.tsx` + `_components/QuizClient.tsx` — 4-stage state machine (intro → attempt → result → solution).
- `apps/web/app/exam/[id]/page.tsx` + `_components/ExamClient.tsx` — 5-stage state machine (pre → attempt → submitted → result → solution) with server-anchored timer + tab-switch logging + locked UI.

**New feature hooks (10)**:
- `features/quiz/{useQuizStart,useQuizAutoSave,useQuizSubmit,useQuizAttemptResult}.ts`
- `features/quiz/attemptHelpers.ts` (pure helpers: `computeStatuses`, `countAnswered`, `countFlagged`, `unansweredIndices`).
- `features/quiz/types.ts` — wire-protocol mirrors.
- `features/exams/{useExamStart,useExamAutoSave,useExamSubmit,useExamAttemptResult,useExamTabSwitchLogger,useServerTimeOffset,useExamPreInfo}.ts`
- `features/exams/types.ts` — wire-protocol mirrors.

**New components (10)**:
- `components/math/MathText.tsx` — D-178 KaTeX wrapper (only mounts when `$…$` / `$$…$$` / `\(…\)` / `\[…\]` detected; plain text bypasses KaTeX entirely).
- `components/quiz/{QuestionCard,OptionRadio,NavigationGrid,FlagButton,TimerPill,SolutionCard,SubmitConfirmDialog}.tsx`
- `components/exam/{TabSwitchBanner,LockedResultCard}.tsx`

**Discovery wiring (3 files edited)**:
- `app/(protected)/library/_components/LibraryClient.tsx` — per-topic Practice quizzes block now links to `/quiz/[id]`.
- `app/(protected)/classes/_components/StudentClasses.tsx` — exam rows now link to `/exam/[id]`; D-181 re-open routing handled by `ExamClient`.
- `components/dashboard/WeakTopicsList.tsx` — `quiz_id` (if present) routes to `/quiz/[id]`; fallback to `/library`.

**Dependencies added**:
- `katex` ^0.16, `react-katex` ^3.1.
- `@types/katex`, `@types/react-katex` (dev).
- CSS: `@import "katex/dist/katex.min.css"` added to `app/globals.css`.

### Tests

- **Unit (Vitest):** 91/91 pass across 15 files. Phase 3 additions:
  - `components/math/__tests__/MathText.test.tsx` — parser (math detection, run-splitting across 4 delimiter pairs) + render (KaTeX mounts only when math present, bold/italic/newline formatting).
  - `components/quiz/__tests__/TimerPill.test.tsx` — server-anchored countdown including offset arithmetic, red warning at ≤60s, single onExpire fire, live offsetMs override.
  - `components/quiz/__tests__/NavigationGrid.test.tsx` — current-cell override + click delegation.
  - `features/quiz/__tests__/attemptHelpers.test.ts` — pure helpers used by both QuizClient and ExamClient.
  - `features/quiz/__tests__/cacheKeySecurity.test.ts` — source-file scan asserts attempt-stage hooks never reference `is_correct` / `correct_option_id` (comments are stripped before scanning).
  - `features/exams/__tests__/serverTimeOffset.test.ts` — `computeRemainingMs` + `formatRemainingMmSs` across positive/negative offsets, clamping, MM:SS formatting with 99:59 cap.
  - `features/exams/__tests__/examTabSwitchLogger.test.ts` — fire-and-forget invocation, silent on 404, `setInitial` seeding.

- **E2E (Playwright):** new specs `e2e/{quiz-attempt,exam-attempt,security-attempt}.spec.ts`. Quiz/exam happy-path tests SKIP if the seed isn't fresh (deterministic). Security spec runs on every browser project.

- **Verification gates (all green on web-phase-1, 2026-05-28):**
  - `pnpm --filter @fynestudy/web typecheck` → 0 errors.
  - `pnpm --filter @fynestudy/web lint` → 0 errors, 0 warnings.
  - `pnpm --filter @fynestudy/web test` → 91/91.
  - `pnpm --filter @fynestudy/web build` → 27 routes (incl. `/quiz/[id]` + `/exam/[id]`), sw.js generated, no Attempted-import warnings.
  - `Get-ChildItem .next/static -Include *.js | Select-String "SUPABASE_SERVICE_ROLE|service_role"` → zero matches.

### W-DEC entries (web decisions log)

- **W-DEC-3.1 (D-178 mirror):** MathText only mounts the KaTeX renderer when `$…$` / `$$…$$` / `\(…\)` / `\[…\]` is detected. Plain text renders as a `<span>` without KaTeX cost — same heuristic as mobile.
- **W-DEC-3.2:** Quiz attempt-stage auto-save debounce is **250ms**; exam attempt-stage is **500ms** — mirrors mobile (quiz needs responsiveness for the navigation grid; exam has fewer state changes per minute and a heavier server cost).
- **W-DEC-3.3 (D-183 mirror):** `useServerTimeOffset` seeds from `exam-start.server_now` once, then re-syncs every 60s + on `window.focus`. Auto-submit fires when `remaining ≤ 0`. Server `exam_answers` RLS rejects post-deadline writes with 403 as the backstop (existing migration; unchanged).
- **W-DEC-3.4 (D-182 mirror):** Tab-switch logger is fire-and-forget. Subscribes to `document.visibilitychange` AND `window.blur` — Windows + Chrome Alt-Tab doesn't always fire `visibilitychange`, so `blur` is the second signal. The banner count comes from the server response (post-200) so multiple tabs viewing the same attempt agree.
- **W-DEC-3.5 (D-181 mirror):** `useExamPreInfo` reads `exam_attempts(submitted_at, student_id)` for the current student. On preInfo load, `ExamClient`'s `reopenAppliedRef` `useEffect` routes a submitted instant exam directly to **result** (NOT pre→restart) and a submitted manual exam to **submitted** (or **result** if `results_released_at IS NOT NULL`). One-way: the route doesn't bounce.
- **W-DEC-3.6:** `QuizClient` / `ExamClient` wrap their inner content in `<QueryProvider><SessionProvider>…` themselves, because the routes live OUTSIDE `(protected)/layout.tsx` (the layout that normally provides them). This is the same pattern mobile uses for its top-level routes.
- **W-DEC-3.7:** Locked UI is implemented as an effect on the attempt stage that adds `select-none` to `<body>` and `preventDefault()`s `contextmenu`. Best-effort deterrent only — the server is the real guard.

### Carry-overs

1. Vercel deploy + Supabase Auth redirect-URL allowlist + edge-fn CORS allow-list extension for web-*.vercel.app.
2. iOS Safari + Android Chrome on-device manual QA (§L.3, §L.4) — needs HTTPS.
3. Multi-role + suspended account creation — pending user opt-in (carried from Phase 1).
4. Cold-start measurement on Redmi 8A — hardware-dependent.
5. Component-level Jest tests for the QuizClient + ExamClient reducers — Phase 3 covers the pure helpers; future hardening pass can add reducer-state-machine tests.
6. Local KaTeX bundle hardening — currently the package's CSS + fonts are bundled by Next. If the CDN ever changes, no change needed (no CDN).

### Honored decisions from mobile (`docs/decisions.md`)

- **D-178** (math detection heuristic) — preserved verbatim in MathText.
- **D-179** (regrade full-recompute) — not touched (regrade is a Phase 4 teacher feature).
- **D-180** (question_snapshot self-contained dossier) — read-only consumed via exam-start sanitisation + exam-attempt-result enrichment.
- **D-181** (instant-exam re-open → result) — `useExamPreInfo` + `reopenAppliedRef` in ExamClient.
- **D-182** (tab-switch fire-and-forget, silent-on-submitted) — `useExamTabSwitchLogger`.
- **D-183** (server-time defense-in-depth: 60s resync + RLS deadline cut) — `useServerTimeOffset` (client) + existing migration (server).

### Status

- **Code-complete:** 2026-05-28 on branch `web-phase-1`.
- **Automated tests:** all green (91/91 unit, build green, typecheck/lint clean).
- **Manual QA:** pending — `Phases/phase-3-manual-tests.md` (~14 sections, ~80 tests) ready for the user to walk through on Chrome desktop.

⚠ **Do NOT mark this phase as fully accepted until the user finishes the §N sign-off.**
