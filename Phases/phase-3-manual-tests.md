# Phase 3 — Manual Test Plan (`apps/web` — Assessments: quizzes + exams)

> **Audience:** the human running the manual tests. **Zero coding background required** — every step has the exact buttons to click, the exact URL to type, and what you should see on screen.
>
> **What you're testing:** the Phase 3 student surfaces of `apps/web` — the practice **quiz** screen (intro → attempt → result → solution), the graded **exam** screen (pre → attempt → submitted → result → solution), the math renderer (KaTeX), the server-anchored countdown, the tab-switch logger, the locked-result waiting screen, the **D-181** re-open routing, plus the wiring from Library / Classes / Dashboard. Walk through every section in order. **Chrome on a laptop / desktop is required.** iOS Safari + Android Chrome rows that need HTTPS are tagged **carry-over** (do them after the Vercel deploy session — that's intentional and not a blocker).
>
> **How to record results:** every test ends with `[ ] PASS / [ ] FAIL / [ ] N/A`. Tick one box. If FAIL, write what you saw in the space below it and ping me — I'll diagnose. If N/A, write the reason.
>
> **Estimated time:** ~120 minutes on Chrome desktop if no failures. Phase 3 is the highest-correctness phase — bring patience for §D (clock-skew) and §G (manual-release flow), which involve admin-side actions in a second tab. Add ~25 min each for the iOS Safari + Android Chrome carry-overs.

---

## 🔑 Test accounts — quick reference (verified live 2026-05-28)

These are the SAME accounts you used in Phase 1 + 2. Email + password copy-paste straight from here.

| Use in section | Email | Password |
|---|---|---|
| **§0.5 + §A–§K all student tests** | `review.student@fynestudy.app` | `ReviewStudent#2026` |
| **§A.0 + non-student route gating** (optional) | `review.teacher@fynestudy.app` | `ReviewTeacher#2026` |
| **§G.3 + §H.3 admin release / regrade** | `owner@fynestudy.example.com` | `FyneOwner#2026` |
| Bonus extra student (Aarav, Batch A) | `test.aarav@fynestudy.app` | `TestPass#2026` |
| Bonus extra student (Diya, Batch A) | `test.diya@fynestudy.app` | `TestPass#2026` |

**Skipped sections (mark N/A):**
- iOS Safari + Android Chrome carry-overs (§L.3, §L.4) — needs the Vercel deploy that ships later.
- Multi-role student/teacher account switch — account never created in Phase 1.

> Source of truth for credentials: `CREDENTIALS.local.md` at the repo root (git-ignored, do not paste publicly).

---

## Table of contents

- **§0 Setup** — branch, env, dependencies, seed, dev server, DevTools (7 sub-tasks)
- **§A Quiz — intro → attempt → result → solution** (12 tests)
- **§B Exam — pre / countdown stage** (5 tests)
- **§C Exam — locked attempt UI + auto-save + resume** (9 tests)
- **§D Server-anchored timer (D-183) + 60-s resync + clock skew** (6 tests)
- **§E Tab-switch logging + TabSwitchBanner (D-182)** (5 tests)
- **§F Auto-submit at deadline** (3 tests)
- **§G Manual-release exam — locked-result waiting + auto-flip** (5 tests)
- **§H Instant-release exam + D-181 re-open routing** (5 tests)
- **§I Solution stage — correctness + explanations + related-content link** (5 tests)
- **§J Math rendering — inline + block + non-math fast path (D-178)** (5 tests)
- **§K Security checks — no `is_correct` mid-attempt, no service-role key, signed URLs only** (6 tests)
- **§L Responsive + carry-overs — desktop ↔ mobile-web** (4 tests, 2 carry-over)
- **§M Automated test gates** — typecheck / lint / vitest / build / Playwright (5 commands)
- **§N Acceptance sign-off** — tick boxes per section + tester name + date

---

# §0 — Setup (do this once, before any test below)

This section gets your laptop ready. Allow ~12 minutes the first time, ~3 minutes after.

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
- Then run:
   ```powershell
   git log --oneline -3
   ```
   The top commit should be something like `feat(web-phase-3): assessments — quizzes + exams` (`f3102ef` or similar), followed by `feat(web-phase-2): student learning surfaces` and `feat(web-phase-1): foundation, auth, app shell`.
- `git status` will also list **unstaged** modifications under `apps/mobile/`, `docs/phases/`, `apps/functions/`, `README.md`, `.gitignore`, `pnpm-lock.yaml` (some), `scripts/seed-exam-manual-test.ts`. These are pre-existing edits from prior phases — leave them alone, they have nothing to do with Phase 3.

**❓ If something looks different:**

- `On branch main` or `On branch phase-4` → wrong branch. Run `git checkout web-phase-1` and re-check.
- `fatal: not a git repository` → you're in the wrong folder. Re-run the `cd` command exactly as shown.
- Top commit is NOT `feat(web-phase-3)…` → Phase 3 wasn't committed (or you're on a different commit). Ping me before proceeding.

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

There MUST NOT be a `SUPABASE_SERVICE_ROLE_KEY` line, a `SENTRY` line, or any other secret. If there is, **delete it now** and save — the web client never gets the service-role key.

**❓ If something looks different:**

- "Cannot find the path …" → the file is missing. Create it by copying these 3 lines into a new file at `C:\Users\kaust\OneDrive\Desktop\FyneStudyLive\apps\web\.env.local`. In Notepad's Save dialog, set **Save as type: All Files** so it doesn't add `.txt`.
- A line says `SUPABASE_SERVICE_ROLE_KEY=...` → **delete that line** and save. Critical security check.

Close Notepad after confirming.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### 0.3 — Refresh dependencies (Phase 3 added KaTeX)

Phase 3 added 2 new npm packages (`katex`, `react-katex`) plus their typings.

**👉 Do this:**

1. In PowerShell, from the repo root:
   ```powershell
   pnpm install
   ```
2. Wait ~30 seconds.

**✅ What you should see:**

- Output ends with `Done in 18s` (or similar).
- The line `apps/web` should appear at some point with a counter like `+11 -204` — `+11` is the count of the newly-installed Phase 3 packages + their dependencies.
- Yellow `WARN` lines about peer deps (e.g. "unmet peer @types/react@^19.2.0: found 19.1.17") or `Ignored build scripts: canvas, esbuild, sharp, …` are normal and harmless.

**❓ If something looks different:**

- `ELIFECYCLE` or `ENOENT` red error → run `pnpm install` from the repo root (not `apps/web/`). If still failing, delete `node_modules` and `pnpm-lock.yaml` and re-run.
- "Cannot find module 'react-katex'" at later runtime → confirms this step was skipped; re-run `pnpm install`.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### 0.4 — Refresh test fixtures (quiz + exam)

The mobile seed scripts are reused to seed the Supabase DB with one published quiz and a small set of exams (draft / scheduled / live / released). Refreshing wipes prior student answers so you start clean.

**👉 Do this:**

1. From the repo root:
   ```powershell
   pnpm seed:quiz-manual-test --reset
   ```
2. Wait ~5–10 seconds.
3. Then:
   ```powershell
   pnpm seed:exam-manual-test --reset
   ```

**✅ What you should see (quiz seed):**

```
> ts-node scripts/seed-quiz-manual-test.ts --reset
✓ Reset done — removed N prior rows
✓ Seed complete
   Quiz id:       <uuid e.g. 4d3a8b2e-…>
   Topic id:      <uuid>
   Question count: 5
   Published:     true
```

**✅ What you should see (exam seed):**

```
> ts-node scripts/seed-exam-manual-test.ts --reset
✓ Reset done
✓ Seed complete
   Live instant:   <uuid>  — started 2 min ago, runs for 60 min, results instant
   Live manual:    <uuid>  — started 2 min ago, runs for 60 min, results manual
   Scheduled:      <uuid>  — starts in 1 hour, 30 min duration
   Ended released: <uuid>  — ended yesterday, results released, score visible
```

**Write the IDs down** — you'll use them in §A, §B, §G, §H. Keep this PowerShell window scrolled up so you can reference them.

**❓ If something looks different:**

- "Cannot connect to Supabase" → DNS / network. Re-run.
- "Missing service-role key" → the seed script needs the SERVICE_ROLE key. Check that `apps/mobile/.env.local` or `apps/functions/.env.local` has `SUPABASE_SERVICE_ROLE_KEY=...`. If neither does, ping me.
- "No published quizzes for student's batch" later in §A → the seed ran but didn't put the quiz on Batch A. Re-run `pnpm seed:quiz-manual-test --reset` and look for "batch_id: <Batch A's id>" in the output.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### 0.5 — Start the dev server (leave it running for the whole session)

The dev server is the local copy of the FyneStudy web app, running on your laptop at `http://localhost:3000`.

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

The terminal stays running — that's the dev server. **Do NOT close it.** When you're done with all tests, you'll stop it with `Ctrl+C` twice → `Y`.

**❓ If something looks different:**

- "Port 3000 already in use" → another Next.js is already running. Open a NEW PowerShell window and run `taskkill /F /IM node.exe` to kill all Node processes, then re-run the dev command.
- "Cannot find module 'react-katex'" → you skipped §0.3. Stop the dev server, run `pnpm install`, re-run.
- "Missing env: NEXT_PUBLIC_SUPABASE_URL" → you skipped §0.2. Re-create `.env.local`.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### 0.6 — Open Chrome DevTools (refresher from Phase 1)

You'll use DevTools several times below. Skip this step if you're comfortable with F12.

**👉 Do this:**

1. Open **Google Chrome**.
2. Go to: `http://localhost:3000` — you'll be redirected to `/login`.
3. Press **F12** (or right-click → **Inspect**). The DevTools panel opens.

**✅ What you should see:**

- A panel attached to the bottom or right of the browser with tabs at the top: `Elements`, `Console`, `Sources`, `Network`, `Performance`, `Memory`, `Application`, `Security`, `Lighthouse`.
- You can dock it to a separate window: three-dot menu in DevTools → **Dock side** → **Undock**.

**❓ If you can't find DevTools:** it may have opened in a separate window — check your taskbar for a second Chrome window. Or close Chrome, reopen, and press F12 again.

`Result:` [ ] PASS — DevTools opens.

---

### 0.7 — Log in as the seed student

**👉 Do this:**

1. Still at `http://localhost:3000/login`. If you're not, navigate there.
2. Enter:
   - **Email:** `review.student@fynestudy.app`
   - **Password:** `ReviewStudent#2026`
3. Click **Sign in**.

**✅ What you should see:**

- The button briefly says **"Signing in…"**.
- URL changes to `http://localhost:3000/` (the root).
- An H1 heading appears: `Good morning, …` / `Good afternoon, …` / `Good evening, …` / `Hi, …` (depending on IST time of day) with the student's first name.
- On the left, the side-rail with FyneStudy logo + 7 student nav items: **Home** (highlighted blue), **Classes**, **Library**, **Attendance**, **Ranks**, **Profile**, **Menu**.
- Console (DevTools): no red errors. Yellow warnings about `supabase.auth.getSession()` are harmless (you saw these in Phase 1).

**❓ If something looks different:**

- "Invalid email or password" → typo. Re-enter exactly: `ReviewStudent#2026` (case-sensitive, no trailing space).
- Goes to `/force-password-change` → the seed flag flipped somehow. Set any valid new password (≥10 chars, upper+lower+digit), then continue.
- Stays on `/login` after click → check the dev terminal for errors; reload the page.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §A — Quiz: intro → attempt → result → solution

The Phase 3 quiz screen lives at `/quiz/[id]` (outside the protected route group so the side-rail does NOT render — the screen is full-width). It's a 4-stage state machine: **intro** (rules + Start) → **attempt** (questions + auto-save) → **result** (score) → **solution** (per-question review).

---

### A.1 — Find a quiz in the library

**👉 Do this:**

1. From the dashboard, click **Library** in the side-rail.
2. The library opens at `/library` showing subject cards.
3. Drill down: click any **subject** card, then any **chapter**, then look for a **topic** whose subtitle ends with **"· quiz available"**.
4. Click that topic.

**✅ What you should see:**

- URL becomes something like `/library?subject=...&chapter=...&topic=...`.
- The page shows the content items for the topic (videos / PDFs) AND, at the bottom, an **amber-tinted** "Practice quizzes" card.
- Inside the amber card, there's at least one row. Each row is a clickable link with:
  - The quiz title in bold.
  - A subtitle like `15 min · +4/-1/0` (duration + correct/wrong/skip marks) and (if attempted before) `· attempted N×`.
  - A chevron-right arrow on the right.

**❓ If something looks different:**

- No topic with "quiz available" subtitle → the seed quiz isn't on Batch A's topic. Re-run `pnpm seed:quiz-manual-test --reset` and check the printed `topic_id` matches a real topic.
- Amber card missing on the topic page → the `useStudentQuizDiscovery` query isn't returning the quiz. Open DevTools → Network → look for `quizzes` and `quiz_attempts` PostgREST requests; if `quizzes` returns `[]`, the quiz isn't published or isn't in this student's course.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.2 — Click a quiz row → land on the quiz intro screen

**👉 Do this:**

1. Inside the amber "Practice quizzes" card, click the first quiz row.

**✅ What you should see:**

- URL becomes `/quiz/<uuid>`.
- The page is **FULL-WIDTH** — **no side-rail on the left, no bottom-tabs**. Just a full-screen view. That's correct: the quiz route lives outside the `(protected)` group on purpose so the AppShell chrome doesn't waste space during attempts.
- A close **X** button (top-left, in a circle).
- A heading in dark-blue with the quiz title (e.g. **"Phase 6 Manual Quiz"** if you used the seed).
- A subtitle: `N questions · X min`.
- A white box listing the marks scheme:
  ```
  Correct        +4
  Wrong          -1
  Skip            0
  Total possible 40
  ```
  (Exact numbers come from the seed.)
- A big blue **Start Quiz** button.
- Below the button: small grey text "Auto-saves every action. You can refresh or leave and come back."

**❓ If something looks different:**

- 404 / "Quiz not available" → the quiz id is wrong, OR the quiz `is_published = false`, OR the student isn't in the quiz's batch/course. Re-run the §0.4 seed.
- Side-rail still visible → bug: the route is in the wrong group. Tell me.
- No "Start Quiz" button → check Console for an error.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.3 — Click Start → attempt screen renders

**👉 Do this:**

1. DevTools → click the **Network** tab.
2. Click the **"Disable cache"** checkbox at the top.
3. In the filter box, type `quiz-start`.
4. Click **Start Quiz**.

**✅ What you should see:**

- The page transitions to the attempt stage immediately.
- A new request appears in the Network panel: `quiz-start` (POST, status `200`). Click it → response body has:
  ```json
  {
    "attempt_id": "...",
    "questions": [
      { "id": "...", "prompt_md": "...", "options": [ { "id": "...", "text_md": "..." }, ... ] },
      ...
    ],
    "server_now": "2026-05-28T...",
    "deadline_at": "2026-05-28T...",
    "saved_answers": []
  }
  ```
  **CRITICAL:** confirm each option object has ONLY `id`, `text_md`, `image_url` keys — **NO `is_correct` field**.
- The screen now shows:
  - A **header bar** at the top: X close button + quiz title (truncated if long) + a **TimerPill** in blue with a clock icon showing `MM:SS` (e.g. `15:00` if the quiz is 15 min). The pill is rounded, blue background.
  - A `Q1 / N` label + a difficulty badge (`EASY` / `MEDIUM` / `HARD` — colored green/amber/red respectively).
  - The question prompt rendered (plain text + any math via KaTeX — see §J).
  - 4 (or however many) options as **OptionRadio** rows: each is a rounded white box with a slate-100 letter circle (A/B/C/D) on the left and the option text on the right.
  - Below the last option: a **Flag** button (grey, with a flag icon).
  - A horizontal **NavigationGrid** below: small numbered circles (1, 2, 3, …). The current one (Q1) is filled blue.
  - A sticky bottom bar: **Prev** (disabled — it's Q1), the answered/flagged count text in the middle on desktop, **Next** button on the right.

**❓ If something looks different:**

- Timer pill stuck at `--:--` for more than 3 seconds → the `quiz-start` response's `server_now` is malformed. Check Network response body.
- Options not showing → check Console.
- `is_correct` in the response body → **STOP**. Take a screenshot, ping me — this is a P0 leak.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.4 — Select an option → highlights blue + auto-saves within 250ms

**👉 Do this:**

1. In the Network filter box (DevTools), change it to `quiz_answers`.
2. Click option **A** for Q1.

**✅ What you should see (visual):**

- Option A's letter circle turns **blue (selected)**. The whole row gets a `border-primary` (blue) outline and a `bg-blue-50` light tint.

**✅ What you should see (network):**

- Within ~250 ms, a `quiz_answers?on_conflict=...` request appears (PostgREST upsert) returning **201** or **204**.
- Click the request → look at "Payload":
  ```json
  [
    {
      "attempt_id": "...",
      "question_id": "...",
      "selected_option_id": "...",
      "is_flagged": false,
      "answered_at": "2026-05-28T..."
    }
  ]
  ```
- **CRITICAL:** the payload does NOT contain `is_correct`. The web client never sends grading data — only the student's selection.

**❓ If something looks different:**

- Option doesn't highlight → React state isn't updating. Check Console for errors.
- Auto-save never fires (no `quiz_answers` request) → the attemptId isn't being passed to `useQuizAutoSave`. Check the React DevTools tree.
- `is_correct` appears in the payload → **STOP**. P0 leak.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.5 — Flag a question → grid circle turns red

**👉 Do this:**

1. With Q1 still answered (A), click the **Flag** button (the flag icon, left side under the options).

**✅ What you should see:**

- The Flag button changes color: amber background, amber outline, the label changes to **"Flagged"** and the flag icon fills amber.
- In the **NavigationGrid** (below the options), the Q1 circle now has a **red/pink tint** with a red border — the **"flagged + answered"** state.
- DevTools → Network: another `quiz_answers` upsert fires within ~250 ms with `is_flagged: true`.

**👉 Click Flag again to un-flag:**

- The button returns to grey ("Flag" label, outline icon).
- The grid Q1 circle returns to green/emerald (still answered, no longer flagged).
- One more auto-save fires with `is_flagged: false`.

**❓ If something looks different:**

- Flag button doesn't toggle → `useQuizAutoSave.enqueue` isn't being called. Check the click handler in QuizClient.
- Grid color doesn't update → the `statuses` recompute isn't triggering. Check `computeStatuses` in `features/quiz/attemptHelpers.ts`.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.6 — Navigation grid: tap Q3 → jumps there + Q1 selection preserved

**👉 Do this:**

1. In the bottom NavigationGrid, click circle **3**.

**✅ What you should see:**

- The grid Q3 circle is now blue (current).
- The main area shows Q3's prompt and options (none selected yet).
- The Prev button at the bottom is now enabled.
- The header bar's TimerPill is still ticking — it doesn't reset on navigation.

**👉 Now click circle 1 in the grid** → back to Q1. Confirm your previous A selection is still highlighted blue.

**❓ If something looks different:**

- Q3 click doesn't navigate → onJump handler isn't firing. Check `NavigationGrid.tsx`.
- Q1 selection lost on return → React state isn't preserved across question changes. Check the `state.answers` Map handling in QuizClient's reducer.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.7 — Clear selection works

**👉 Do this:**

1. On Q1 (with A selected), look at the row beside the Flag button. There's a **Clear** link with a refresh-circle icon.
2. Click **Clear**.

**✅ What you should see:**

- Option A's blue highlight disappears.
- The Clear link disappears (there's no longer a selection to clear).
- DevTools → Network: a `quiz_answers` upsert with `selected_option_id: null`.
- The NavigationGrid Q1 circle returns to "unanswered" (white with grey border).

**❓ If something looks different:**

- Clear link doesn't appear when an option is selected → CSS or conditional render bug. Tell me.
- Clear doesn't fire the auto-save with null → check `onClearOption` handler.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.8 — Refresh mid-attempt → resumes in place

This is the critical resume-on-refresh test (you may have noticed it briefly in §A.4).

**👉 Do this:**

1. Re-answer Q1 with A. Answer Q2 with B. Set a flag on Q3 (no answer).
2. Press **F5** to reload the page.
3. Wait 2 seconds for `quiz-start` to refetch.

**✅ What you should see:**

- After a brief loading state, the page **stays on the attempt stage** (does NOT bounce back to intro).
- Your previous selections + flag are restored: Q1 shows A selected (blue), Q2 shows B selected (blue), Q3's circle in the grid is yellow (flagged-unanswered).
- The TimerPill picks up where it left off (the deadline didn't change, so remaining time is reduced by the seconds you took to reload).
- DevTools → Network → look at the `quiz-start` response body: the `saved_answers` array now contains your three rows.

**❓ If something looks different:**

- Lands on intro stage → `useQuizStart` returned an attempt with `saved_answers.length === 0`, OR the QuizClient effect that auto-jumps to attempt when answers exist isn't firing. Check the response.
- Selections lost → the auto-save in §A.4–§A.5 didn't actually land in the DB. Check Network for the upsert responses (must be 201 or 204).
- TimerPill resets to full duration → bug in `useServerTimeOffset` mount-time offset. Ping me.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.9 — Submit → confirmation dialog with unanswered-list

**👉 Do this:**

1. After the refresh in A.8 you should have Q1 + Q2 answered, Q3 flagged-unanswered, Q4+ untouched.
2. Click the NavigationGrid circle for the LAST question (e.g. circle 5 if there are 5 questions).
3. On the last question, the bottom-right button changes from blue **Next** to green **Submit**.
4. Click **Submit**.

**✅ What you should see:**

- A modal dialog opens with the title **"Submit quiz?"**.
- Subtitle: `You've answered 2/5, flagged 1.` (counts match your state).
- An amber box appears listing unanswered questions: `3 unanswered questions: Q3, Q4, Q5` (or however many you left blank).
- Two buttons at the bottom: a grey **Cancel** and a green **Submit**.

**👉 Click Cancel** → the dialog closes. You stay on the attempt screen.

**👉 Click Submit again, then green Submit in the dialog:**

**✅ What you should see next:**

- The green Submit button label briefly says **"Submitting…"**.
- DevTools → Network: exactly ONE `quiz-submit` POST returning 200 with the full solution dossier (includes `score`, `max_score`, and a `questions` array WITH `is_correct` per option — this is fine, the attempt is over).
- The screen transitions to the **result** stage:
  - A big centered score: `XX / YY` and `%`.
  - Three colored stats: **Correct** (emerald), **Wrong** (red), **Skipped** (slate).
  - A blue **Review solutions** button.
  - An outlined **Retake** button.
  - A subtle **Back to Library** link.

**❓ If something looks different:**

- "Submit failed" toast → check Network for the `quiz-submit` response status. 409 means already submitted; 403 means scope check failed.
- Stuck on "Submitting…" → the request never completed. Check the dev terminal for an edge-fn error.
- Dialog shows wrong unanswered count → check `unansweredIndices` in `features/quiz/attemptHelpers.ts`.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.10 — Review solutions → per-question SolutionCard

**👉 Do this:**

1. On the result screen, click **Review solutions**.

**✅ What you should see:**

- The URL stays at `/quiz/<uuid>`.
- A header with a back arrow (chevron-left in a circle) + "Solutions" title.
- A scrollable list of **SolutionCard** rows — one per question. Each card contains:
  - The same QuestionCard (Q#, difficulty badge, prompt).
  - Each option rendered as a disabled OptionRadio. The visual state encodes the outcome:
    - The **correct** option: green border + emerald letter circle. If you picked it, it also has a check icon.
    - If you picked the **wrong** option: red border + red bg + red letter circle.
    - **Skipped** questions: only the correct option highlighted in green (no red anywhere).
  - An **Explanation** section in a slate-50 box rendering the `explanation_md` (math via KaTeX).
  - A footer bar: outcome label + point value (e.g. `Correct (+4)`, `Wrong (-1)`, `Skipped (+0)`), and a `FLAGGED` chip on the right if you flagged it.

**❓ If something looks different:**

- All options look the same color → `correct_option_id` / `your_option_id` matching is broken. Check `SolutionCard.tsx`.
- Explanation shows raw `$x^2$` text instead of rendered math → the KaTeX CSS isn't loaded. Check `globals.css`.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.11 — Solution stage: related-content link routes to /video or /pdf

**👉 Do this:**

1. Scroll the solution list to find a question whose explanation has a **Related: <title>** link at the bottom (with either a play-circle icon in red, or a file-text icon in emerald).
2. Click that link.

**✅ What you should see:**

- If the icon was a play-circle (red), URL becomes `/video/<contentId>` and the YouTube wrapper player loads.
- If the icon was a file-text (emerald), URL becomes `/pdf/<contentId>` and the PDF viewer opens.
- Press the browser back button → you return to the solution list at the same scroll position.

**👉 If the seed quiz has no question_solutions row with a related_content_id, this test is N/A.** Mark accordingly.

**❓ If something looks different:**

- 404 on /video or /pdf → the related_content.id in the solution dossier is stale or the content was deleted. Check Console.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _reason:_

---

### A.12 — Retake → new attempt starts fresh

**👉 Do this:**

1. Hit the back arrow on the solution screen → back to result.
2. Click **Retake**.

**✅ What you should see:**

- A brief loading state, then the **intro** stage re-renders.
- Click **Start Quiz** → a new attempt screen opens, with the answer state EMPTY (no selections, no flags) and the timer at full duration.
- DevTools → Network: confirm a fresh `quiz-start` POST fired and returned a NEW `attempt_id` (different from the submitted one).

**❓ If something looks different:**

- Answers from the prior attempt still appear → the new attempt was bound to the same `attempt_id` (the prior submitted attempt). Check `useQuizStart.load()` reset logic. Bug.
- Lands on attempt stage immediately (skips intro) → the `state.answers` hydration logic detected saved_answers from a NEW (empty) attempt incorrectly. Should not happen — the server returns an empty `saved_answers` for a new attempt.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §B — Exam: pre / countdown stage

The Phase 3 exam screen lives at `/exam/[id]` (also outside the protected group). It's a 5-stage state machine: **pre** (countdown / Enter Exam) → **attempt** (locked UI) → **submitted** (waiting for release) → **result** → **solution**. The pre stage handles three timing scenarios: waiting (before starts_at), live (in [starts_at, ends_at]), and ended.

For §B you'll need the seed exam ids from §0.4.

---

### B.1 — Open a Scheduled exam from /classes → "Starts in" countdown

**👉 Do this:**

1. Click **Classes** in the side-rail.
2. Scroll to the **Examinations** section. You should see the seeded exams listed with status pills (Scheduled / Live / Results pending / Results out / Ended).
3. Click the row for the **Scheduled** exam (status pill says "Scheduled" — its `starts_at` is in the future, e.g. 1 hour away).

**✅ What you should see:**

- URL becomes `/exam/<uuid>`.
- The page is FULL-WIDTH — **no side-rail**.
- A close **X** button (top-left).
- The exam title in dark-blue (e.g. "Phase 7 Manual Exam — Scheduled").
- A subtitle: `Day, dd Mon hh:mm · X min · N questions` (all in IST). For example: `Wed, 28 May 17:00 · 30 min · 5 questions`.
- A **Rules** box with 4 bullets:
  - "Server clock decides. Changing your device clock won't buy you extra time."
  - "Leaving this tab is LOGGED (counter visible to your teacher). No auto-submit on tab switch."
  - "Auto-saves as you answer. You can refresh and resume in place — same remaining time."
  - "Results are released by your teacher" (or "shown immediately on submit" for instant exams).
- A centered card showing **"Starts in"** in slate and a big tabular-nums countdown (e.g. `1h 23m 45s` or `2d 4h 30m`). The countdown **ticks every second** — watch the seconds change.
- A grey, **disabled** "Enter Exam" button — you can't start an exam before its window opens.

**❓ If something looks different:**

- Lands on "Couldn't open exam" red error → the student isn't in the exam's batch, OR the exam id is wrong. Check the seed output for the right batch_id.
- Countdown stuck at `--` → JS error; check Console.
- Card shows "Live now" instead of "Starts in" → the seed's starts_at is in the past. Re-run `pnpm seed:exam-manual-test --reset`.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### B.2 — Open a Live exam → "Live now" + Enter Exam enabled

**👉 Do this:**

1. Go back to /classes (browser back or side-rail Classes).
2. Click the **Live** (status "Live now") exam row.

**✅ What you should see:**

- URL becomes `/exam/<uuid>`.
- The same header + rules layout as B.1.
- The centered card now shows:
  - A small red dot + **"Live now"** in red bold.
  - Subtitle: `Window closes in 0h 58m 42s` (counting down — the value is whatever's left of the 60-min window).
  - An **ENABLED** blue **Enter Exam** button.

**❓ If something looks different:**

- Card shows "Starts in" instead of "Live now" → your laptop clock is off, OR the seed's starts_at is wrong. Re-run `seed:exam-manual-test`.
- Card shows "This exam has ended" → the seed's window has closed; re-seed.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### B.3 — Click Enter Exam → attempt screen renders (with server-time sync)

**👉 Do this:**

1. DevTools → Network → in the filter box, type `exam-start`.
2. Click **Enter Exam**.

**✅ What you should see:**

- The button briefly says "Starting…" with a spinner.
- A new request appears: `exam-start` (POST, status 200).
- Click the request → response body has:
  ```json
  {
    "attempt_id": "...",
    "deadline_at": "...",
    "server_now": "...",
    "tab_switch_count": 0,
    "exam": { "title": "...", "duration_min": 60, "result_release": "instant", ... },
    "questions": [ { "id": "...", "prompt_md": "...", "options": [...] }, ... ],
    "saved_answers": []
  }
  ```
- **CRITICAL:** confirm:
  - Each option object has ONLY `id`, `text_md`, `image_url` keys. **NO `is_correct`.**
  - The questions array doesn't contain `correct_option_id`.

- The page transitions to the **attempt** stage:
  - The header bar now has a slightly more rigid look (white background with a bottom border).
  - The TimerPill in the top-right initially may show `--:--` for a fraction of a second while `useServerTimeOffset` syncs — then resolves to the remaining time (e.g. `30:00` for a fresh 30-min exam, or `58:42` if you entered partway through a 60-min window).
  - The TimerPill is **blue** (not red — it's far above 60s).
  - Question card + options + nav grid (same layout as the quiz).
  - Above the question, a sticky `<div>` waiting for `TabSwitchBanner` content (will only appear after you tab-switch in §E).

**❓ If something looks different:**

- Timer pill stays at `--:--` for more than 5 seconds → `server-time` edge fn is unreachable. Open `https://orqwyazvcthgxoadfxfv.supabase.co/functions/v1/server-time` in a new tab — should return JSON `{ now, epoch_ms }`.
- "exam has ended" red banner → the seed exam's window closed; re-seed.
- `is_correct` in response body → P0 leak, ping me.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### B.4 — Open an Ended (already-submitted) exam → D-181 routes to result, not pre

This is the D-181 re-open routing test. The mobile shipped a bug here — make sure the web doesn't repeat it.

**👉 Do this:**

1. First, leave the attempt screen WITHOUT submitting — click X (top-left) → back to /classes. (We're going to return to this attempt in §C, so don't submit yet.)
2. For this test, find an exam that's already been submitted. From the seed: **Ended released** exam (status pill "Results out"). Click that row.

**✅ What you should see (D-181):**

- The page DOES NOT render the pre stage's countdown. It either:
  - **Instant release**: lands DIRECTLY on the **result** stage (score + Review Solutions button).
  - **Manual release WITHOUT released_at**: lands on the **submitted** stage (locked waiting card).
  - **Manual release WITH released_at** (the seed's "Ended released" case): lands on the **result** stage.
- This routing happens silently — there's **no flicker** through pre → "Enter Exam" first.

**❓ If something looks different:**

- Lands on pre stage with an "Enter Exam" / "View Result" button → the D-181 routing isn't firing. Check `useExamPreInfo.existing_attempt.submitted_at` in the React DevTools.
- Brief flicker (pre UI shown for one frame, then jumps) → the flicker guard in ExamClient isn't catching it.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### B.5 — Open the Live exam attempt mid-session → resume in place

**👉 Do this:**

1. Go to /classes → click the Live exam row again (the one you abandoned in B.3 above).

**✅ What you should see:**

- URL becomes `/exam/<uuid>`.
- Within ~2 seconds, the page lands directly on the **attempt** stage (NOT pre — because there's an in-flight attempt, the `exam-start` returns the existing attempt id idempotently).
- Your selections from before (if any) are restored from `saved_answers`.
- The TimerPill picks up at roughly where it should be.
- The tab_switch_count is whatever it was when you left.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §C — Exam: locked attempt UI + auto-save + resume

This section continues from §B.5. You should be on the **attempt** stage of the Live exam.

---

### C.1 — No side-rail, no bottom tabs (locked layout, all viewport widths)

**👉 Do this:**

1. Resize your window to ≥ 1280px wide. Look at the page.

**✅ What you should see:**

- Even at desktop width, there's **NO side-rail** on the left.
- The exam attempt takes the full viewport width with content centered to ~672px (max-w-2xl).
- Resize to 390px wide (use DevTools device emulation if needed — Ctrl+Shift+M). Still no side-rail. No bottom-tabs bar either.

**❓ If something looks different:**

- Side-rail visible → the route `/exam/[id]` is incorrectly inside the `(protected)` group. Bug.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### C.2 — Right-click is disabled on the question area

**👉 Do this:**

1. Right-click on the question prompt text in the middle of the page.

**✅ What you should see:**

- **No context menu opens.** The browser silently swallows the right-click.
- This is a best-effort deterrent only — the server is the real guard. The exam screen attaches a `contextmenu` listener that calls `preventDefault()`.

**❓ If something looks different:**

- Right-click menu opens → the lockdown effect isn't applied. Check ExamClient's locked-UI `useEffect`.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### C.3 — Text selection is disabled on the question area

**👉 Do this:**

1. Try to click-drag-select a phrase from the question prompt.

**✅ What you should see:**

- Nothing gets selected — the text doesn't highlight. The page's `<body>` has `select-none` applied during the attempt stage.
- (You can still copy from the URL bar etc. — only the attempt content is locked.)

**❓ If something looks different:**

- Text selects normally → the `select-none` class wasn't applied. Check ExamClient's `useEffect`.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### C.4 — Select an option → auto-save fires within 500ms, no is_correct in payload

**👉 Do this:**

1. DevTools → Network → filter for `exam_answers`.
2. Click option A for the current question.

**✅ What you should see:**

- Option A highlights blue (same as the quiz).
- Within ~500 ms (note: **exam debounce is 500ms**, quiz is 250ms — exam is slower per spec), a `exam_answers?on_conflict=...` upsert fires returning 201/204.
- The payload contains `{ attempt_id, question_id, selected_option_id, is_flagged, answered_at }`. **NO `is_correct`.**

**❓ If something looks different:**

- 403 returned → either you're past the deadline (the deadline-cut RLS kicked in) OR your auth token is stale. The server is correctly rejecting; try clicking the option again.
- Auto-save fires twice in quick succession → check `useExamAutoSave` debounce logic.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### C.5 — Answer 3 questions, set 1 flag, change one selection

**👉 Do this:**

1. Q1: click option A.
2. Q2: click option B. Then click **Flag**.
3. Q2: click option **C** (changing the selection).
4. Q3: click option C.

**✅ What you should see:**

- Each click fires an auto-save within 500ms (see Network).
- The navigation grid colors reflect the state in real time:
  - Q1 circle: green (answered).
  - Q2 circle: red (flagged + answered).
  - Q3 circle: green (answered).
  - Q4+ circles: white (unanswered).
- The bottom bar's text reads "Answered 3/N · 1 flagged".

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### C.6 — Refresh mid-attempt → resumes with same remaining time + state

**👉 Do this:**

1. Note the TimerPill reading (e.g. `28:32`).
2. Press **F5** to reload the page.
3. Wait 2-3 seconds.

**✅ What you should see:**

- After a brief loading state, the **attempt** stage re-renders directly (NOT pre).
- Your selections + flag are restored.
- The TimerPill picks up where it should be: roughly `28:32` minus the seconds it took to reload + render.
- The `tab_switch_count` is preserved (still 0 if you haven't switched tabs).

**❓ If something looks different:**

- TimerPill resets to full duration → bug in deadline derivation. Ping me.
- Selections lost → check the `saved_answers` in the `exam-start` response.

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

**❓ Note:** the X button title hint says "Leaving counts as a tab switch" — actually X+route-leave does NOT trigger the tab-switch logger (the route unmounts before the visibilitychange fires). That's mobile-parity behavior.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### C.9 — Re-enter the attempt — banner count + selections survive

**👉 Do this:**

1. After C.8, you're on /classes. Click the Live exam row.
2. The page re-mounts.

**✅ What you should see:**

- Lands on attempt stage in <2 seconds.
- All selections + flags from C.5 + C.7 are preserved.
- TabSwitchBanner is NOT visible (count = 0).
- TimerPill is on time.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §D — Server-anchored timer (D-183) + 60-s resync + clock skew

This is the **highest-correctness** part of Phase 3. The exam timer must derive its remaining time from the **server's clock**, not the device clock — otherwise a student could extend their time by skewing their laptop clock.

Re-enter the Live exam attempt for these tests.

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

- A `server-time` POST fires at approximately ~60s, then ~120s, etc. — every 60 seconds during the attempt.
- The TimerPill keeps ticking down smoothly between syncs (1Hz tick).

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

**⚠ Important: this changes your laptop clock — write down the real time first.**

**👉 Do this:**

1. Open **Settings → Time & language → Date & time** (Windows).
2. Toggle off **"Set time automatically"**.
3. Click **Change** and set the time **5 minutes AHEAD** of what it actually is. Click Change to apply.
4. Return to the exam tab.
5. Within 60 seconds, the next `server-time` resync should fire.

**✅ What you should see:**

- Before the resync: the TimerPill may briefly jump down by 5 minutes (because `Date.now()` now reads 5 min ahead, but the mount-time offset is stale). Some browsers may not show this jump if React doesn't tick within the window — that's fine.
- **After the resync** (within 60s of the clock change): the TimerPill **corrects itself** — `offsetMs` becomes negative (server is "5 min behind" the device), and `remaining = deadline - (deviceNow + offsetMs)` corrects to the true server-clock-based remaining.

**👉 Reset your clock:** Settings → Date & time → toggle "Set time automatically" back ON.

**❓ If something looks different:**

- TimerPill stays at the skewed value forever (doesn't correct after 60s) → `useServerTimeOffset` isn't applying the new offset. Check `setOffsetMs` calls.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _reason: skipped clock change_

---

### D.5 — TimerPill turns red at ≤ 60 s

The unit test `TimerPill > turns red when remaining ≤ 60s` covers this. If you have a short test exam where you can watch the timer drop to 1 minute live, do it; otherwise mark N/A.

**👉 Do this (only if you have a short test exam):**

1. Wait for the timer to reach `01:00` or below.

**✅ What you should see:**

- At `01:00`, the TimerPill background changes from blue to **red** (`bg-red-100`) with red text and a red clock icon.
- The HTML attribute `data-warning="true"` is set on the timer.
- At `00:00`, the auto-submit fires (§F covers this).

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _reason: unit test covers it_

---

### D.6 — Late `exam_answers` write returns 403 (server-side deadline cut)

This verifies the server-side defense-in-depth backing up the client timer.

**👉 Do this:**

1. (Only if you did D.4 — clock is still skewed past the deadline.) Click a different option on the current question.

**✅ What you should see:**

- The `exam_answers` upsert fails with **HTTP 403** (visible in Network).
- The student's local UI may still show the option as selected (optimistic UI), but on next reload the server-side state won't reflect it.

**👉 Reset your clock if you haven't.**

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _reason: skipped clock manipulation_

---

# §E — Tab-switch logging + TabSwitchBanner (D-182)

Phase 3 uses the **Page Visibility API** + `window.blur` to detect when the student leaves the exam tab. Each detection bumps a server-side counter via `exam-tab-switch` (fire-and-forget). The TabSwitchBanner renders the count.

---

### E.1 — Switch to a new tab → yellow banner appears (count 1)

**👉 Do this:**

1. DevTools → Network → filter for `exam-tab-switch`.
2. Re-enter the Live exam attempt.
3. Open a new Chrome tab (Ctrl+T) and visit any URL (e.g. google.com).
4. Wait 3 seconds.
5. Switch back to the exam tab.

**✅ What you should see:**

- At the top of the exam attempt screen (just above the question card), a **yellow banner** appears: "You left the exam tab. Switches: 1".
- The banner has a shield-alert icon on the left.
- The banner has `data-severity="warning"` (yellow tone, NOT severe).
- DevTools → Network: an `exam-tab-switch` POST fired with `attempt_id`. The response body is `{ "tab_switch_count": 1 }`.
- The banner does NOT auto-dismiss — it stays for the rest of the attempt (mirrors mobile).

**❓ If something looks different:**

- No banner appears → the `useExamTabSwitchLogger` isn't attaching the visibilitychange listener. Check ExamClient.
- Banner shows count 0 → the count comes from the server response; check the response body.
- Multiple `exam-tab-switch` requests fire for a single Alt-Tab → the 500ms dedup guard isn't working. Check `lastLogAtRef` in `useExamTabSwitchLogger.ts`.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### E.2 — Two more tab switches → still yellow at 2, **red at 3+**

**👉 Do this:**

1. Switch to a new tab + back → 2 switches.
2. Switch again → 3 switches.

**✅ What you should see:**

- At 2 switches: banner is **yellow**, count = 2. `data-severity="warning"`.
- At 3 switches: banner turns **red** (`bg-red-50`), label includes " · Further switches may be reviewed by your teacher.", and `data-severity="severe"`.
- Each switch fires ONE `exam-tab-switch` request (not two).

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

### E.4 — Alt+Tab dedup: visibilitychange + blur in the same gesture counts as ONE switch

This is the dedup guard added in the polish pass. On Chrome, Alt+Tab fires BOTH `visibilitychange→hidden` AND `window.blur` within a few milliseconds.

**👉 Do this:**

1. Note the current banner count (e.g. 3).
2. Use **Alt+Tab** (NOT Ctrl+T new-tab) to switch to another open window briefly, then Alt+Tab back.
3. Watch the banner count + Network requests.

**✅ What you should see:**

- Banner count goes up by exactly **1** (e.g. 3 → 4).
- Exactly **ONE** `exam-tab-switch` request fires.

**❓ If something looks different:**

- Count jumps by 2 → the dedup window in `useExamTabSwitchLogger.lastLogAtRef` isn't working. Check the source.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### E.5 — D-182: silent on submitted

After you submit (§F or §A.9), tab-switching MUST be silent (no errors, no console warnings).

**👉 Do this:**

1. (Optional — can be done after §F if you submit there.) After submitting an exam, switch tabs again.

**✅ What you should see:**

- The `exam-tab-switch` fires but the server returns 200 with the existing count without bumping (because the attempt is submitted).
- No error in the Console, no broken UI.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _reason: covered by unit test `examTabSwitchLogger > silent on 404`_

---

# §F — Auto-submit at deadline

The exam timer fires `onExpire` exactly once when remaining hits 0. The handler calls `useExamSubmit.submit()` with `auto = true`. The result stage is shown immediately (instant-release) or the submitted stage (manual-release).

For F.1 you'll need a **short** test exam. The seed scripts in §0.4 don't create one by default. **Skip F.1 if you don't have a short exam — the unit test covers the trigger logic.**

---

### F.1 — Run the exam to deadline → auto-submits without click

**👉 Do this (only if you have a short test exam):**

1. Enter the short exam.
2. Watch the TimerPill tick down to `00:00`.

**✅ What you should see:**

- At `00:00`, the page transitions to the **result** stage (instant-release) or **submitted** stage (manual-release).
- The user did NOT click any submit button.
- DevTools → Network: exactly ONE `exam-submit` request fired with `auto_submitted=true` in the response.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _reason:_

---

### F.2 — Auto-submit fires exactly once (no duplicate submission)

This is covered by `apps/web/components/quiz/__tests__/TimerPill.test.tsx > calls onExpire exactly once`. Mark PASS based on the unit test, or repeat F.1 to confirm.

`Result:` [ ] PASS — unit test covers it.

---

### F.3 — Submit confirmation dialog warns about unanswered questions

**👉 Do this:**

1. Enter any live exam attempt.
2. Answer Q1 only. Leave the rest blank.
3. Click **Next** all the way to the last question.
4. On the last question, click the green **Submit** button.

**✅ What you should see:**

- The submit confirmation dialog opens.
- Subtitle: "You've answered 1/N. This cannot be undone." (Note the "This cannot be undone" — only present for the exam variant.)
- An amber alert box: "(N−1) unanswered questions: Q2, Q3, Q4, …" (with `data-testid="unanswered-list"`).
- Two buttons: **Cancel** + green **Submit**.

**👉 Click Cancel** → the dialog closes, you stay on the attempt screen.

**👉 Click Submit again, then green Submit in the dialog:**

- You submit → jump to result/submitted (depending on release mode).

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §G — Manual-release exam: locked-result waiting + auto-flip on release

A **manual-release** exam (`exams.result_release = 'manual'`) doesn't reveal the score until the teacher/admin explicitly releases it. The exam-attempt-result edge fn returns **HTTP 423** (Locked) for the student until then.

---

### G.1 — Submit a manual-release exam → submitted screen

**👉 Do this:**

1. From /classes, click the **Live manual** exam (the one from `seed:exam-manual-test` that has `result_release: manual`).
2. Enter the exam, answer all questions, and click Submit → confirm.

**✅ What you should see:**

- The page transitions to the **submitted** stage, NOT result.
- A `LockedResultCard` (data-testid="locked-result") displays:
  - A lock icon in a slate circle (top center).
  - Heading: **"Results will be available after your teacher releases them"**
  - A paragraph explaining auto-refresh on focus.
  - "Submitted: <timestamp>" line in slate-500.
  - "Tab switches recorded: N" line (if N > 0).
  - A **"Refresh now"** outlined button with a refresh icon.
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

### G.5 — Result → solution → see correct/wrong/skipped per question

**👉 Do this:**

1. On the result screen, click **Review solutions**.

**✅ What you should see:**

- The stage transitions to **solution**.
- A header with back arrow + "Solutions" title.
- The same SolutionCard list as the quiz (§A.10) — each question with the right outcome coloring.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §H — Instant-release exam + D-181 re-open routing

An **instant-release** exam shows the score immediately on submit. D-181 says: re-opening a submitted instant exam must route directly to the **result** stage, NOT restart.

---

### H.1 — Submit an instant-release exam → result immediately

**👉 Do this:**

1. From /classes, click the **Live instant** exam.
2. Enter, answer all questions, submit, confirm.

**✅ What you should see:**

- The page transitions DIRECTLY to the **result** stage (NOT submitted).
- DevTools → Network: the `exam-submit` response includes `results_released: true` with `score`, `max_score`, `correct_count`, `wrong_count`, `skipped_count`.
- The score breakdown card is visible.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### H.2 — D-181: Close the tab, re-open the exam → lands on result, not restart

This is the EXACT scenario the mobile shipped a bug on. Make sure web doesn't repeat it.

**👉 Do this:**

1. Click the X (top-left) — back to /classes.
2. Click the same exam row again.

**✅ What you should see:**

- URL becomes `/exam/<uuid>`.
- The page renders directly on the **result** stage (with the same score).
- It does NOT go through pre → "Enter Exam" UI. There's **no flicker** — even for a single frame.
- It does NOT try to start a new attempt.
- This proves the D-181 routing reads `existing_attempt.submitted_at` and `result_release` correctly + the flicker guard prevents the pre UI from briefly showing.

**❓ If something looks different:**

- Lands on pre stage → bug. Check `useExamPreInfo.data.existing_attempt.submitted_at` + the `reopenAppliedRef` `useEffect` in ExamClient.
- Brief flicker of "Enter Exam" → the flicker guard isn't catching it; check the guard right before the pre render.

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

### H.5 — D-181: Open a not-yet-submitted exam → starts at pre

**👉 Do this:**

1. Find any exam where you have NOT submitted yet (`pnpm seed:exam-manual-test --reset` and DON'T submit the Live exam this time).
2. From /classes, click that exam.

**✅ What you should see:**

- Lands on **pre** stage (with countdown or "Live now" depending on the window).
- No flicker through other stages.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §I — Solution stage: correctness + explanations + related-content

Solutions are loaded on-demand via `exam-attempt-result` (for exams) or `quiz-attempt-result` / `quiz-submit` (for quizzes). The dossier includes `is_correct` per option, `explanation_md`, and optional `related_content`.

---

### I.1 — Exam Review solutions → SolutionCard list

**👉 Do this:**

1. From the exam result screen, click **Review solutions**.

**✅ What you should see:**

- The stage transitions to **solution**.
- A back arrow (Chevron-left) + "Solutions" title in the header.
- A scrollable list of solution cards. For each:
  - Question prompt rendered (math via KaTeX if any).
  - Options with the right outcome encoding (see A.10 for the color rules).
  - Explanation box.
  - Outcome footer.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### I.2 — Solution cards show your_option vs. correct_option clearly

**👉 Do this:**

1. Scroll through your solutions and find one where you got it WRONG.

**✅ What you should see:**

- The option you picked has a **red border + red bg** + red letter circle.
- The actually-correct option has a **green border + green bg** + emerald letter circle with a check icon.
- All other options are default (no special highlight).

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### I.3 — Correct answer cards show only emerald

**👉 Do this:**

1. Find a question you got RIGHT.

**✅ What you should see:**

- The option you picked has a **green border + green bg** + check icon.
- No red anywhere.
- Outcome footer says "Correct (+4)" in emerald.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### I.4 — Skipped questions show only the correct option

**👉 Do this:**

1. Find a question you skipped (no selection).

**✅ What you should see:**

- The correct option has a **green outline** but no red anywhere (because there's no "your" option to mark wrong).
- The outcome footer reads "Skipped (+0)" (or whatever the marks_skip value is).

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### I.5 — Related-content link routes correctly

Same test as A.11 — quiz solution related links go to `/video/[id]` or `/pdf/[id]`. The exam solution cards use the SAME SolutionCard component.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _reason:_

---

# §J — Math rendering: inline + block + non-math fast path (D-178)

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

1. Enter a fresh quiz or exam attempt (re-run the seed if needed).
2. DevTools → Network → click `quiz-start` (or `exam-start`) → "Response" tab → press **Ctrl+F** to search.
3. Search for `is_correct`.

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

- **No output.** Zero matches. The service-role key is NEVER in the static bundle.

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

### K.5 — Phase 3 source files don't accidentally leak `is_correct`

The `cacheKeySecurity.test.ts` test scans the actual source files (after stripping comments) and asserts that attempt-stage hooks never reference `is_correct` or `correct_option_id`. Run it directly:

```powershell
pnpm --filter @fynestudy/web test features/quiz/__tests__/cacheKeySecurity.test.ts
```

**✅ What you should see:**

```
 ✓ features/quiz/__tests__/cacheKeySecurity.test.ts (4 tests) 5ms

 Test Files  1 passed (1)
      Tests  4 passed (4)
```

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### K.6 — `exam_answers` write after deadline returns 403

Already covered in §D.6. Mark accordingly.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _see §D.6_

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
      Tests  92 passed (92)
```

The 15 files include the 7 Phase 3 additions:
- `components/math/__tests__/MathText.test.tsx` (16 tests — parser + render)
- `components/quiz/__tests__/TimerPill.test.tsx` (5 tests — server-anchored countdown)
- `components/quiz/__tests__/NavigationGrid.test.tsx` (3 tests — status mapping)
- `features/quiz/__tests__/attemptHelpers.test.ts` (6 tests — computeStatuses/countAnswered/unansweredIndices)
- `features/quiz/__tests__/cacheKeySecurity.test.ts` (4 tests — no is_correct in attempt-stage source)
- `features/exams/__tests__/serverTimeOffset.test.ts` (11 tests — computeRemainingMs + formatRemainingMmSs)
- `features/exams/__tests__/examTabSwitchLogger.test.ts` (6 tests — fire-and-forget, silent on 404, Alt-Tab dedup)

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

**✅ Expected:** all Phase 1 + Phase 2 + Phase 3 specs run; the new Phase 3 specs are `quiz-attempt.spec.ts`, `exam-attempt.spec.ts`, `security-attempt.spec.ts`. Specific tests that depend on a seeded quiz/exam will **skip** automatically if the seed isn't fresh; that's expected.

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

- [ ] **§A** Quiz attempt — A.1–A.12 all PASS (A.11 may be N/A)
- [ ] **§B** Exam pre stage — B.1–B.5 all PASS
- [ ] **§C** Exam locked attempt — C.1–C.9 all PASS
- [ ] **§D** Server-anchored timer — D.1–D.6 PASS or N/A (D.4/D.6 may be skipped)
- [ ] **§E** Tab-switch logging — E.1–E.4 PASS; E.5 PASS or N/A (unit test)
- [ ] **§F** Auto-submit — F.3 PASS; F.1/F.2 PASS or N/A (no short exam)
- [ ] **§G** Manual-release waiting — G.1–G.5 all PASS
- [ ] **§H** Instant-release + D-181 — H.1–H.5 all PASS
- [ ] **§I** Solution stage — I.1–I.4 PASS; I.5 PASS or N/A
- [ ] **§J** Math rendering — J.1–J.3 PASS; J.4/J.5 PASS or N/A
- [ ] **§K** Security — K.1–K.3 + K.5 PASS; K.4 PASS or N/A; K.6 PASS or N/A
- [ ] **§L** Responsive — L.1, L.2 PASS; L.3, L.4 CARRY-OVER
- [ ] **§M** Automated gates — M.1–M.5 PASS

**Sign-off:**

```
Tester name:
Date:
Notes / anything unusual:
```

Once these boxes are ticked, paste this back to me (Claude). I will then:

1. Confirm the §J acceptance ledger at the bottom of `Phases/phase-3-assessments-quizzes-exams.md` is complete (it's already appended at code-complete time).
2. Update `CLAUDE.md`'s "🌐 Web App Conversion track" line — replace "code-complete" with "✅ ACCEPTED" + the sign-off date.
3. Update `project_web-phase-3-status.md` memory file with the sign-off date.
4. **Stop.** Phase 4 starts in a fresh new conversation with the kickoff prompt I'll provide separately.

---

# Carry-overs (NOT blockers for Phase 3 acceptance)

These items are explicitly deferred and tracked:

1. **Vercel deploy** + Supabase Authentication redirect-URL whitelist + extending `apps/functions/_shared/cors.ts` with a `web-*.vercel.app` regex.
2. **iOS Safari + Android Chrome on-device verification.** Both need HTTPS (Vercel).
3. **Cold-start measurement** on a Redmi 8A — only meaningful on a real device.
4. **Multi-role + suspended account creation** — pending user opt-in.
5. **Local KaTeX bundle hardening** — currently CSS is imported via the npm `katex` package, which Next bundles. The fonts are pulled from the same package. If the package URL ever changes this is a single import to update.
6. **Component-level Jest tests** for the quiz/exam reducers — the unit tests cover the pure helpers; a future hardening pass could add tests for the reducers + state machine transitions.
7. **Short-duration test exam in the seed** — to make F.1 testable without skipping.

# Troubleshooting cheat-sheet

| Symptom | Likely cause | Fix |
|---|---|---|
| Quiz "Start Quiz" button never appears | `quiz-start` returned non-200 — could be RLS scope | Check Network for the status; if 403, check the student's batch + the quiz's batch_id/course_id |
| TimerPill stays at `--:--` for >5s | `server-time` edge fn unreachable | Open `https://orqwyazvcthgxoadfxfv.supabase.co/functions/v1/server-time` in a tab; should return 200 with `{ now, epoch_ms }` |
| Auto-save never fires | `attemptId` is null | Check that `quiz-start`/`exam-start` returned an attempt_id; ensure your account has a `students` row with a `batch_id` |
| `exam_answers` 403 on every write | Past the deadline OR wrong attempt_id | Check the deadline-cut RLS migration is applied; verify `attempt_id` matches the current attempt |
| Math renders as raw `$x^2$` | KaTeX CSS not loaded | Confirm `apps/web/app/globals.css` has `@import "katex/dist/katex.min.css";` |
| Tab-switch banner doesn't appear | `visibilitychange` not firing on this OS/browser combo | Try Alt+Tab to a desktop window; the hook also listens for `window.blur` as fallback |
| Tab-switch count jumps by 2 on Alt-Tab | The 500ms dedup window in `useExamTabSwitchLogger` failed | Check `lastLogAtRef` in the hook |
| Instant exam re-open lands on pre stage | D-181 routing logic broken | Check `useExamPreInfo.data.existing_attempt.submitted_at` + the `reopenAppliedRef` `useEffect` in ExamClient |
| Pre stage flickers briefly on re-open | The flicker guard isn't catching | Check the early-return guard in ExamClient right before the pre render |
| Solution stage shows wrong correctness colors | `correct_option_id` vs `your_option_id` swapped | Inspect a SolutionCard's `q` prop — confirm both fields are present and distinct |
| `is_correct` in a Network response during attempt | P0 leak — STOP | Take a screenshot of the response URL + body, ping me. Do NOT continue testing |
| Refresh mid-attempt restarts the attempt | `saved_answers` not hydrating | Check `useEffect` in QuizClient/ExamClient that hydrates state from `startState.data.saved_answers` |
