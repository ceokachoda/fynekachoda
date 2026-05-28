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
- [ ] Quiz 4-stage + Exam 5-stage flows fully work and match mobile behavior.
- [ ] KaTeX renders inline + block math; parser unit tests pass.
- [ ] Server-anchored timer + 60s resync + auto-submit; clock-skew late write rejected.
- [ ] Tab-switch logged via Page Visibility API; banner correct; silent on submitted.
- [ ] No `is_correct` leakage during attempt (E2E network assertion green).
- [ ] Manual/instant release handled; resume-on-refresh works; re-open routing correct.
- [ ] Typecheck/lint/test/build + E2E green; manual checklist passes on all three browsers.
