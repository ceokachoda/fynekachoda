# Phase 3 kickoff prompt — paste this into a NEW Claude Code conversation

> Copy everything between the two horizontal rules below and paste it as the **first message** of a fresh Claude Code conversation in this repo. Don't paste anything else first — it must be the conversation's anchor.

---

I'm continuing the FyneStudy Web App Conversion. We're executing **Phase 3 — Assessments (Practice Quizzes + Graded Exams)** today. This is a NEW conversation. Read carefully, ask before guessing, and don't deviate from the locked rules below. **This is the highest-correctness phase** — server is the only source of truth for the timer; `is_correct` MUST NEVER reach the client during an attempt.

---

# 🚦 Phase 2 status (signed off / acceptable state as of 2026-05-28) — TRUST THIS, DO NOT MODIFY

Phase 2 is **CODE-COMPLETE** and committed on `web-phase-1` (one long-lived web track branch, NOT pushed). Latest commit on that branch should be `feat(web-phase-2): student learning surfaces` (hash starts with `bd7b0c9`). Every automated gate is green:

- `pnpm --filter @fynestudy/web typecheck` → 0 errors.
- `pnpm --filter @fynestudy/web lint` → 0 errors, 0 warnings.
- `pnpm --filter @fynestudy/web test` → **41 / 41** unit tests pass (8 files: role-helpers, edge-fn, ist, watermark, masteryColor, computeStatus, scanWindow, useLibraryTree).
- `pnpm --filter @fynestudy/web build` → 25 routes, `sw.js` generated, no `Attempted import error` warnings, no `SUPABASE_SERVICE_ROLE` in `.next/static`.
- Playwright spec files in place for: auth, dashboard, profile, leaderboard, attendance, library, security.

**Manual QA on Chrome desktop is in flight** by the user against `Phases/phase-2-manual-tests.md`. iOS Safari + Android Chrome PWA install rows are carry-over (need HTTPS / Vercel deploy).

### **Do NOT touch any of these Phase 1 / Phase 2 files unless you find an actual bug** (and if you do, STOP and ask the user before editing):

**Foundation (Phase 1):**
- `apps/web/middleware.ts`
- `apps/web/lib/{env,auth,edge-fn,utils,query,ist,watermark}.ts`
- `apps/web/lib/supabase/{server,browser,middleware}.ts`
- `apps/web/features/auth/{SessionProvider,role-helpers,schemas}.{ts,tsx}` (extend with new hooks, don't rewrite)
- `apps/web/app/{login,forgot-password,reset,force-password-change,suspended,admin-redirect,role-chooser,privacy,terms,error,not-found,loading,_styleguide,sw,manifest}/...`
- `apps/web/app/actions/{set-active-role,sign-out}.ts`
- `apps/web/app/(protected)/layout.tsx` (the shell)
- `apps/web/components/fyne/*` (15 primitives — Pill, AppShell, Segmented, EmptyState, PageHeader, etc.)
- `apps/web/components/ui/*` (shadcn primitives)
- `apps/web/components.json`, `eslint.config.mjs`, `next.config.ts`, `postcss.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`
- `apps/web/types/modules.d.ts`

**Phase 2 (student learning surfaces — code-complete on this branch):**
- `apps/web/app/(protected)/page.tsx` + `_components/StudentDashboard.tsx`
- `apps/web/app/(protected)/{profile,leaderboard,attendance,classes,library,menu}/page.tsx` + `_components/*.tsx`
- `apps/web/app/video/[contentId]/page.tsx` + `_components/VideoClient.tsx`
- `apps/web/app/pdf/[contentId]/page.tsx` + `_components/PdfClient.tsx`
- `apps/web/features/{dashboard,gamification,leaderboard,attendance,library,quiz,exams,org,profile}/...` — **EXTEND** these with new Phase 3 hooks; don't rewrite.
- `apps/web/components/{dashboard,gamification,leaderboard,attendance,player,profile}/*` (~30 presentational components)

**Note on the existing Phase 2 hook `features/quiz/useStudentQuizDiscovery.ts` and `features/exams/useStudentExams.ts`:** these are DISCOVERY hooks only (titles + status, no questions). Phase 3 ADDS new hooks for the actual attempt flow (`useQuizStart`, `useQuizSubmit`, `useExamStart`, `useExamSubmit`, etc.); don't merge them into the discovery hooks.

**Phase 2 will get its acceptance ledger line appended to `Phases/phase-2-student-learning-surfaces.md §J` once the user signs off the manual tests. Don't write that line yourself.**

---

# Step 0 — READ THESE FIRST (in this order)

1. **`CLAUDE.md`** — every rule. Highlights:
   - Anon key only in `apps/web` (no service-role).
   - Every privileged write through an edge fn.
   - **Never send `is_correct` to the client during an attempt** — this is the central Phase 3 invariant.
   - Server is the only source of truth for the exam timer + QR validity.
2. **`Phases/00-overview-and-architecture.md`** — re-read §4 W-DEC table. Specifically W-13 (`react-youtube`), W-14 (`react-pdf`), **W-15 (`katex` + `react-katex`)** — math goes through these on web, NOT a WebView.
3. **`Phases/phase-3-assessments-quizzes-exams.md`** — **THIS IS THE SOURCE OF TRUTH** for Phase 3 scope. Read it in full. Lists every screen, component, hook, edge fn / RPC, gotcha, automated test, manual checklist, and acceptance criterion.
4. **`Phases/phase-2-student-learning-surfaces.md`** — to know what Phase 2 wired up. The Classes-tab Exams discovery + Library per-topic quizzes are already there; Phase 3 routes them to the attempt screens.
5. **`Phases/phase-1-manual-tests.md` and `Phases/phase-2-manual-tests.md`** — to know the EXACT beginner-friendly format you must mirror in `Phases/phase-3-manual-tests.md` (numbered `👉 Do this` / `✅ What you should see` / `❓ If something looks different` / `Result:` checkboxes + a §M acceptance sign-off + a troubleshooting cheat-sheet at the bottom).
6. **Inventory `apps/web/` before adding anything.** Don't duplicate hooks / components / utility functions.
7. **Mobile sources to port from** — open each as you build the matching web screen / hook:
   - Quiz screen: `apps/mobile/app/quiz/[id].tsx` + `apps/mobile/components/quiz/*` + `apps/mobile/features/quiz/{useQuizStart,useQuizAutoSave,useQuizSubmit,useQuizAttemptResult}.ts`.
   - Exam screen: `apps/mobile/app/exam/[id].tsx` + `apps/mobile/components/exam/*` + `apps/mobile/features/exam/{useExamStart,useExamAutoSave,useExamSubmit,useExamAttemptResult,useExamTabSwitchLogger,useServerTimeOffset}.ts`.
   - MathText: `apps/mobile/components/quiz/MathText.tsx` (mobile uses WebView; web replaces with `react-katex` per W-15 — much faster).
   - Exam results screen: `apps/mobile/app/exam-results/[examId].tsx`.
8. **`docs/decisions.md`** — at minimum quote / honour: **D-179** (full-recompute regrade), **D-180** (question_snapshot is self-contained server-side grading dossier — so we can render solutions client-side post-submit without re-fetching), **D-181** (instant-exam re-open routing — re-open goes to result, NOT restart), **D-182** (tab-switch fire-and-forget + silent-on-submitted), **D-183** (server-time defense-in-depth: client 60s `useServerTimeOffset` resync + server-side `exam_answers` deadline cut), **D-178** (MathText only mounts the math renderer when delimiters are detected).
9. **Edge fn + RPC signatures** — read the request/response shapes in `apps/functions/{quiz-start,quiz-submit,quiz-attempt-result,exam-start,exam-submit,exam-attempt-result,exam-tab-switch,server-time}/index.ts`. The web client must send the same payloads as mobile.

---

# 🔑 Test accounts (verified live 2026-05-28)

Use the SAME accounts you used in Phase 1 + 2. Copy-paste:

| Account | Email | Password | Notes |
|---|---|---|---|
| Student (primary) | `review.student@fynestudy.app` | `ReviewStudent#2026` | All quiz + exam attempts run as this account. |
| Teacher (primary) | `review.teacher@fynestudy.app` | `ReviewTeacher#2026` | Used only to verify teacher discovery rows still render (don't build teacher Phase 3 attempt UI). |
| Owner admin | `owner@fynestudy.example.com` | `FyneOwner#2026` | Use the admin panel (https://fyne-study-app-admin.vercel.app) to release exam results / regrade. |
| Extra student (Aarav, Batch A) | `test.aarav@fynestudy.app` | `TestPass#2026` | Optional second test student. |
| Extra student (Diya, Batch A) | `test.diya@fynestudy.app` | `TestPass#2026` | Optional second test student. |

**Multi-role + suspended accounts:** NOT created (user opted out in Phase 1). Carry the Phase 1 N/A pattern forward — never block Phase 3 on them.

**Seed:** before testing, refresh fixtures with `pnpm seed:quiz-manual-test --reset` and `pnpm seed:exam-manual-test --reset` (these are the mobile seed scripts; reuse them).

**Supabase project:** `orqwyazvcthgxoadfxfv` (ap-south-1). The web client reads anon key from `apps/web/.env.local` — DO NOT add `SUPABASE_SERVICE_ROLE_KEY` to that file ever.

---

# 🛠 What Phase 3 BUILDS

Working under `apps/web/`:

### A. KaTeX `MathText` component
- `npm i katex react-katex` (or pnpm equivalent).
- Build `apps/web/components/quiz/MathText.tsx`.
- **Replicate the mobile heuristic (D-178):** only mount the math renderer when `$…$` or `$$…$$` delimiters are detected in the input. Otherwise, render the text as plain `<span>` — saves the KaTeX bundle cost on non-math questions.
- Split text into runs, render plain runs as `<span>`, math runs via `react-katex` (`InlineMath` for `$…$`, `BlockMath` for `$$…$$`).
- Import `katex/dist/katex.min.css` ONCE — in `app/globals.css` is cleanest.
- Unit-test the parser against the mobile test fixtures (`apps/mobile/components/quiz/__tests__/MathText.test.tsx`).

### B. Quiz screen — `app/quiz/[id]` (FocusLayout, OUTSIDE the `(protected)` group)
- 4-stage state machine via `useReducer`: **intro → attempt → result → solution**.
- **intro:** quiz meta (title, # questions, duration, attempts left). "Start" → `useQuizStart` (POST `quiz-start`) returns `{ attempt_id, questions, server_now }`. **Questions MUST NOT contain `is_correct` / `correct_option_id`.**
- **attempt:** components per spec — `QuestionCard` + `OptionRadio` (5 visual states: default / selected / correct / wrong / missed — only the first two used during the attempt) + `FlagButton` + `NavigationGrid` (jump + flag indicators) + `TimerPill` (server-anchored MM:SS, red ≤ 60 s). On each answer change, `useQuizAutoSave` upserts to `quiz_answers` (250 ms debounce). **Re-fetch in-progress attempt on refresh** so the user resumes seamlessly.
- "Submit" → `useQuizSubmit` (POST `quiz-submit`) → server grades.
- **result:** score / correct / total + per-topic breakdown. "Review solutions" → solution stage.
- **solution:** `SolutionCard` per question. NOW `is_correct` + explanations are allowed because the attempt is over and the server has returned them via `quiz-attempt-result`. Add related-content link → `/video/[id]` / `/pdf/[id]` per the question's metadata.

### C. Exam screen — `app/exam/[id]` (FocusLayout, OUTSIDE `(protected)`, LOCKED chrome)
- 5-stage state machine: **pre → attempt → submitted → result → solution**.
- **Server-anchored timer (D-183 — critical):**
  - On entry and **every 60 seconds during the attempt**, call `useServerTimeOffset` (`server-time` edge fn; this fn is `--no-verify-jwt` per mobile). It returns the server's "now" timestamp; compute `offset = serverNow - Date.now()`.
  - Compute `remaining = deadline - (Date.now() + offset)`.
  - `TimerPill` shows `MM:SS` countdown using `remaining`; turns red when `remaining ≤ 60 s`.
  - **Client display only.** The server ALSO enforces the deadline — `exam_answers` writes after the deadline are 403'd by RLS.
  - At `remaining ≤ 0`, fire `useExamSubmit` automatically (auto-submit).
  - Never trust `Date.now()` alone.
- **Tab-switch logging (web equivalent of mobile's `AppState` listener):**
  - Subscribe to the **Page Visibility API** (`document.visibilitychange`) AND `window.blur`.
  - On `visibilitychange → hidden` OR `blur` during the attempt, call `useExamTabSwitchLogger` (POST `exam-tab-switch`). **Fire-and-forget** (D-182): silent on submitted, don't block UI, don't error if 404.
  - Show `TabSwitchBanner` — yellow at 1–2 switches, red at 3+. The count comes from the server response.
- **Locked UI:** the route is OUTSIDE the `(protected)` route group, so no side-rail / bottom tabs render. Minimal chrome. Disable text-selection on the question area (`user-select: none`) and disable context-menu (`onContextMenu={e => e.preventDefault()}`) — best-effort deterrents only; **server is the real guard**.
- No heavy animations, no confetti, no charts. Match mobile's "exam screen: no Reanimated" rule.
- **attempt:** same components as quiz (MathText, OptionRadio, NavigationGrid, FlagButton). `useExamAutoSave` (500 ms debounce) → `exam_answers`. Resume on refresh.
- **submit:** explicit Submit button OR auto-submit at deadline → `useExamSubmit`.
- **result:** `useExamAttemptResult` returns either the score (instant release OR teacher already released) OR **423 (locked / awaiting release)** — if 423, show **"Results will be available after your teacher releases them."** + refetch on focus.
- **solution:** same as quiz — `SolutionCard` per question, now with correctness + explanations.

### D. Discovery wiring (Phase 2 surfaces → Phase 3 routes)
- Update `apps/web/app/(protected)/classes/_components/StudentClasses.tsx`:
  - The exams section currently shows a Phase-3 footer. Now make each row clickable.
  - Routing per D-181:
    - `status === 'scheduled'` → click → `/exam/[id]` (pre stage).
    - `status === 'live'` → click → `/exam/[id]` (attempt stage if no prior attempt, or submitted stage if mid-attempt resume).
    - `status === 'results_pending'` or `status === 'results_released'` → click → `/exam/[id]` (result stage). **NEVER restart an attempt that's already submitted.**
- Update `apps/web/app/(protected)/library/_components/LibraryClient.tsx`:
  - The per-topic "Practice quizzes" footer currently shows a Phase-3 badge. Now make each row clickable → `/quiz/[id]` (intro stage).
- Dashboard weak-topics already exist (`useWeakTopics` is fed by `student_dashboard`). Phase 3 just makes the click target work: if the topic has a recommended quiz, link to `/quiz/[id]`; else `/library`.

### E. Hooks to ADD under `apps/web/features/`
- `features/quiz/useQuizStart.ts` — POST `quiz-start { quiz_id }` → `{ attempt_id, questions, server_now }`
- `features/quiz/useQuizAttempt.ts` (or merge into the state machine — read the mobile pattern first) — re-fetch in-progress attempt to support refresh-mid-attempt.
- `features/quiz/useQuizAutoSave.ts` — 250 ms debounced upsert to `quiz_answers` `{ attempt_id, question_id, selected_option_id, is_flagged }`.
- `features/quiz/useQuizSubmit.ts` — POST `quiz-submit { attempt_id }` → `{ score, max_score, per_topic, … }`.
- `features/quiz/useQuizAttemptResult.ts` — POST `quiz-attempt-result { attempt_id }` → returns the post-submit dossier (questions + correct answers + explanations).
- `features/exam/useExamStart.ts` — POST `exam-start { exam_id }` → `{ attempt_id, questions, deadline, server_now }`.
- `features/exam/useExamAutoSave.ts` — 500 ms debounced upsert to `exam_answers`.
- `features/exam/useExamSubmit.ts` — POST `exam-submit { attempt_id }`.
- `features/exam/useExamAttemptResult.ts` — POST `exam-attempt-result { attempt_id }`. Handles **423**.
- `features/exam/useExamTabSwitchLogger.ts` — POST `exam-tab-switch { attempt_id }`. Fire-and-forget.
- `features/exam/useServerTimeOffset.ts` — POST `server-time` (public fn, no auth). 60 s `refetchInterval` while exam is active.

### F. Components to ADD under `apps/web/components/quiz/` and `apps/web/components/exam/`
- `quiz/MathText.tsx` (also used by exam — keep in `quiz/` or share via `components/math/`).
- `quiz/QuestionCard.tsx` (difficulty badge + image + MathText question stem).
- `quiz/OptionRadio.tsx` (5 visual states).
- `quiz/NavigationGrid.tsx` (jump + flagged + answered indicators).
- `quiz/FlagButton.tsx`.
- `quiz/SolutionCard.tsx` (correctness + explanation + related-content link).
- `quiz/TimerPill.tsx` (server-anchored MM:SS, red ≤ 60 s).
- `exam/TabSwitchBanner.tsx` (yellow 1–2, red 3+).

---

# ❌ What Phase 3 does NOT build

These are explicitly OUT of scope:

- **Teacher quiz / exam builder UI.** Phase 4 builds the teacher portal (mirrors `apps/mobile/app/quiz-builder/[quizId].tsx` + `exam-builder/[examId].tsx`). Phase 3 student attempts are enough.
- **Live class playback / chat / raise-hand.** Phase 4.
- **Recorded session playback.** Phase 4.
- **Webcam QR scanner.** Phase 4 (teacher).
- **Vercel deploy + CORS extension for `web-*.vercel.app`.** Carry-over from Phase 2.
- **Multi-role + suspended account creation.** Carry-over from Phase 1.
- **iOS Safari + Android Chrome on-device PWA install verification.** Needs HTTPS.
- **Sentry + PostHog wiring.** Deferred.
- **Any change to edge functions or Supabase schema.** Phase 3 is FRONT-END ONLY. If you think a backend change is needed, STOP and ask the user.

---

# 🔒 Locked decisions + hard rules

| Topic | Rule |
|---|---|
| Anon key only in `apps/web` | Service-role key NEVER appears. Re-grep `.next/static` after build. |
| `is_correct` MUST NOT leak during attempt | `quiz-start` + `exam-start` return questions without correctness. Only `*-attempt-result` (post-submit / after-release) returns solutions. **Be very careful** that `useQuery` cache keys don't accidentally surface solution data during the attempt — keep result-stage queries on DIFFERENT query keys from attempt-stage queries. |
| Server is the timer authority (D-183) | Client `useServerTimeOffset` resync every 60 s + auto-submit are *convenience*; the server cuts late writes. Test by skewing the device clock — late `exam_answers` writes must be rejected with 403. |
| Instant vs manual release (D-181) | **Re-open routing:** an instant-release exam that the student already submitted MUST go to the result stage, NOT restart. Mobile shipped a bug here — don't repeat it. |
| Tab-switch fire-and-forget (D-182) | Don't block UI on the POST. Silent if 404 / attempt already submitted. Show banner from response count, not local count. |
| Resume semantics | Refreshing mid-attempt rejoins the same attempt with the same remaining time (server deadline). Never start over. Test this explicitly in manual + Playwright. |
| MathText only mounts KaTeX when math present (D-178) | Plain-text questions render without the KaTeX bundle cost. Use the mobile heuristic — `$…$` or `$$…$$` delimiters in the input. |
| No `is_correct` in React Query cache during attempt | Attempt-stage `useQuery` keys MUST NOT share cache with result-stage queries. Verify by inspecting the Query Devtools mid-attempt. |
| Exam screen performance | No confetti, no charts, no Reanimated, minimal re-renders. Auto-save debounced 500 ms. Mirror mobile's "exam screen: no animation" rule. |
| Edge fn calls via `invokeEdgeFn<T>` | Phase 1's `apps/web/lib/edge-fn.ts` is the only client edge-fn invoker. Preserves non-2xx status (the 423 from `exam-attempt-result` is important — don't lose it). |
| FocusLayout for attempts | Routes `app/quiz/[id]` and `app/exam/[id]` live OUTSIDE the `(protected)` group so the side-rail / bottom tabs DO NOT render. They still go through middleware auth. |
| Realtime cleanup | If you add any realtime channel (Phase 3 might not need one — exam-tab-switch + timer don't need realtime), `removeChannel` on unmount. Grep audit at the end. |
| Git branch | Continue on `web-phase-1`. Commit at the end of the phase with `feat(web-phase-3): assessments — quizzes + exams`. Don't push or merge to `main`. |

---

# 🚫 Anti-patterns — common Phase 3 ways to break correctness

1. **Re-using a single `useQuery` key for `quiz-start` + `quiz-attempt-result`** → the cached attempt-stage payload (no `is_correct`) gets overwritten by the result-stage payload, and on next render the SAME query key returns solution data even mid-attempt. Use distinct query keys: `["quiz-attempt", attemptId]` vs `["quiz-result", attemptId]`.
2. **Falling back to `Date.now()` when `useServerTimeOffset` errors** → student can skew their device clock and bypass the deadline. Better: refuse to render the timer / disable submit if no offset.
3. **Polling `exam-attempt-result` every second while waiting for the teacher release** → spam. Use `refetchOnWindowFocus: true` + a manual "Refresh" button. The 423 response is the signal.
4. **Storing `selected_option_id` only in React state, not auto-saving** → student refreshes mid-attempt and loses every answer. Auto-save is the spec, not a nice-to-have.
5. **Calling `exam-tab-switch` synchronously and showing a loading state** → blocks the UI on a fire-and-forget endpoint. Use `void invokeEdgeFn(...)` and ignore the promise.
6. **Routing an already-submitted instant exam to the pre/attempt stage** → D-181 violation. Always check `useExamAttemptResult` first; if it returns score (not 423 / not no-attempt), go to result.
7. **Mounting two `react-youtube` players** (e.g., on a question's image AND in the related-content link preview) → memory leak. Only one player at a time.
8. **Adding a "review answers" button BEFORE submit** → may inadvertently expose `is_correct` if the result-stage query was preloaded. Don't.
9. **Forgetting `katex/dist/katex.min.css`** → math renders without styling. Import once in `app/globals.css`.
10. **Using `dynamic({ ssr: false })` for MathText** → unnecessary; KaTeX renders fine on the server too. Use it only for `react-pdf` + `react-youtube`.
11. **Hard-coding the exam deadline from the client clock** → late attempts pass. Always derive from the server-returned `deadline` ISO + offset.
12. **Submitting `quiz-answers` payload that includes `is_correct: false`** → makes no sense; the server computes correctness. Send only `{ attempt_id, question_id, selected_option_id, is_flagged }`.
13. **Tab-switch banner counting locally** — counts diverge between tabs. Use the server's response counter so all tabs agree.
14. **Disabling text-selection / right-click via `useEffect`** — fine, but it's a deterrent, not a security boundary. The server is the boundary.
15. **Re-implementing `Segmented` / `Pill` / `Dialog`** — Phase 1 + Phase 2 already shipped these. Reuse.

---

# ✅ Verification — every box must tick before manual test doc

Run from the repo root:

```powershell
pnpm --filter @fynestudy/web typecheck   # 0 errors
pnpm --filter @fynestudy/web lint        # 0 errors, 0 warnings
pnpm --filter @fynestudy/web test        # all unit tests green
pnpm --filter @fynestudy/web build       # 25+ routes incl. /quiz/[id] + /exam/[id], no Attempted import error
```

**Unit tests you must write (Vitest, under `apps/web/<area>/__tests__/`):**

- `MathText.test.ts` — parser against the mobile fixtures: detect math, split runs, render plain runs without KaTeX.
- `useServerTimeOffset.test.ts` (or extracted helper) — `remaining = deadline - (now + offset)` returns the right MM:SS strings for several offsets / deadlines.
- `examAutoSubmitTrigger.test.ts` — when `remaining ≤ 0`, the submit mutation fires exactly once (use fake timers + a mocked mutation).
- `navigationGridState.test.ts` — given a `{ answers, flags, currentIndex }` shape, the grid returns the right colour state per cell.
- `examTabSwitchLogger.test.ts` — fire-and-forget: never throws, silent on 404, accumulates banner count from response.
- `quizSecurityCacheKey.test.ts` — assert `useQuizStart` and `useQuizAttemptResult` use DIFFERENT query keys (compile-time assertion via `expectTypeOf` or runtime via mocked QueryClient inspection).

**Playwright E2E (extend `e2e/`):**

- `quiz-attempt.spec.ts`: start → answer → flag → submit → result shows score → "Review solutions" → solution stage shows `is_correct`. Refresh mid-attempt → page reloads with the same attempt and same answer / flag state.
- `exam-attempt.spec.ts`: scheduled exam → can't start before time. Live exam → start → answer → switch tab (`page.locator('body').evaluate(() => document.dispatchEvent(new Event('visibilitychange')))`) → banner shows yellow → switch again → banner switches to red on 3rd. Fake timers → at deadline, attempt auto-submits.
- `exam-locked-result.spec.ts`: submit a manual-release exam → result page shows the "awaiting teacher release" message. Use the admin panel to release → reload page → score appears.
- `exam-reopen.spec.ts` (D-181): submit an instant-release exam → close tab → re-open → land on result stage, NOT restart.
- **Security E2E (`security-attempt.spec.ts`):**
  - Intercept ALL network responses during the attempt (NOT result) stage; assert NO response body contains `is_correct`, `correct_option_id`, `solution_text`, or `answer_key`.
  - Clock-skew test: in Playwright, set `await page.clock.install({ time: deadlinePlus60s })` BEFORE the attempt finishes; assert a `exam_answers` write returns 403.

**Manual gates (script + grep):**

- Realtime cleanup audit (carried from Phase 2): `Select-String -Path "apps/web/features/**/*.ts" -Pattern "supabase\.channel\("` count must equal `removeChannel(` count.
- No-service-role-key grep: `Get-ChildItem apps/web/.next/static -Recurse -Include *.js | Select-String -Pattern "SUPABASE_SERVICE_ROLE|service_role" -List` → zero matches.
- No `is_correct` in attempt-stage source: `Select-String -Path "apps/web/features/quiz/useQuizStart.ts","apps/web/features/quiz/useQuizAutoSave.ts","apps/web/features/exam/useExamStart.ts","apps/web/features/exam/useExamAutoSave.ts" -Pattern "is_correct|correct_option"` → zero matches.

**Seed before manual + E2E:**

```powershell
pnpm seed:quiz-manual-test --reset
pnpm seed:exam-manual-test --reset
```

---

# 📋 Manual test doc requirement

Write `Phases/phase-3-manual-tests.md` in the **same beginner-friendly format as Phase 1 + Phase 2 manual test docs**. Treat them as the template you MUST clone, section-for-section. Specifically:

1. **Header note** explaining audience (zero coding background) + how to record results + estimated time.
2. **🔑 Test accounts** table at the top (same 5 accounts).
3. **Table of contents** linking the sections below.
4. **§0 Setup** with copy-paste PowerShell commands and exact terminal-output samples.
5. **Per-test format** (mandatory for every numbered test):
   - `### Test ID — short name`
   - `**👉 Do this:**` numbered substeps (URLs, button labels, fields verbatim).
   - `**✅ What you should see:**` bullets with specific UI text + visuals.
   - `**❓ If something looks different:**` troubleshooting for at least 2 common failure modes per test.
   - `` `Result:` [ ] PASS · [ ] FAIL · [ ] N/A `` checkboxes + a blank line for the user's notes.
6. **Sections (mandatory):**
   - **§0 Setup** — refresh deps (Phase 3 added `katex` + `react-katex`), env, dev server, seed scripts.
   - **§A Quiz attempt** — intro, start, answer / flag, math rendering, timer, submit, result, solution, refresh-mid-attempt resume.
   - **§B Exam pre / countdown** — can't start before time, can start once live.
   - **§C Exam attempt locked UI** — no side-rail, no right-click, no text-select.
   - **§D Server-anchored timer + 60s resync** — including clock-skew rejection.
   - **§E Tab-switch logging + banner** — yellow at 1–2, red at 3+.
   - **§F Auto-submit at deadline.**
   - **§G Manual-release result locked (423)** — admin releases → score appears.
   - **§H Instant-release result + D-181 re-open** — re-opens to result, not restart.
   - **§I Solution stage** — correctness + explanations + related-content link.
   - **§J Math rendering** — inline + block math identical to mobile.
   - **§K Security checks** — no `is_correct` in any attempt-stage network response (DevTools Find), no service-role-key.
   - **§L Automated test gates** — typecheck / lint / vitest / build / Playwright.
   - **§M Acceptance sign-off** — tick checkboxes per section + tester name + date.
7. **Troubleshooting cheat-sheet** table at the bottom (8–10 rows of common Phase-3 symptoms).
8. **Carry-overs** section listing what's deferred.

**Length target:** ~1500 lines (Phase 3 is the most complex phase; more granular tests needed).

**🛑 Wait for the user to sign off the manual tests before declaring Phase 3 accepted.**

---

# 📝 Acceptance — when Phase 3 is DONE

1. Every checkbox in `Phases/phase-3-assessments-quizzes-exams.md`'s "Acceptance criteria" section is ticked (or marked carry-over with a reason).
2. Append the §J acceptance ledger to the BOTTOM of `Phases/phase-3-assessments-quizzes-exams.md`:
   ```
   ## §J — Acceptance ledger (Phase 3 closing — YYYY-MM-DD)
   - Code: <one-line summary>
   - Tests: typecheck/lint/N unit/Playwright counts
   - Manual QA signed off by <user> on <date>
   - W-DEC entries (if any): <list>
   - Carry-overs: <list>
   ```
3. Update `CLAUDE.md`'s "🌐 Web App Conversion track" — add `Phase 3 ✅ code-complete <date>` with a one-sentence summary.
4. Save a memory file at `C:\Users\kaust\.claude\projects\C--Users-kaust-OneDrive-Desktop-FyneStudyLive\memory\project_web-phase-3-status.md` summarising what shipped + W-DECs + carry-overs. Add the one-line pointer to `MEMORY.md`.
5. Commit on **`web-phase-1`** (same branch — one long-lived for the whole web track): `git add` ONLY Phase 3 additions + ledger / CLAUDE.md / memory file. Commit message: `feat(web-phase-3): assessments — quizzes + exams`. **Do NOT push or merge to `main`.**

---

# 🛑 Stop condition

When Phase 3 is fully accepted (every acceptance criterion green + manual tests signed off + ledger appended + CLAUDE.md updated + memory file saved + commit landed on `web-phase-1`), **STOP**. Do NOT start Phase 4. The user will open a new conversation with the Phase 4 prompt.

---

# 🤝 If anything is ambiguous

ASK THE USER FIRST. Specifically expect ambiguity in:

- Whether `MathText` should live in `components/quiz/` or `components/math/` (it's shared between quiz + exam). **Default: `components/math/MathText.tsx` to surface reuse.**
- The exact 60 s resync cadence vs. "on focus" — **D-183 says 60 s plus on focus.**
- Whether the tab-switch banner should auto-dismiss after N seconds — **mobile keeps it visible for the rest of the attempt; mirror that.**
- The "Submit" button label when remaining ≤ 60 s — **mobile changes it to "Submit now" + the button turns red; mirror that.**
- Whether to add a "Submit confirmation" dialog with a list of unanswered questions — **YES, mobile has this; mirror.**
- What the result-stage layout looks like — **see `apps/mobile/app/exam-results/[examId].tsx` for exact composition.**

The project's `CLAUDE.md` first line says: *"Every time you code, don't just guess. Be precise; if you have any doubts then ask me."* Honor that.

---

**Sanity-check after reading the above:** if you find any conflict between this prompt and `Phases/phase-3-assessments-quizzes-exams.md`, the phase doc wins for **scope**; this prompt wins for **process**. Ask if it's still unclear.

Begin.

---

# How to use this prompt (instructions for you, the human)

1. Open a **new Claude Code conversation** in the same repo (don't continue from this one — Phase 3 deserves a fresh context).
2. Copy everything between the two `---` lines at the top (from "I'm continuing the FyneStudy…" through "Begin.") and paste it as the very first message.
3. The new Claude will read every file the prompt references, then start building Phase 3. It will:
   - Not touch Phase 1 / Phase 2 code (untouchables list is explicit).
   - Skip the things you opted out of (Vercel, multi-role accounts, etc.).
   - Write `Phases/phase-3-manual-tests.md` in the same beginner-friendly format as Phase 1 + 2.
4. When Phase 3 stops, you'll have a third manual test doc to walk through. Same QA pattern as Phases 1 + 2.
5. If you get stuck or the new Claude makes a wrong assumption, you can paste this comment back into the conversation: **"Re-read `PHASE-3-KICKOFF-PROMPT.md` §<the section> — you missed <X>."**
