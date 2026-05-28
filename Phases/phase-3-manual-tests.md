# Phase 3 — Manual Test Plan (`apps/web` assessments: quizzes + exams)

> **Audience:** the human running the manual tests. **Zero coding background required** — every step has the exact buttons to click, the exact URL to type, and what you should see on screen.
>
> **What you're testing:** the Phase 3 student surfaces of `apps/web` — the practice **quiz** screen (intro → attempt → result → solution) and the graded **exam** screen (pre → attempt → submitted → result → solution), the math renderer (KaTeX), the server-anchored countdown, the tab-switch logger, the locked-result waiting screen, the D-181 re-open routing, plus the wiring from Library / Classes / Dashboard. Walk through every section in order. **Chrome on a laptop / desktop is required.** iOS Safari + Android Chrome rows that need HTTPS are tagged **carry-over** (do them after the Vercel deploy session — that's intentional and not a blocker).
>
> **How to record results:** every test ends with `[ ] PASS / [ ] FAIL / [ ] N/A`. Tick one box. If FAIL, write what you saw in the space below it and ping me — I'll diagnose. If N/A, write the reason.
>
> **Estimated time:** ~120 minutes on Chrome desktop if no failures. Phase 3 is the highest-correctness phase — bring patience for §D (clock-skew) and §G (manual-release flow), which involve admin-side actions in a second tab.

---

## 🔑 Test accounts — quick reference (verified live 2026-05-28)

These are the SAME accounts you used in Phase 1 + 2. Email + password copy-paste straight from here.

| Use in section | Email | Password |
|---|---|---|
| **§0.5 + §A–§K all student tests** | `review.student@fynestudy.app` | `ReviewStudent#2026` |
| **§A.0 fallback (optional)** | `review.teacher@fynestudy.app` | `ReviewTeacher#2026` |
| **§G.3 + §H.3 admin release / regrade** | `owner@fynestudy.example.com` | `FyneOwner#2026` |
| Bonus extra student (Aarav, Batch A) | `test.aarav@fynestudy.app` | `TestPass#2026` |
| Bonus extra student (Diya, Batch A) | `test.diya@fynestudy.app` | `TestPass#2026` |

**Skipped sections (mark N/A):**
- iOS Safari + Android Chrome carry-overs (§L.3, §L.4) — needs the Vercel deploy that ships later.
- Multi-role student/teacher account switch — account never created in Phase 1.

> Source of truth for credentials: `CREDENTIALS.local.md` at the repo root (git-ignored, do not paste publicly).

---

## Table of contents

- **§0 Setup** — branch, env, dependencies, seed, dev server, DevTools (6 sub-tasks)
- **§A Quiz — intro → attempt → result → solution** (10 tests)
- **§B Exam — pre / countdown stage** (4 tests)
- **§C Exam — locked attempt UI + auto-save + resume** (8 tests)
- **§D Server-anchored timer (D-183) + 60-s resync + clock skew** (5 tests)
- **§E Tab-switch logging + TabSwitchBanner** (4 tests)
- **§F Auto-submit at deadline** (3 tests)
- **§G Manual-release exam — locked-result waiting + auto-flip** (4 tests)
- **§H Instant-release exam + D-181 re-open routing** (4 tests)
- **§I Solution stage — correctness + explanations + related-content link** (4 tests)
- **§J Math rendering — inline + block + non-math fast path** (5 tests)
- **§K Security checks — no `is_correct` mid-attempt, no service-role key, signed URLs only** (5 tests)
- **§L Responsive + carry-overs — desktop ↔ mobile-web** (4 tests, 2 carry-over)
- **§M Automated test gates** — typecheck / lint / vitest / build / Playwright (5 commands)
- **§N Acceptance sign-off** — tick boxes per section + tester name + date

---

# §0 — Setup (do this once, before any test below)

This section gets your laptop ready. Allow ~10 minutes the first time, ~3 minutes after.

### 0.1 — Confirm the repo + branch + working directory

**👉 Do this:**

1. Open **PowerShell** on Windows: press `Win+R`, type `powershell`, press Enter.
2. Navigate to the repo:
   ```powershell
   cd C:\Users\kaust\OneDrive\Desktop\FyneStudyLive
   ```
3. Check the branch:
   ```powershell
   git status
   ```

**✅ What you should see:**

- The first line says: `On branch web-phase-1`. This branch is shared by all five web-conversion phases.
- Untracked items include `apps/web/app/quiz/[id]/`, `apps/web/app/exam/[id]/`, `apps/web/components/math/`, `apps/web/components/quiz/`, `apps/web/components/exam/`, several new files under `apps/web/features/quiz/` and `apps/web/features/exams/`, and `Phases/phase-3-manual-tests.md`. Modified files include `apps/web/app/(protected)/library/_components/LibraryClient.tsx`, `apps/web/app/(protected)/classes/_components/StudentClasses.tsx`, `apps/web/components/dashboard/WeakTopicsList.tsx`, `apps/web/app/globals.css`, `apps/web/package.json`. **Leave them alone — Phase 3 has not been committed yet; that's the last thing to do.**

**❓ If something looks different:**

- Says `On branch main` or `On branch phase-4` → wrong branch. Run `git checkout web-phase-1` and re-check.
- Says `fatal: not a git repository` → you're in the wrong folder. Re-run the `cd` command exactly as shown.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### 0.2 — Confirm `apps/web/.env.local` still has the right keys

This file was set up in Phase 1. Phase 3 didn't change it — just confirm it's still present and correct.

**👉 Do this:**

1. In PowerShell:
   ```powershell
   notepad apps/web/.env.local
   ```
2. Notepad opens with the file.

**✅ What you should see (3 lines, in any order):**

```
NEXT_PUBLIC_SUPABASE_URL=https://orqwyazvcthgxoadfxfv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ZfvA-ky5eOQ3c-e9yCiLnQ_c06ZYmz9
NEXT_PUBLIC_ADMIN_URL=https://fyne-study-app-admin.vercel.app
```

There MUST NOT be a `SUPABASE_SERVICE_ROLE_KEY` line. If there is, delete it now.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### 0.3 — Refresh dependencies (Phase 3 added KaTeX)

Phase 3 added 2 new npm packages (`katex`, `react-katex`) plus their typings. If you haven't run install since the Phase 3 code landed, do it now.

**👉 Do this:**

1. In PowerShell, from the repo root:
   ```powershell
   pnpm install
   ```
2. Wait ~30 seconds.

**✅ What you should see:**

- Output ends with `Done in 18s` (or similar).
- Yellow `WARN` lines about peer deps or `Ignored build scripts: canvas, esbuild, ...` are normal.
- The line `apps/web` should appear in the output with `+11 -204` or similar; `+11` is the count of the newly-installed direct + transitive packages.

**❓ If something looks different:**

- `ELIFECYCLE` or `ENOENT` red error → run `pnpm install` from the repo root (not `apps/web/`). If still failing, delete `node_modules` and re-run.
- "Cannot find module 'react-katex'" at later runtime confirms this step was skipped — re-run `pnpm install`.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### 0.4 — Refresh test fixtures (quiz + exam)

The mobile seed scripts are reused to seed the Supabase DB with one published quiz and a small set of exams (draft / scheduled / live / released). Refreshing wipes prior student answers so you start clean.

**👉 Do this:**

1. From the repo root:
   ```powershell
   pnpm seed:quiz-manual-test --reset
   pnpm seed:exam-manual-test --reset
   ```
2. Each command takes ~5 seconds. Each ends with a success line that includes the seeded quiz id / exam ids.

**✅ What you should see (for each):**

```
✓ Reset done
✓ Seed complete
   Quiz id: <uuid>
   Topic id: <uuid>
   Published: true
```

```
✓ Reset done
✓ Seed complete
   Live instant: <uuid>
   Live manual:  <uuid>
   Scheduled:    <uuid>
   Ended released: <uuid>
```

**Write the IDs down** — you'll use them in §A and §B.

**❓ If something looks different:**

- "Cannot connect to Supabase" → DNS / network. Re-run.
- "Missing service-role key" → the seed script needs the SERVICE_ROLE key from `apps/functions/.env.local` (mobile uses it). If you don't have that file, ping me; otherwise the seed picks it up from `apps/mobile/.env.local`'s `SUPABASE_SERVICE_ROLE_KEY` if present, OR from `apps/functions/.env.local`.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### 0.5 — Start the dev server

**👉 Do this:**

1. From the repo root in PowerShell:
   ```powershell
   pnpm --filter @fynestudy/web dev
   ```
2. Wait ~15 seconds.

**✅ What you should see (in the terminal):**

```
> @fynestudy/web@0.0.0 dev …
> next dev

   ▲ Next.js 15.5.18
   - Local:        http://localhost:3000
   - Network:      http://192.168.x.x:3000
   - Environments: .env.local

 ✓ Starting...
 ○ (serwist) Serwist is disabled.
 ✓ Ready in 3.4s
```

The terminal stays running — that's the dev server. **Do NOT close it.**

**❓ If something looks different:**

- "Port 3000 already in use" → another Next.js is already running. Open a NEW PowerShell window and run `taskkill /F /IM node.exe` to kill all Node processes, then re-run.
- "Cannot find module 'react-katex'" → you skipped §0.3. Stop the dev server, run `pnpm install`, re-run.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### 0.6 — Log in as the seed student

**👉 Do this:**

1. Open Chrome → `http://localhost:3000/login`.
2. Email: `review.student@fynestudy.app`
3. Password: `ReviewStudent#2026`
4. Click **Sign in**.
5. Press **F12** to open DevTools — leave docked at the bottom or right; you'll use Console + Network many times below.

**✅ What you should see:**

- URL becomes `http://localhost:3000/`.
- The student dashboard renders (greeting + side-rail with 7 student tabs).
- Console shows no red errors.

**❓ If something looks different:**

- Goes to `/force-password-change` → the seed flag flipped somehow. Set a new password (≥10 chars, upper+lower+digit) and continue.
- Stays on `/login` → check the dev terminal for errors; reload the page.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §A — Quiz: intro → attempt → result → solution

The Phase 3 quiz screen lives at `/quiz/[id]` (outside the protected route group so the side-rail does NOT render — the screen is full-width). It's a 4-stage state machine: **intro** (rules + Start) → **attempt** (questions + auto-save) → **result** (score) → **solution** (per-question review).

---

### A.1 — Open a quiz from the library

**👉 Do this:**

1. From the dashboard, click **Library** in the side-rail.
2. The library opens at `/library`. Drill down: click a subject → a chapter → a topic that mentions **"quiz available"** in its subtitle (this only appears on topics with a published quiz from the §0.4 seed).
3. At the topic page, scroll to the bottom — there's an **amber-tinted** "Practice quizzes" card listing the quizzes on this topic. Each row is a clickable link with the quiz title + duration + marks + attempt count + a chevron.
4. Click the first quiz row.

**✅ What you should see:**

- URL becomes `/quiz/<uuid>`.
- The page is FULL-WIDTH — **no side-rail, no bottom-tabs**. That's correct: the quiz route lives outside the (protected) group on purpose.
- An X close button (top-left).
- A heading with the quiz title in dark-blue (e.g. **"Phase 6 Manual Quiz"** if you used `seed:quiz-manual-test`).
- A subtitle: `N questions · X min`.
- A white box listing the marks scheme (`Correct +4`, `Wrong -1`, `Skip 0`, `Total possible 40`, etc.) — match the seed.
- A big blue **Start Quiz** button.
- Below the button: small grey text "Auto-saves every action. You can refresh or leave and come back."

**❓ If something looks different:**

- 404 / "Quiz not available" → the quiz id is wrong, or the quiz `is_published = false`. Re-run the §0.4 seed.
- Side-rail visible → bug: the route is in the wrong group; tell me.
- No "Start Quiz" button → check Console for an error.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.2 — Click Start → attempt screen renders

**👉 Do this:**

1. Click **Start Quiz**.

**✅ What you should see:**

- The page transitions to the attempt stage.
- A **header bar** at the top: X close button + quiz title (truncated if long) + a **TimerPill** in blue with a clock icon showing **`MM:SS`** (e.g. `15:00` if the quiz is 15 min). The pill is rounded, blue background.
- A **Q1 / N** label + a difficulty badge (`EASY` / `MEDIUM` / `HARD` — green/amber/red).
- The question prompt rendered (plain text + any math via KaTeX — see §J).
- 4 (or however many) options as **OptionRadio** rows: each is a rounded white box with a slate-100 letter circle (A/B/C/D) on the left and the option text on the right.
- Below the last option: a **Flag** button (grey) + a "Clear" link (only when an option is selected).
- A horizontal **NavigationGrid** below: small numbered circles (1, 2, 3, …). The current one (Q1) is filled blue.
- A sticky bottom bar: **Prev** (disabled), the answered/flagged count in the middle (on desktop), **Next** button on the right.

**❓ If something looks different:**

- Timer pill missing or stuck at `--:--` → the `quiz-start` edge fn returned a malformed payload; check Network tab.
- Options not showing → maybe RLS scope wrong; check Console.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.3 — Select an option → it highlights blue + auto-saves

**👉 Do this:**

1. In DevTools, click the **Network** tab. Click the **"Disable cache"** checkbox.
2. Tick the filter to search for `quiz_answers`.
3. Click option **A** for Q1.

**✅ What you should see:**

- Option A's letter circle turns **blue (selected)**. The whole row gets a `border-primary` (blue) outline and a `bg-blue-50` light tint.
- Within ~250 ms, the Network panel shows a `quiz_answers?on_conflict=...` POST/PATCH (PostgREST upsert) returning **201** or **204**.
- The body of that request contains `{ "attempt_id": "...", "question_id": "...", "selected_option_id": "...", "is_flagged": false, "answered_at": "..." }`. **CRITICAL:** confirm the payload does NOT contain `is_correct` — that field belongs to the server-only grading dossier.

**❓ If something looks different:**

- Option doesn't highlight → React state isn't updating. Check Console for errors.
- Auto-save never fires → the `attemptId` isn't being passed down. Check the request flow.
- `is_correct` appears in the payload → STOP. This is a serious leak — ping me.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.4 — Flag a question → it shows in the navigation grid

**👉 Do this:**

1. With Q1 still answered (A), click the **Flag** button (the flag icon).

**✅ What you should see:**

- The Flag button changes color: amber background, amber outline, the label changes to **"Flagged"**.
- In the **NavigationGrid**, the Q1 circle now has a **red tint** (the **"flagged + answered"** state — pink/red bg with red border).
- Network: another upsert fires within ~250 ms with `is_flagged: true`.

**👉 Click Flag again to un-flag** — the button returns to grey ("Flag"), and the grid circle returns to blue (still answered, no longer flagged). One more auto-save fires.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.5 — Navigation grid: tap Q3 → jumps there

**👉 Do this:**

1. In the bottom NavigationGrid, click circle **3**.

**✅ What you should see:**

- The grid Q3 circle is now blue (current).
- The main area shows Q3's prompt and options. The Prev button becomes enabled.
- The header bar's TimerPill is still ticking — it doesn't reset on navigation.

**👉 Now click circle 1** → back to Q1. Confirm your previous A selection is still highlighted.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.6 — Refresh mid-attempt → resumes in place

**👉 Do this:**

1. With some questions answered + a flag set, press **F5** (reload the page).
2. Wait 2 seconds for `quiz-start` to refetch.

**✅ What you should see:**

- After a brief loading state, the page reopens directly on the **attempt** stage (NOT intro).
- Your previous selections + flags are restored — Q1 still shows A selected, Q3's flag still on, etc.
- The TimerPill picks up where it left off (the deadline is the same, so the remaining time has decremented by the wall-clock seconds you took to reload).

**❓ If something looks different:**

- Lands on intro stage → `useQuizStart` didn't pick up the in-flight attempt. Check `saved_answers.length` in the Network response — if it's > 0, the hydration logic in QuizClient is broken. Ping me.
- Selections lost → the auto-save from §A.3 didn't actually land. Check Network for the upserts.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.7 — Submit → confirmation dialog → result

**👉 Do this:**

1. Click **Next** all the way to the last question (or click circle N in the grid).
2. On the last question, the Next button becomes a green **Submit** button.
3. Click **Submit**.

**✅ What you should see:**

- A modal dialog opens with the title **"Submit quiz?"**.
- Subtitle: `You've answered N/total, flagged X.` (X only shown if > 0).
- If you left questions unanswered, an amber box appears listing them by number (e.g. `Q2, Q5`).
- Two buttons: a grey **Cancel** and a green **Submit**.
4. Click **Submit** in the dialog.

**✅ What you should see next:**

- The Submit button label briefly says **"Submitting…"**.
- The screen transitions to the **result** stage:
  - A big centered score: `XX / YY` and a `%`.
  - Three coloured stats below: **Correct** (emerald), **Wrong** (red), **Skipped** (slate).
  - A blue **Review solutions** button.
  - An outlined **Retake** button.
  - A subtle **Back to Library** link.
- DevTools → Network: there should be ONE `quiz-submit` POST returning a 200 with the full solution dossier.

**❓ If something looks different:**

- "Submit failed" toast → check Network for the quiz-submit response status. 409 means you already submitted; 403 means scope check failed.
- Stuck on "Submitting…" → the request never completed. Check the dev terminal for an edge-fn error.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.8 — Review solutions → per-question SolutionCard

**👉 Do this:**

1. On the result screen, click **Review solutions**.

**✅ What you should see:**

- The URL stays at `/quiz/<uuid>`.
- A header with a back arrow + "Solutions" title.
- A scrollable list of **SolutionCard** rows — one per question. Each card contains:
  - The same QuestionCard (Q#, difficulty, prompt).
  - 4 OptionRadio rows (now disabled — no hover). The visual state encodes the outcome:
    - The correct option has a **green border + emerald letter**.
    - If your selection was wrong, your option has a **red border + red bg**.
    - If you selected the correct option, BOTH the letter circle and a small **check icon** appear in emerald.
    - Skipped questions show no "your" option highlight, only the correct one in green.
  - An **Explanation** section in a slate-50 box with the explanation_md rendered (math is rendered).
  - A footer bar: outcome label (Correct/Wrong/Skipped) + the point value (e.g. `Correct (+4)`, `Wrong (-1)`, `Skipped (+0)`), and a `FLAGGED` chip on the right if you flagged it.

**❓ If something looks different:**

- All options look the same colour → the `correct_option_id` / `your_option_id` matching broke. Check the SolutionCard logic.
- Explanation shows raw `$x^2$` text instead of rendered math → the MathText KaTeX import didn't load. Check Console for a CSS error.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.9 — Solution stage: related-content link routes to /video or /pdf

**👉 Do this:**

1. Scroll the solution list to find a question whose explanation has a **Related: <title>** link at the bottom (with a play-circle or file-text icon).
2. Click that link.

**✅ What you should see:**

- If the icon was a play-circle (red), URL becomes `/video/<contentId>` and the YouTube wrapper player loads.
- If the icon was a file-text (emerald), URL becomes `/pdf/<contentId>` and the PDF viewer opens.
- Press the browser back button — you return to the solution list at the same scroll position.

**❓ If something looks different:**

- 404 on /video or /pdf → the related_content.id in the solution dossier is stale or the content was deleted. Check Console.

**👉 If the seed quiz has no question_solutions row with a related_content_id, this test is N/A.** Mark accordingly.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _reason:_

---

### A.10 — Retake → new attempt starts fresh

**👉 Do this:**

1. Hit the back arrow on the solution screen → back to result.
2. Click **Retake**.

**✅ What you should see:**

- A brief loading state, then the **intro** stage re-renders.
- Click **Start Quiz** → a new attempt screen opens, with the answer state EMPTY (no selections, no flags) and the timer at full duration.
- DevTools → Network: confirm a fresh `quiz-start` POST fired and returned a new `attempt_id` (different from the previous one).

**❓ If something looks different:**

- Answers from the prior attempt still appear → the new attempt was incorrectly bound to the same `attempt_id`. Check `useQuizStart` reset logic.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §B — Exam: pre / countdown stage

The Phase 3 exam screen lives at `/exam/[id]` (also outside the protected group). It's a 5-stage state machine: **pre** (countdown / Enter Exam) → **attempt** (locked UI) → **submitted** (waiting for release) → **result** → **solution**. The pre stage handles three timing scenarios: waiting (before starts_at), live (in [starts_at, ends_at]), and ended.

For §B.1–§B.4 you'll need the seed exam ids from §0.4.

---

### B.1 — Open a scheduled exam from /classes → countdown

**👉 Do this:**

1. Click **Classes** in the side-rail.
2. Scroll to the **Examinations** section. You should see the seeded exams listed with status pills (Scheduled / Live / Results pending / Results out / Ended).
3. Click the row for the **Scheduled** exam (one with `starts_at` in the future). The whole row is now a link (Phase 3 wired this up).

**✅ What you should see:**

- URL becomes `/exam/<uuid>`.
- The page is full-width — no side-rail.
- A close X button (top-left).
- The exam title in dark-blue.
- A subtitle: `Day, dd Mon hh:mm · X min · N questions` (all in IST).
- A **Rules** box with 4 bullets ("Server clock decides…", "Leaving this tab is LOGGED…", "Auto-saves…", "Results are …").
- A centered card showing **"Starts in"** and a big tabular-nums countdown (e.g. `1h 23m 45s` or `2d 4h 30m`). The countdown ticks every second.
- A grey, **disabled** "Enter Exam" button — you can't start an exam before its window opens.

**❓ If something looks different:**

- Lands on "exam not visible to you" red error → the student isn't in the exam's batch. Check the seed.
- Countdown stuck at `--` → JavaScript error; check Console.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### B.2 — Switch to a Live exam → Enter Exam button enables

**👉 Do this:**

1. Go back to /classes. Click the **Live** exam row.
2. URL becomes `/exam/<uuid>`.

**✅ What you should see:**

- The page header + rules look the same as B.1.
- The centered card now shows:
  - A small red dot + **"Live now"**.
  - Subtitle: `Window closes in 0h XXm YYs` (counting down).
  - An ENABLED blue **Enter Exam** button.

**❓ If something looks different:**

- Says "Starts in" instead of "Live now" → your laptop clock is off, OR the seed's starts_at is wrong. Re-run `seed:exam-manual-test`.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### B.3 — Click Enter Exam → attempt screen renders

**👉 Do this:**

1. Click **Enter Exam**.

**✅ What you should see:**

- The button briefly says "Starting…" with a spinner.
- DevTools → Network: an `exam-start` POST fires, returns 200 with `attempt_id`, `deadline_at`, `server_now`, `tab_switch_count` etc. — but importantly **without `correct_option_id` or `is_correct`**. Verify by clicking the response and searching the body.
- The page transitions to the **attempt** stage:
  - The header bar now has a slightly more rigid look (white background with a bottom border).
  - The TimerPill in the top-right shows the remaining time computed against the server clock. Initially may show `--:--` for a fraction of a second while `useServerTimeOffset` syncs — then resolves to e.g. `30:00` for a 30-min exam.
  - Question card + options + nav grid (same layout as the quiz).

**❓ If something looks different:**

- Timer pill stays at `--:--` for more than 5 seconds → `server-time` edge fn is unreachable. Check Console + Network.
- "exam has ended" red banner → the seed exam's window closed; re-seed.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### B.4 — Open an Ended (already-submitted) exam → goes to result, not pre

**👉 Do this:**

1. Press the back arrow (browser) to leave the attempt — answer at least one question and click X (top-left). Actually no — DO NOT submit yet; just navigate via the X button. (We're going to come back to this attempt in §C.)
2. For this test, find an exam that you've already submitted (or in the seed: **Ended released** exam). Click it from /classes.

**✅ What you should see (D-181 re-open routing):**

- The page DOES NOT show the pre stage. It either:
  - **Instant release**: lands directly on the **result** stage (score + solutions button).
  - **Manual release without released_at**: lands on the **submitted** stage (locked waiting card).
  - **Manual release WITH released_at set**: lands on the **result** stage.
- This routing happens silently — there's no flicker through pre stage first.

**❓ If something looks different:**

- Lands on pre stage with an "Enter Exam" / "View Result" button → the D-181 routing isn't firing. Check `useExamPreInfo.existing_attempt.submitted_at`.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §C — Exam: locked attempt UI + auto-save + resume

This section continues from §B.3. You should be on the **attempt** stage of the Live exam.

---

### C.1 — No side-rail, no bottom tabs (locked layout)

**👉 Do this:**

1. Resize your window to ≥ 1280px wide. Look at the page.

**✅ What you should see:**

- Even at desktop width, there's **NO side-rail** on the left.
- No bottom-tabs bar on the mobile layout (resize to 390px and re-check — still locked).
- The exam attempt takes the full viewport width.

**❓ If something looks different:**

- Side-rail visible → the route `/exam/[id]` is incorrectly inside the (protected) group. Tell me.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### C.2 — Right-click is disabled on the question area

**👉 Do this:**

1. Right-click on the question prompt text.

**✅ What you should see:**

- **No context menu opens.** The browser silently swallows the right-click.
- This is a best-effort deterrent only — the server is the real guard. The exam screen attaches a `contextmenu` listener that calls `preventDefault()`.

**❓ If something looks different:**

- Right-click menu opens → the lockdown effect isn't applied. Check the `useEffect` in ExamClient that adds the listener.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### C.3 — Text selection is disabled

**👉 Do this:**

1. Try to click-drag-select a phrase from the question text.

**✅ What you should see:**

- Nothing gets selected — the text doesn't highlight. The page's `<body>` has `select-none` applied during the attempt stage.
- (You can still copy from the URL bar etc. — only the attempt content is locked.)

**❓ If something looks different:**

- Text selects normally → the `select-none` class wasn't applied. Check ExamClient's `useEffect`.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### C.4 — Select an option → auto-save fires, no is_correct in payload

**👉 Do this:**

1. DevTools → Network → filter for `exam_answers`.
2. Click option A for the current question.

**✅ What you should see:**

- Within ~500 ms (note: exam debounce is 500ms, quiz is 250ms), a `exam_answers?on_conflict=...` upsert fires returning 201/204.
- The payload contains `{ attempt_id, question_id, selected_option_id, is_flagged, answered_at }`. **NO `is_correct`.**

**❓ If something looks different:**

- 403 returned → either you're past the deadline (the deadline-cut RLS kicked in) OR your auth token is stale. The server is correctly rejecting; try clicking the option again.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### C.5 — Answer 3 questions, set 1 flag

**👉 Do this:**

1. Q1: select A.
2. Q2: select B + click Flag.
3. Q3: select C.

**✅ What you should see:**

- Each click fires an auto-save within 500ms (see Network).
- The navigation grid colors reflect the state: Q1 green, Q2 red (flagged-answered), Q3 green, Q4+ empty.
- The bottom bar's text reads "Answered 3/N · 1 flagged".

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### C.6 — Refresh mid-attempt → resumes with same remaining time

**👉 Do this:**

1. Note the TimerPill reading (e.g. `28:32`).
2. Press **F5** to reload.
3. Wait 2-3 seconds.

**✅ What you should see:**

- After a brief loading state, the **attempt** stage re-renders directly (NOT pre stage — D-181 honored).
- Your selections + flag are restored.
- The TimerPill picks up where it should be: roughly `28:32` minus the seconds it took to reload + render.
- The `tab_switch_count` is preserved (still 0 if you haven't switched tabs).

**❓ If something looks different:**

- TimerPill resets to full duration → bug in deadline derivation. Ping me.
- Selections lost → check the `saved_answers` in the exam-start response.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### C.7 — Clear selection works

**👉 Do this:**

1. On any answered question, look for the **Clear** link to the right of the Flag button.
2. Click it.

**✅ What you should see:**

- The option highlight disappears.
- Auto-save fires with `selected_option_id: null`.
- The navigation grid circle returns to "flagged-unanswered" (if it was flagged) or "unanswered".

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### C.8 — Click X (top-left) → returns to /classes without submitting

**👉 Do this:**

1. Click the X button (top-left).

**✅ What you should see:**

- URL becomes `/classes`.
- The exam is still in-flight — refresh the row in /classes shows the same status (Live).
- Coming back to the exam (click the row again) lands on attempt stage with everything restored.

**❓ Note:** the X button title hint says "Leaving counts as a tab switch" — but actually X+route-leave does NOT trigger the tab-switch logger (the route unmounts before the visibilitychange fires). That's mobile-parity behavior. If your teacher policy needs to track this, that's a future enhancement.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §D — Server-anchored timer (D-183) + 60-s resync + clock skew

This section is the **highest-correctness** part of Phase 3. The exam timer must derive its remaining time from the **server's clock**, not the device clock, so a student can't extend their time by skewing their laptop clock.

Re-enter the Live exam attempt (from §C) for these tests.

---

### D.1 — Initial server-time sync on attempt entry

**👉 Do this:**

1. DevTools → Network → filter for `server-time`.
2. Close+re-open the attempt (X → click exam row).

**✅ What you should see:**

- A `server-time` POST fires shortly after the attempt page mounts (within 1-2 seconds).
- The response body is `{ "now": "...ISO...", "epoch_ms": 1234567890 }`.
- The TimerPill's reading reflects the server's clock, not your device's. (If your laptop is synced to NTP, the difference is < 100ms and invisible. The next test makes it visible.)

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### D.2 — 60-s resync interval

**👉 Do this:**

1. Stay on the attempt page for 90 seconds (do nothing — just watch the TimerPill).
2. Watch the Network panel for `server-time` calls.

**✅ What you should see:**

- A `server-time` POST fires at ~60s, ~120s, etc. — every 60 seconds during the attempt.
- The TimerPill keeps ticking down smoothly between syncs.

**❓ If something looks different:**

- No periodic `server-time` calls → the `setInterval` in `useServerTimeOffset` isn't running. Tell me.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### D.3 — Resync on window focus

**👉 Do this:**

1. Open a NEW Chrome tab (Ctrl+T) and switch to it.
2. Wait 5 seconds.
3. Switch back to the exam tab.

**✅ What you should see:**

- An **immediate** `server-time` POST fires the moment the exam tab regains focus (the `window.addEventListener("focus", ...)` in `useServerTimeOffset`).
- Note: this tab switch will ALSO trigger the tab-switch logger — you'll see a yellow `TabSwitchBanner` at the top with "You left the exam tab. Switches: 1". That's §E territory; for now just note it.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### D.4 — Clock-skew attack: set device clock 5 minutes ahead → timer corrects

**👉 Do this:**

1. **Important: this changes your laptop clock — write down the real time first.**
2. Open **Settings → Time & language → Date & time** (Windows).
3. Toggle off **"Set time automatically"**.
4. Click **Change** and set the time **5 minutes AHEAD** of what it actually is. Click Change.
5. Return to the exam tab.
6. Within 60 seconds, the next `server-time` resync should fire.

**✅ What you should see:**

- Before the resync, the TimerPill may briefly jump down by 5 minutes (because Date.now() now reads 5 min ahead, but the mount-time offset is stale).
- **After the resync** (within 60s of the clock change), the TimerPill **corrects itself** — `offsetMs` becomes negative (server is "5 min behind" the device), and `remaining = deadline - (deviceNow + offsetMs)` corrects to the true server-clock-based remaining.
- A late `exam_answers` write (try clicking a different option NOW that the clock is fast) — should be rejected with **403** by the deadline-cut RLS IF the device clock is past the deadline. If your exam still has 25+ minutes left, even with +5 min of skew you're not at the deadline yet — the write succeeds. This is correct.

**👉 Critical test:** with the clock still 5 min ahead, advance the clock further so you cross the SERVER's deadline (impossible with 25 min remaining, but if you set the clock to, say, `2026-12-31`, the device will think the deadline has passed. The TimerPill will show `00:00` briefly until the next resync corrects it.

**👉 Reset the clock:** Settings → Date & time → toggle "Set time automatically" back ON.

**❓ If something looks different:**

- TimerPill stays at the skewed value (doesn't correct) → `useServerTimeOffset` isn't applying the new offset. Check `setOffsetMs` calls.
- Late writes succeed past the server deadline → the `exam_answers` RLS deadline-cut isn't installed. Check the migration `20260520xxxx_exam_answers_deadline_cut`.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### D.5 — TimerPill turns red at ≤ 60 s

**👉 Do this:**

1. (Optional — only if you have a short test exam.) Wait for the timer to reach `01:00` or below.

**✅ What you should see:**

- At `01:00`, the TimerPill background changes from blue to **red** (`bg-red-100`) with red text and a red clock icon. The `data-warning="true"` attribute is set.
- At `00:00`, the auto-submit fires.

**👉 If your seed exam is too long to wait, you can mark this PASS based on the unit test (`TimerPill.test.tsx > turns red when remaining ≤ 60s`).**

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _reason: unit test covers it_

---

# §E — Tab-switch logging + TabSwitchBanner

Phase 3 uses the **Page Visibility API** + `window.blur` to detect when the student leaves the exam tab. Each detection bumps a server-side counter via `exam-tab-switch` (fire-and-forget). The TabSwitchBanner renders the count.

---

### E.1 — Switch to a new tab → banner appears

**👉 Do this:**

1. Re-enter the Live exam attempt.
2. Open a new Chrome tab (Ctrl+T) and visit any URL (e.g. google.com).
3. Wait 3 seconds.
4. Switch back to the exam tab.

**✅ What you should see:**

- At the top of the exam attempt screen, a **yellow banner** appears: "You left the exam tab. Switches: 1".
- The banner has a shield-alert icon on the left.
- DevTools → Network: an `exam-tab-switch` POST fired with `attempt_id`. The response body is `{ "tab_switch_count": 1 }`.
- The banner does NOT auto-dismiss — it stays for the rest of the attempt (mirrors mobile).

**❓ If something looks different:**

- No banner appears → the `useExamTabSwitchLogger` isn't attaching the visibilitychange listener. Check ExamClient.
- Banner shows count 0 → the count comes from the server response; check the response body.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### E.2 — Two more tab switches → still yellow at 2, red at 3+

**👉 Do this:**

1. Switch to a new tab + back → 2 switches.
2. Switch again → 3 switches.

**✅ What you should see:**

- At 2 switches: banner is yellow, count = 2.
- At 3 switches: banner turns **red** (`bg-red-50`), label includes " · Further switches may be reviewed by your teacher.", and the icon's `data-severity` is `severe`.
- Each switch fires one `exam-tab-switch` request.

**❓ If something looks different:**

- Switches not registering → on Windows + Chrome, Alt+Tab may not always trigger `visibilitychange`. The hook also listens for `window.blur` as a fallback. If neither fires, try a more explicit tab switch (Ctrl+T then Ctrl+1).

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### E.3 — Banner count survives refresh

**👉 Do this:**

1. Note the banner count (e.g. 3).
2. Refresh the page (F5).

**✅ What you should see:**

- After hydration, the banner re-renders with the same count (3) — because `exam-start` returns the persisted `tab_switch_count` and the hook seeds it via `setInitial`.

**❓ If something looks different:**

- Banner disappears after refresh → seeding logic in ExamClient isn't working. Check `tabSwitch.setInitial(...)`.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### E.4 — D-182: silent on submitted

**👉 Do this:**

1. (Optional — can be done after §F if you submit there.) After submitting an exam, switch tabs again.

**✅ What you should see:**

- The `exam-tab-switch` fires but the server returns the existing count without bumping (because the attempt is submitted). The client's local `count` may bump optimistically but the visible result-stage UI doesn't show the banner anyway.
- No error in the console, no broken UI.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _reason: covered by unit test `examTabSwitchLogger > silent on 404`_

---

# §F — Auto-submit at deadline

The exam timer fires `onExpire` exactly once when the remaining time reaches 0. The handler calls `useExamSubmit.submit()` with `auto = true`. The result stage is shown immediately (instant-release) or the submitted stage (manual-release).

For these tests you'll need a **short** test exam. The seed scripts in §0.4 don't create one by default. **Skip §F.1 if you don't have a short exam — the unit test covers the trigger logic.**

---

### F.1 — Run the exam to deadline → auto-submits without click

**👉 Do this (only if you have a short test exam):**

1. Enter the short exam.
2. Watch the TimerPill tick down to `00:00`.

**✅ What you should see:**

- At `00:00`, the page transitions to the **result** stage (instant) or **submitted** stage (manual).
- The user did NOT click any submit button.
- DevTools → Network: exactly ONE `exam-submit` request fired with `auto_submitted=true` in the response.

**❓ If something looks different:**

- Timer reaches 0 but no submit → check Console for an error in `onTimerExpired`. The `firedRef` guard in TimerPill prevents double-fire but should NOT block the first fire.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _reason:_

---

### F.2 — Auto-submit fires exactly once (no duplicate submission)

This is covered by `apps/web/components/quiz/__tests__/TimerPill.test.tsx > calls onExpire exactly once`. Mark PASS based on the unit test, or repeat F.1 with the dev tools open to confirm only one `exam-submit` request fires.

`Result:` [ ] PASS — unit test covers it.

---

### F.3 — Confirmation dialog warns about unanswered questions

**👉 Do this:**

1. Enter any live exam attempt.
2. Answer Q1 only. Leave the rest blank.
3. Click **Next** to Q2, Q3, … up to the last question.
4. On the last question, click **Submit** (the green button).

**✅ What you should see:**

- The submit confirmation dialog opens.
- Subtitle: "You've answered 1/N. This cannot be undone."
- An amber alert box: "(N−1) unanswered questions: Q2, Q3, Q4, …" (with `data-testid="unanswered-list"`).
- Two buttons: **Cancel** + green **Submit**.

**👉 Click Cancel** → the dialog closes, you stay on the attempt screen.

**👉 Click Submit again, then Submit in the dialog** → you submit (jump to result/submitted).

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §G — Manual-release exam: locked-result waiting + auto-flip on release

A **manual-release** exam (`exams.result_release = 'manual'`) doesn't reveal the score until the teacher/admin explicitly releases it. The exam-attempt-result edge fn returns **HTTP 423** (Locked) for the student until then.

---

### G.1 — Submit a manual-release exam → submitted screen

**👉 Do this:**

1. From /classes, click the **Live manual** exam. (You may need to wait for one to be live, or use the seed.)
2. Enter the exam, answer all questions, and click Submit → confirm.

**✅ What you should see:**

- The page transitions to the **submitted** stage, NOT result.
- A `LockedResultCard` displays:
  - A lock icon in a slate circle.
  - Heading: "Results will be available after your teacher releases them"
  - A paragraph explaining auto-refresh on focus.
  - "Submitted: <timestamp>" line.
  - A "Refresh now" outline button.
- DevTools → Network: the `exam-submit` response includes `results_released: false` (no score). A subsequent `exam-attempt-result` POST returns **HTTP 423** with `status: "submitted_awaiting_release"`.

**❓ If something looks different:**

- Lands on result immediately → either the exam is instant-release OR `results_released_at` is already set. Re-check the seed.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### G.2 — Manual Refresh button re-fetches

**👉 Do this:**

1. On the submitted screen, click **Refresh now**.

**✅ What you should see:**

- The button shows a spinning icon + "Checking…".
- A `exam-attempt-result` POST fires, returns 423 again (still locked).
- The card stays the same.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### G.3 — Admin releases results in a second tab

**👉 Do this:**

1. Open a NEW browser tab.
2. Sign in to the admin panel: `https://fyne-study-app-admin.vercel.app` with `owner@fynestudy.example.com` / `FyneOwner#2026` + TOTP.
3. Sidebar → **Exams** → find the manual-release exam you just submitted.
4. Click the exam row to open its detail page.
5. Click **Release results** (the button on the exam detail page).
6. Confirm the action.

**✅ What you should see in the admin panel:**

- A success toast / banner: "Results released to <N> students".
- The exam row now shows a `results_released_at` timestamp.

**❓ If you can't find the Release results button:** in some admin builds the action is hidden until at least one attempt is submitted. Confirm by checking the exam's attempts list — should show your submission.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### G.4 — Student tab auto-flips to result on focus

**👉 Do this:**

1. Switch back to the original Chrome tab (with the student exam in submitted stage).
2. Watch what happens within ~2 seconds.

**✅ What you should see:**

- On window focus, `useExamAttemptResult` re-fetches (because of the focus listener) and now returns 200 with the full score.
- ExamClient's `useEffect` watches for `lazyResult.data` arrival and auto-flips the stage from **submitted** → **result**.
- The result screen shows the score breakdown.

**❓ If something looks different:**

- Stays on submitted screen → the focus refetch didn't trigger. Click "Refresh now" manually.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §H — Instant-release exam + D-181 re-open routing

An **instant-release** exam shows the score immediately on submit. D-181 says: re-opening a submitted instant exam must route directly to the **result** stage, NOT restart.

---

### H.1 — Submit an instant-release exam → result immediately

**👉 Do this:**

1. From /classes, click the **Live instant** exam.
2. Enter, answer, submit, confirm.

**✅ What you should see:**

- The page transitions directly to the **result** stage (NOT submitted).
- DevTools → Network: the `exam-submit` response includes `results_released: true` with score, max_score, etc.
- The score breakdown card is visible.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### H.2 — D-181: Close the tab, re-open the exam → lands on result, not restart

**👉 Do this:**

1. Click the X (top-left) — back to /classes.
2. Click the same exam row again.

**✅ What you should see:**

- URL becomes `/exam/<uuid>`.
- The page renders directly on the **result** stage (with the same score).
- It does NOT go through pre → attempt → submitted → result. It does NOT try to start a new attempt.
- This proves the D-181 routing reads `existing_attempt.submitted_at` and `result_release` correctly.

**❓ If something looks different:**

- Lands on pre stage → bug. Mobile shipped this exact bug once — make sure it's not reintroduced. Check `useExamPreInfo.data.existing_attempt.submitted_at` and the `useEffect` in ExamClient that flips to result.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### H.3 — D-181: Refresh on the result stage → stays on result

**👉 Do this:**

1. On the result stage (instant-release exam), press F5.

**✅ What you should see:**

- The page reloads.
- After hydration, lands on result stage again (NOT pre).

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### H.4 — D-181: Same flow on a manual-release exam that's already released

**👉 Do this:**

1. From /classes, click the manual-release exam that you released in §G.3.
2. Close the tab (X button), then re-open the same exam.

**✅ What you should see:**

- Lands directly on **result** stage. Because `results_released_at` is set, the manual exam's re-open follows the same rule as instant.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §I — Solution stage: correctness + explanations + related-content

Solutions are loaded on-demand via `exam-attempt-result` (for exams) or `quiz-attempt-result` / `quiz-submit` (for quizzes). The dossier includes `is_correct` per option, the `explanation_md`, and optional `related_content`.

---

### I.1 — Exam Review solutions → SolutionCard list

**👉 Do this:**

1. From the exam result screen, click **Review solutions**.

**✅ What you should see:**

- The stage transitions to **solution**.
- A back arrow (Chevron-left) + "Solutions" title in the header.
- A scrollable list of solution cards. For each:
  - Question prompt rendered (math via KaTeX if any).
  - Options with the right outcome encoding (see A.8 for the color rules).
  - Explanation box.
  - Outcome footer.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### I.2 — Solution cards show your_option vs. correct_option clearly

**👉 Do this:**

1. Scroll through your solutions and find one where you got it wrong.

**✅ What you should see:**

- The option you picked has a **red border + red bg** + red letter circle.
- The actually-correct option has a **green border + green bg** + emerald letter circle with a check icon.
- All other options are default (no special highlight).

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### I.3 — Skipped questions show only the correct option

**👉 Do this:**

1. Find a question you skipped (no selection).

**✅ What you should see:**

- The correct option has a **green outline** but no red anywhere (because there's no "your" option to mark wrong).
- The outcome footer reads "Skipped (+0)" (or whatever the marks_skip value is).

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### I.4 — Related-content link routes correctly

Same test as A.9 — quiz solution related links go to `/video/[id]` or `/pdf/[id]`. The exam solution cards use the SAME SolutionCard component, so this should work identically.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _reason:_

---

# §J — Math rendering: inline + block + non-math fast path

KaTeX is mounted ONLY when the input contains math delimiters (D-178). Plain text bypasses KaTeX entirely for performance.

---

### J.1 — Inline math `$x^2$` renders as a sub/super-scripted equation

**👉 Do this:**

1. Find a question (in quiz or exam) whose prompt contains `$` delimited math.
2. Look at the rendered prompt.

**✅ What you should see:**

- The math is rendered as **typeset math** with proper sub/super-scripts (e.g. x² with the 2 raised).
- The surrounding plain text is in the regular font.
- Inspecting the DOM (F12 → Elements) shows a `.katex` span surrounding the math.

**❓ If something looks different:**

- Math shows as raw `$x^2$` text → KaTeX CSS isn't loaded. Check `apps/web/app/globals.css` for `@import "katex/dist/katex.min.css";`.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _reason: no math question_

---

### J.2 — Block math `$$...$$` renders centered on its own line

**👉 Do this:**

1. Find a question with `$$` delimiters.

**✅ What you should see:**

- The math is rendered as a **block** (own line, centered) with larger size.
- Inspecting the DOM shows a `.katex-display` span (the block variant).

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _reason:_

---

### J.3 — Plain-text question does NOT mount KaTeX

**👉 Do this:**

1. Find a question with NO math (the seed has at least one).
2. F12 → Elements → inspect the prompt span.

**✅ What you should see:**

- The prompt is rendered as a `<span>` with the text directly inside.
- **No `.katex` class anywhere** in the prompt subtree. (The unit test `MathText > renders plain text in a span without mounting KaTeX` covers this too.)

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### J.4 — Markdown bold/italic + newlines render

**👉 Do this:**

1. If any seed question uses `**bold**`, `*italic*`, or has multi-line prompts, check those.

**✅ What you should see:**

- `**word**` renders as **word** (bold).
- `*word*` renders as *word* (italic).
- `\n` in the source renders as a line break.

**👉 N/A if the seed has no such formatting.** Unit tests cover the parser.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _reason:_

---

### J.5 — Math identical to the mobile app

**👉 Do this:**

1. (Optional) Open the same quiz on the mobile app (Expo Go) and on the web — same question.

**✅ What you should see:**

- The rendered math is visually identical. Mobile uses a KaTeX-in-WebView path; web uses react-katex. Same KaTeX engine, same output.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _reason: mobile not available_

---

# §K — Security checks (the WHOLE point of Phase 3)

This section is the make-or-break for Phase 3. Even a single `is_correct` leak during an attempt is a P0 bug.

---

### K.1 — During an attempt, NO `is_correct` in any response body

**👉 Do this:**

1. Enter a fresh quiz or exam attempt.
2. DevTools → Network → click any of the requests in the list (e.g. the `quiz-start` or `exam-start` response).
3. Press **Ctrl+F** in DevTools to open the response-body search.
4. Search for `is_correct` across the responses (or, in the Filter box at the top of the Network panel, type `is_correct` to see all responses containing it).

**✅ What you should see:**

- **ZERO matches** for `is_correct` in any response body during the attempt stage.
- The `quiz-start` / `exam-start` response shows the questions + options, but each option has only `{ id, text_md, image_url }` — no `is_correct` key.

**❓ If you find a match:** STOP. Take a screenshot of the response body and the URL. Ping me immediately. This is a P0 leak.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### K.2 — Same check on `correct_option_id`, `answer_key`, `solution_text`

**👉 Do this:**

1. Same as K.1, but search for `correct_option_id`, then `answer_key`, then `solution_text`, then `solution_image_url`.

**✅ What you should see:**

- Zero matches for ALL of these keys during the attempt stage. Only the post-submit `quiz-submit` / `exam-attempt-result` responses contain them.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### K.3 — No service-role key in the JS bundle

**👉 Do this:**

1. Stop the dev server. Run a production build:
   ```powershell
   pnpm --filter @fynestudy/web build
   ```
2. Wait for it to finish.
3. Search the static bundle:
   ```powershell
   Get-ChildItem apps/web/.next/static -Recurse -Include *.js | Select-String -Pattern "SUPABASE_SERVICE_ROLE|service_role" -List
   ```

**✅ What you should see:**

- No output. Zero matches. The service-role key is NEVER in the static bundle.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### K.4 — Images load via signed URLs only

**👉 Do this:**

1. Find a question with a prompt image OR option image.
2. F12 → Elements → click the `<img>` tag → look at its `src` attribute.

**✅ What you should see:**

- The image URL is a **signed Supabase Storage URL**: it starts with `https://orqwyazvcthgxoadfxfv.supabase.co/storage/v1/object/sign/exam-images/...` and contains a `?token=...` query parameter (the JWT-style signature).
- The URL is **NOT** a public bucket URL (`/public/`) — `exam-images` is a private bucket.

**❓ If something looks different:**

- URL contains `/public/` → the bucket was misconfigured. Check `apps/functions/quiz-start/index.ts` for the bucket name + sign flow.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _reason: no image question_

---

### K.5 — `exam_answers` write after deadline returns 403

This is the server-side defense-in-depth check that backs up the client timer.

**👉 Do this:**

1. (See §D.4 — set the device clock 5 min ahead so it's past the deadline.)
2. With the clock ahead, click an option.

**✅ What you should see:**

- The `exam_answers` upsert fails with **HTTP 403** (visible in Network).
- The student's local UI may still show the option as selected (optimistic UI), but on next reload the server-side state will not reflect it (because the write was rejected).
- The auto-save's onError fires; the change is re-queued but will fail again. This is acceptable — the server is the source of truth.

**👉 Reset your clock back to automatic.**

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _reason: skipped clock manipulation_

---

# §L — Responsive layout + carry-overs

---

### L.1 — Desktop: quiz attempt fills available width without overflow

**👉 Do this:**

1. Make sure your Chrome window is ≥ 1024px wide.
2. Re-enter a quiz attempt.

**✅ What you should see:**

- The attempt content (question card + options + nav grid) is centered with `max-w-2xl` (~672px). No side-rail.
- The bottom nav bar (Prev/Submit) sticks to the bottom of the viewport.
- No horizontal scrollbar.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### L.2 — Mobile-web: quiz attempt usable at 320 px wide

**👉 Do this:**

1. F12 → device-emulation toggle (Ctrl+Shift+M).
2. Set width to 320 px (small iPhone SE).
3. Re-enter the quiz attempt.

**✅ What you should see:**

- All controls are reachable: header bar (X + title + TimerPill), question card, options, flag/clear row, nav grid, Prev/Submit.
- The TimerPill remains visible in the header even at 320 px (the title truncates if necessary, the pill never wraps off-screen).
- The nav grid scrolls horizontally if there are many questions.
- No horizontal page scroll.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### L.3 — iOS Safari (carry-over)

**👉 Carry-over:** test on iOS Safari after the Vercel deploy ships HTTPS. iOS Safari has its own quirks with `visibilitychange` + `select-none` + KaTeX font loading — verify all of these work on real Safari.

`Result:` [ ] CARRY-OVER (Vercel deploy)

---

### L.4 — Android Chrome (carry-over)

**👉 Carry-over:** test on Android Chrome (a Redmi 8A or similar low-end device) after the Vercel deploy. Verify cold-start under 5 seconds and the attempt + submit flow.

`Result:` [ ] CARRY-OVER (Vercel deploy)

---

# §M — Automated test gates (run from PowerShell)

Run each command from the repo root. Stop the dev server first (`Ctrl+C` twice + Y).

### M.1 — Typecheck

```powershell
pnpm --filter @fynestudy/web typecheck
```

**✅ Expected:** silent (no errors). Exit code 0.

`Result:` [ ] PASS · [ ] FAIL

---

### M.2 — Lint

```powershell
pnpm --filter @fynestudy/web lint
```

**✅ Expected:** no error output, no warnings. Exit code 0.

`Result:` [ ] PASS · [ ] FAIL

---

### M.3 — Unit tests (Vitest)

```powershell
pnpm --filter @fynestudy/web test
```

**✅ Expected (last lines):**

```
 Test Files  15 passed (15)
      Tests  91 passed (91)
```

The 15 files include the 6 Phase 3 additions:
- `components/math/__tests__/MathText.test.tsx` (16 tests — parser + render)
- `components/quiz/__tests__/TimerPill.test.tsx` (5 tests — server-anchored countdown)
- `components/quiz/__tests__/NavigationGrid.test.tsx` (3 tests — status mapping)
- `features/quiz/__tests__/attemptHelpers.test.ts` (6 tests — computeStatuses/countAnswered/unansweredIndices)
- `features/quiz/__tests__/cacheKeySecurity.test.ts` (4 tests — no is_correct in attempt-stage source)
- `features/exams/__tests__/serverTimeOffset.test.ts` (11 tests — computeRemainingMs + formatRemainingMmSs)
- `features/exams/__tests__/examTabSwitchLogger.test.ts` (5 tests — fire-and-forget + silent on 404)

`Result:` [ ] PASS · [ ] FAIL — _passed/failed counts:_ ____

---

### M.4 — Production build

```powershell
pnpm --filter @fynestudy/web build
```

**✅ Expected:** the route table includes **27 routes** including `/quiz/[id]` and `/exam/[id]`. `ƒ Middleware 89.4 kB`. No red errors.

`Result:` [ ] PASS · [ ] FAIL

---

### M.5 — Playwright end-to-end tests

Before running this, **stop the `pnpm dev` you started in §0.5** (Ctrl+C in that PowerShell window, type `Y` to confirm) — Playwright starts its own dev server.

```powershell
cd C:\Users\kaust\OneDrive\Desktop\FyneStudyLive\apps\web
pnpm exec playwright test --reporter=list
```

**✅ Expected (last line):** all Phase 1 + Phase 2 + Phase 3 specs run; the new Phase 3 specs are `quiz-attempt.spec.ts`, `exam-attempt.spec.ts`, `security-attempt.spec.ts`. Specific tests that depend on a seeded quiz/exam will **skip** automatically if the seed isn't fresh; that's expected.

The number to watch is: **0 failed**.

**👉 After M.5, restart the dev server:**

```powershell
cd C:\Users\kaust\OneDrive\Desktop\FyneStudyLive
pnpm --filter @fynestudy/web dev
```

`Result:` [ ] PASS · [ ] FAIL — _passed/failed/skipped counts:_ ____

---

# §N — Acceptance sign-off

Tick the checkboxes once all rows above are marked PASS (or N/A with reason).

- [ ] **§A** Quiz attempt — A.1–A.10 all PASS (A.9 may be N/A)
- [ ] **§B** Exam pre stage — B.1–B.4 all PASS
- [ ] **§C** Exam locked attempt — C.1–C.8 all PASS
- [ ] **§D** Server-anchored timer — D.1–D.4 PASS; D.5 PASS or N/A (unit test)
- [ ] **§E** Tab-switch logging — E.1–E.3 PASS; E.4 PASS or N/A (unit test)
- [ ] **§F** Auto-submit — F.3 PASS; F.1/F.2 PASS or N/A (no short exam)
- [ ] **§G** Manual-release waiting — G.1–G.4 all PASS
- [ ] **§H** Instant-release + D-181 — H.1–H.4 all PASS
- [ ] **§I** Solution stage — I.1–I.3 PASS; I.4 PASS or N/A
- [ ] **§J** Math rendering — J.1–J.3 PASS; J.4/J.5 PASS or N/A
- [ ] **§K** Security — K.1–K.3 PASS; K.4 PASS or N/A; K.5 PASS or N/A
- [ ] **§L** Responsive — L.1, L.2 PASS; L.3, L.4 CARRY-OVER
- [ ] **§M** Automated gates — M.1–M.5 PASS

**Sign-off:**

```
Tester name:
Date:
Notes / anything unusual:
```

Once these boxes are ticked, paste this back to me (Claude). I will then:

1. Append the §J acceptance ledger to the bottom of `Phases/phase-3-assessments-quizzes-exams.md`.
2. Update `CLAUDE.md`'s "🌐 Web App Conversion track" with `Phase 3 ✅ — <today's date>` + a one-line summary.
3. Save `project_web-phase-3-status.md` in the project memory + add the pointer to `MEMORY.md`.
4. (Already committed by the build step.) Confirm the commit `feat(web-phase-3): assessments — quizzes + exams` is on `web-phase-1` branch.
5. **Stop.** Phase 4 starts in a fresh new conversation.

---

# Carry-overs (NOT blockers for Phase 3 acceptance)

These items are explicitly deferred and tracked:

1. **Vercel deploy** + Supabase Authentication redirect-URL whitelist + extending `apps/functions/_shared/cors.ts` with a `web-*.vercel.app` regex.
2. **iOS Safari + Android Chrome on-device verification.** Both need HTTPS (Vercel).
3. **Cold-start measurement** on a Redmi 8A — only meaningful on a real device.
4. **Multi-role + suspended account creation** — pending user opt-in.
5. **Local KaTeX bundle hardening** — currently CSS is imported via the npm `katex` package, which Next bundles. The fonts are pulled from the same package. If the package URL ever changes this is a single import to update.
6. **Component-level Jest tests** for the quiz/exam reducers — the unit tests cover the pure helpers; a future hardening pass could add tests for the reducers + state machine transitions.
7. **Maestro / Playwright Mobile-web** — same surface as L.3/L.4.

# Troubleshooting cheat-sheet

| Symptom | Likely cause | Fix |
|---|---|---|
| Quiz "Start Quiz" button never appears | `quiz-start` returned non-200 — could be RLS scope | Check Network for the status; if 403, check the student's batch + the quiz's batch_id/course_id |
| TimerPill stays at `--:--` for >5s | `server-time` edge fn unreachable | Open `https://orqwyazvcthgxoadfxfv.supabase.co/functions/v1/server-time` in a tab; should return 200 with `{ now, epoch_ms }` |
| Auto-save never fires | `attemptId` is null | Check that `quiz-start`/`exam-start` returned an attempt_id; ensure your account has a `students` row with a `batch_id` |
| `exam_answers` 403 on every write | Past the deadline OR wrong attempt_id | Check the deadline-cut RLS migration is applied; verify `attempt_id` matches the current attempt |
| Math renders as raw `$x^2$` | KaTeX CSS not loaded | Confirm `apps/web/app/globals.css` has `@import "katex/dist/katex.min.css";` |
| Tab-switch banner doesn't appear | `visibilitychange` not firing on this OS/browser combo | Try Alt+Tab to a desktop window; the hook also listens for `window.blur` as fallback |
| Instant exam re-open lands on pre stage | D-181 routing logic broken | Check `useExamPreInfo.data.existing_attempt.submitted_at` + the `reopenAppliedRef` `useEffect` in ExamClient |
| Solution stage shows wrong correctness colors | `correct_option_id` vs `your_option_id` swapped | Inspect a SolutionCard's `q` prop — confirm both fields are present and distinct |
| `is_correct` in a Network response during attempt | P0 leak — STOP | Take a screenshot of the response URL + body, ping me. Do NOT continue testing |
| Refresh mid-attempt restarts the attempt | `saved_answers` not hydrating | Check `useEffect` in QuizClient/ExamClient that hydrates state from `startState.data.saved_answers` |
