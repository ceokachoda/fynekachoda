# Phase 6 — Manual Test Plan (Visual + Real-Device only)

> **Scope:** this doc covers ONLY what an automated test cannot do — real
> browser rendering, real device interactions, KaTeX rendering inside a
> WebView, real-network signing of exam-image URLs, server-anchored timer
> countdown UX, and the visual no-`is_correct`-leak check via the network
> inspector. Every functional/data behaviour has been auto-verified by me
> on this dev project (`orqwyazvcthgxoadfxfv`) — see §H.
>
> **DO NOT skip sections.** Phase 6 is CODE-COMPLETE but has had ZERO
> human-in-the-loop testing. Treat every section as a fresh bug hunt. If a
> step's "Expected" doesn't match what you see — that's a real bug, paste
> it back per §I and I'll patch.

---

## Progress / Status — updated 2026-05-20

**Legend:** ✅ done · 🟢 backend-verified (logic/data proven by automated tests
or live SQL; on-screen rendering NOT yet eyeballed) · 👁 needs human/device · ⏳ not started

| § | Title | Status | Note |
|---|---|---|---|
| 0 | Setup + KaTeX prep | ✅ | Fixtures seeded; §0.5 SQL run. |
| A | Admin /quizzes + /questions | 🟢 mutations / 👁 layout | Publish-toggle+audit, archive, delete-in-use→409, delete all proven via `smoke:quiz-fns`. Page **layout** still needs a browser look. |
| B | Teacher quiz-builder | 👁 (user walked B1–B7) | Code-reviewed + fixed (search, single-answer radio, prompt-in-list, reorder ↑/↓). Teacher write-RLS green (T9). UI interaction visual. |
| C | Student happy path (C1–C16) | ✅ user-walked | Incl. timer (C9/C10 confirmed correct = server-anchored), weak topics (C15/C16 verified vs DB). |
| D | Student edge cases | 🟢 | D1 no-leak (T12), D2/D3 scope (T6), D4 grading, D6 replay 409 all green. On-screen confirmation visual. |
| E | KaTeX + write coverage | 🟢 / 👁 E2 | E3 reconciled to single-answer radio; E4 cross-teacher block green (T9). **E2 KaTeX typeset render** = visual. |
| F | SQL sanity | ✅ re-verified live | Column counts, RLS-on-7, **33 policies**, exam-images bucket — exact match 2026-05-20. |
| G | Perf + cross-platform | 👁 / ⛔ G2 | G1/G3/G4 device-only; G2 Redmi 8A hardware-blocked. All optional. |

**Automated suites green (2026-05-20):** `test:quiz` 27/27 · `smoke:quiz-rls`
12/12 · `smoke:quiz-fns` 26/26 · mobile jest 53/53 · full typecheck + lint exit 0.

**Bugs fixed this QA session (uncommitted on `phase-4`):** B7 search box ·
single-answer correct-toggle (was multi-correct → silent mis-grade) · question
prompts shown in builder list (was UUID) · B8 reorder ↑/↓ (was missing) ·
submit-button-on-timer-expiry · `useQuizDiscovery` div-by-zero guard ·
weak-topics negative-score clamp + C15 skip-for-0% doc fix · 9 lint escapes ·
B4 single-course auto-select.

**What's LEFT (human/device only):** §A page layout · §B builder UI walk-through
(B8–B10 not yet done) · **§C5 + §E2 KaTeX visual typeset** · §G perf spot-checks.
Phase 6 stays 🟡 — **do not flip ACCEPTED until these visual passes are signed off.**

---

## 0. One-time setup

### 0.1 Fresh fixtures

```
pnpm seed:quiz-manual-test --reset
```

The `--reset` wipes prior `p6-*` users + `P6_TEST_*` courses before
reseeding. (First-ever run: the flag is harmless, just a no-op.)

Copy the printed block to a scratch file. You'll need:
- **Course id** + topic ids (`Kinematics` and `Vectors`)
- **Batch A id** + **Batch B id**
- **Teacher** email + initial password (`p6-teach-<ts>@fynestudy.example.com`)
- **Student A1** + **Student A2** (Batch A) email + password
- **Student B1** (Batch B) email + password
- **Quiz 1 id** — "Kinematics — Easy 4" — published, batch-A-scoped, 4 questions, +4/−1
- **Quiz 2 id** — "Vectors — Hard 1" — published, course-wide, 1 question, +4/−1
- **Quiz 3 id** — "Drafts — hidden" — DRAFT, batch-A-scoped, 1 question

All four accounts already have `must_change_password = false` so you can
sign in directly.

### 0.2 Owner admin

```
Email      owner@fynestudy.example.com
Password   FyneStudy01     (or your Phase 2 password)
TOTP       (your enrolled secret)
```

Admin URL: <https://fyne-study-app-admin.vercel.app/>

If Vercel still shows the Phase 1 placeholder, fall back to local dev:

```
pnpm dev:admin
# open http://localhost:3000
```

### 0.3 Metro clean restart (NON-NEGOTIABLE)

Phase 6 adds 2 new top-level routes (`quiz/[id]`, `quiz-builder/[quizId]`),
1 new tab (`(teacher)/quizzes`), the new Weak Topics card on the student
home, and the Practice Quizzes section in the student library. Hot-reload
**cannot** propagate route-tree changes. Every test session:

```
1. Ctrl+C in Metro terminal.
2. Force-quit Expo Go (iOS: swipe Expo Go card UP. Android: swipe away.)
3. pnpm dev:mobile -- --clear     ← the wrapper, with --clear.
4. Open Expo Go from the HOME-SCREEN icon (not recents).
5. Scan the QR.
6. Metro log MUST say "(NNNN modules)" with N in thousands.
   If it says "(1 module)" the cache didn't clear — go back to step 1.
```

### 0.4 What's NEW vs Phase 5

Quick mental map of what to look for that didn't exist before:
- **Admin sidebar:** two new entries — "Quizzes" and "Question bank".
- **Teacher tab bar:** a new "Quizzes" tab. NOTE: this branch also carries
  Phase 7, so the bar shows **8 tabs** total (Home · Scan · Classes ·
  Library · Quizzes · Exams · Batch · Profile) — tight on narrow phones,
  that's acceptable.
- **Student home dashboard:** a new "Weak topics" card. It lists any topic
  where your **best** quiz score is under 70% (best, not average — one
  ≥70% attempt clears the topic).
- **Quiz-builder scope:** if you teach only ONE course, the "Course" picker
  row is hidden and that course is auto-selected — the Subject picker is the
  first row you tap. The Course row only appears when you teach 2+ courses.
- **Student library:** at the topic level, a "Practice Quizzes" section
  appears below the Phase 5 content list.
- **Two new full-screen routes:** `quiz/[id]` (attempt + result + solution)
  and `quiz-builder/[quizId]` (teacher builder) — both top-level Stack
  (no tab bar visible) per D-169.

### 0.5 KaTeX rendering prep

The seed plants 5 questions with PLAIN-TEXT prompts (no math). To test
KaTeX rendering you need at least one question with `$…$` math. Either:

- Walk §E1 to create one via the teacher quiz-builder, OR
- Run this SQL in Supabase Studio → SQL Editor (project
  `orqwyazvcthgxoadfxfv`):

```sql
update public.questions
   set prompt_md = 'Solve $x^2 - 4 = 0$ for $x$.'
 where prompt_md = 'What is the SI unit of acceleration?';
```

After running this, the first question of "Kinematics — Easy 4" will
render KaTeX glyphs during your §C attempt.

---

## A. Admin `/quizzes` + `/questions` moderation — visual layout (browser)

You're verifying the page LOOKS right and clicks DO things. The data side
is already proven in §H.

### A1. Nav item present + page loads

```
1. Open the admin URL. Sign in as owner.
2. Complete TOTP if prompted.
3. Left sidebar should show ELEVEN entries (in order):
      Overview · Students · Teachers · Admins (Phase 11) · Batches
      Courses · Attendance · Content · Quizzes · Question bank
      Audit log (Phase 11)
4. "Quizzes" and "Question bank" are real blue links (not greyed).
5. Click "Quizzes". URL goes to /quizzes.
```
**Report:** "A1 ok" or which item is missing/mislabeled.

### A2. /quizzes page layout

```
1. Title: "Quizzes"
2. Subtitle: "Moderate practice quizzes · publish / unpublish · delete."
3. Filter card with 4 controls + Export button on the right:
      Course | Batch | Status | Search box | [Export CSV]
4. Table header reads:
      Title · Scope · Topic / Chapter · Marks · Q · Attempts · Status · Actions
5. The 3 seeded rows appear (if list is long, filter Course = your
   P6_TEST_<ts>):
      Kinematics — Easy 4    P6 Batch A   Kinematics    +4/-1/0    4 · 0    Published
      Vectors — Hard 1       Course-wide  Vectors       +4/-1/0    1 · 0    Published
      Drafts — hidden        P6 Batch A   Kinematics    +4/-1/0    1 · 0    Draft
6. "Published" pill is EMERALD green. "Draft" pill is SLATE grey.
   "Course-wide" appears in the Scope column for Quiz 2 (no batch).
```
**Report:** "A2 ok — pills colored correctly" or describe the mismatch.

### A3. Filter + search — UI reaction only

```
1. Course = P6_TEST_<your-ts>  →  table narrows to your 3 rows.
2. Batch = "P6 Batch A …"      →  2 rows (Kinematics + Drafts).
3. Batch = "Course-wide (no batch)"  →  1 row (Vectors).
4. Clear Batch. Status = "Draft" → 1 row (Drafts — hidden).
5. Status = "Published" → 2 rows.
6. Clear Status. Search "Vectors" → press Enter → 1 row.
7. Clear search.
```
**Report:** "A3 ok — UI updates per filter".

### A4. Publish toggle (admin override)

```
1. Find the "Drafts — hidden" row. Its status pill is SLATE "Draft".
2. Click the "Publish" button in its Actions column.
3. Page reloads. Status pill flips to EMERALD "Published".
4. Open Supabase Studio → SQL Editor:
      select is_published from public.quizzes where title like 'Drafts%';
   Expected: true.
5. Audit row check:
      select action, entity_id, occurred_at
      from public.audit_log
      where action = 'quiz_publish'
      order by occurred_at desc limit 1;
   The most recent row should match the quiz id of "Drafts — hidden".
6. Back on /quizzes, click "Unpublish" on the same row.
7. Pill flips back to SLATE "Draft". A new audit row
   action='quiz_unpublish' appears.
```
**Report:** "A4 ok — pill + audit row flip both ways" or what fails.

### A5. Delete confirmation modal (do NOT confirm)

```
1. Find any quiz row (use Quiz 3 / Drafts — hidden — safest).
2. Click "Delete".
3. Black-overlay modal pops up:
      Title:   "Delete quiz?"
      Body:    Mentions row title and "This will also remove all attempts
                and answers. This cannot be undone."
      Buttons: Cancel (grey-border) + Delete permanently (red).
4. Click Cancel → modal closes, row stays in the table.
5. Re-open the modal; click outside it → modal closes (backdrop dismiss).
6. DO NOT confirm delete — you'll need Quiz 3 later. If you accidentally
   delete it, run `pnpm seed:quiz-manual-test --reset` and start over.
```
**Report:** "A5 ok — modal opens + cancel works".

### A6. CSV export

```
1. With no filters, click "Export CSV".
2. Browser downloads `quizzes-2026-05-19.csv` (or your today's date).
3. Open in Excel or text editor.
4. Verify header row reads:
      id,title,course,batch,topic,chapter,duration_min,marks_correct,
      marks_wrong,marks_skip,is_published,question_count,attempt_count,
      created_by,created_at
5. Verify at least one seeded row appears with the right values.
6. The `created_at` column is ISO-8601 (e.g., `2026-05-19T05:42:31Z`).
```
**Report:** "A6 ok — CSV header + rows look right".

### A7. /questions page layout

```
1. Click "Question bank" in the sidebar.
2. Title: "Question bank"
3. Subtitle mentions moderating questions across all topics.
4. Filter card: Topic / Difficulty / Status / Search / Export CSV.
5. Table header reads:
      Prompt · Topic · Difficulty · Options · Used in N quiz(zes) · Status · Actions
6. At least 5 seeded rows visible. Each shows a truncated prompt (~80
   chars), topic name, difficulty pill (easy/medium/hard or "—"),
   "1 correct of 4" in the Options column, and a use_count column
   showing 1+ for Q1–Q4 (used in Quiz 1) and Q5 (used in Quiz 2 / Quiz 3).
```
**Report:** "A7 ok — 5 rows, columns populated".

### A8. Archive / unarchive a question

```
1. Find the row "The dot product of two perpendicular vectors is:"
   (this is Q5). Status pill: GREEN "Active".
2. Click "Archive" in its Actions column.
3. Page reloads. Status pill flips to AMBER "Archived".
4. Audit row check:
      select action, entity_id from public.audit_log
      where action = 'question_archive'
      order by occurred_at desc limit 1;
5. Open the student app (Student A1 will work) → Library →
   Physics → Mechanics → Vectors. The Practice Quizzes section may
   still show Quiz 2 (because the quiz row still has the question
   junction), but attempting Quiz 2 will get a 409 from `quiz-start`
   because the active questions are empty. DO NOT actually attempt
   Quiz 2 yet — just confirm the section title still shows.
6. Back in admin /questions, click "Unarchive" on the same row.
7. Pill flips back to GREEN "Active". Audit row `question_unarchive`
   appears.
```
**Report:** "A8 ok — archive + audit work" or what failed.

### A9. Delete button DISABLED when in use

```
1. Find Q1 (used in Quiz 1, the published Kinematics quiz).
2. Hover over its "Delete" button.
3. Button should be DISABLED (greyed out) OR clicking it should pop a
   409 alert "Question still used by quizzes — archive instead."
4. (The smoke test already verified the 409 path — this is just visual.)
```
**Report:** "A9 ok — delete blocked on in-use question" or "delete went
through (BUG — should 409)".

### A10. Delete unused question (skippable)

```
1. Find any question NOT in any quiz (the seed doesn't have one; you can
   create one via §B if you want to test). Skip if you don't want to add
   a fresh question just for this.
2. Click "Delete". Modal opens.
3. Confirm. Row vanishes. Audit row `question_delete` appears.
```
**Report:** "A10 ok" or "A10 skipped".

---

## B. Teacher mobile — quiz-builder UI rendering (real device)

Sign out the admin. Open Expo Go (after the §0.3 clean restart). Sign in
as the teacher.

### B1. Sign in lands on home + tab bar

```
1. Enter teacher email + initial password from §0.1.
2. Tap "Sign in".
3. Lands on Teacher Home (greeting + today's sessions card).
4. Bottom tab bar shows EIGHT tabs (left → right):
      Home · Scan · Classes · Library · Quizzes · Exams · Batch · Profile
   The new Phase 6 tab is "Quizzes" (list-checks icon). "Exams"
   (clipboard-check icon) is the Phase 7 tab — both ship on this branch.
5. On narrow phones the labels may compress or scroll — that's
   acceptable as long as all 8 icons are present.
```
**Report:** "B1 ok — 8 tabs visible" or which tab is missing.

### B2. Quizzes tab — list view

```
1. Tap the "Quizzes" tab.
2. Header: "Quizzes" + a blue "New" pill button top-right
   (with a file-plus icon).
3. The 3 seeded quizzes appear (newest first by created_at):
      Drafts — hidden        1 question · 10 min · Draft
      Vectors — Hard 1       1 question · 2 min  · Published
      Kinematics — Easy 4    4 questions · 5 min · Published
   Each row is white with a blue list-checks icon, title, subtitle,
   and a right chevron.
4. Tap any row → opens the quiz-builder at `/quiz-builder/<id>`.
5. Back nav (top-left close X) → returns to the Quizzes tab.
```
**Report:** "B2 ok — 3 rows visible, chevron navigates".

### B3. Quiz-builder — New screen

```
1. From the Quizzes tab, tap "New" (top-right).
2. Screen replaces the tab bar (top-level Stack route — no bottom tabs
   visible).
3. Header reads "New Quiz" with a back chevron on the left.
4. Sections visible (scroll if needed):
      a. Title (text input, empty)
      b. Scope card with picker rows: Subject, Chapter, Topic, Batch.
         (A "Course" row appears ABOVE Subject only if you teach 2+ courses;
         with the single seed course it's hidden + auto-selected.)
      c. Timing + marking row: Duration (default 20) / +Correct (4) /
         −Wrong (-1) / Skip (0)
      d. Randomize switches: Questions ON, Options ON
      e. Questions list: empty + two pills "From bank" / "+ New question"
      f. Bottom: "Save Draft" (grey) + "Publish" (blue) buttons
5. The Publish button is GREY-DISABLED until at least Title + Topic are
   filled.
```
**Report:** "B3 ok — form pre-fills with defaults" or what's missing.

### B4. Cascading pickers (subject → chapter → topic → batch)

> NOTE: the seed teacher teaches exactly ONE course, so the "Course" row is
> hidden and that course is auto-selected for you. The Subject row is the
> first one you tap, and it should be tappable (NOT greyed out) immediately.
> A "Course" row only appears for teachers in 2+ courses. (If Subject/Chapter/
> Topic are greyed and un-tappable, that's the bug fixed on 2026-05-20 —
> reload the app: shake → Reload, or close the builder and reopen it.)

```
1. Tap "Subject" → bottom sheet → "Physics". Tap it.
2. Tap "Chapter" → sheet → "Mechanics". Tap.
3. Tap "Topic" → sheet → 2 entries: "Kinematics" and "Vectors". Tap
   "Kinematics".
4. Tap "Batch" → sheet → 2 entries: "Course-wide (no batch)" and
   "P6 Batch A …" (the one you teach). Tap "P6 Batch A".
5. Each picker shows a check mark on the current selection.
```
**Report:** "B4 ok — pickers cascade".

### B5. + New question modal

```
1. Set Title = "Manual test quiz". (Required for save.)
2. Scroll to the Questions section.
3. Tap "+ New question".
4. Modal slides up from bottom. Sections:
      a. "New Question" header + close X top-right
      b. Prompt textarea (multiline, ~3 rows visible)
      c. Difficulty pills: Easy / Medium / Hard (none selected)
      d. 4 option rows (A/B/C/D circles + text input). Tap a circle to
         mark it the correct answer. SINGLE-ANSWER only — tapping a second
         circle moves the green check (the previous one clears).
      e. Explanation textarea (optional)
      f. Related content row (optional — Phase 5 content picker)
      g. "Save" button bottom-right
5. Type prompt: "Solve $x^2 - 4 = 0$ for $x$." (KaTeX math). The textarea
   accepts the `$…$` markdown verbatim — no auto-rendering inside the
   builder; rendering happens only on the student attempt screen.
6. Tap option A circle → it turns green with a white check.
7. Type "x = ±2 (correct)" into A, "x = 2 only" into B, "x = 0" into C,
   "no real solution" into D.
8. Tap "Save" button.
```
**Report:** "B5 ok — modal saves question" or "B5 FAIL — <what>".

### B6. Validation guards (modal)

```
1. Open + New question modal again.
2. Leave prompt EMPTY, tap Save → Alert "Empty prompt" or similar.
3. Type a prompt, but mark ZERO options correct, tap Save → Alert
   "Mark at least one option correct".
4. Mark 1 correct, but leave 2+ option text inputs empty → Alert
   "Need at least 2 options with text".
5. Fill 2 options + 1 correct → Save succeeds; modal closes.
```
**Report:** "B6 ok — validation alerts work".

### B7. Add from bank sheet

```
1. Scroll Questions section. Tap "From bank".
2. Modal slides up full-screen: title "Pick from Question Bank", a search
   box ("Search questions…"), and a scrollable list below it.
3. The list shows the 5 seeded questions Q1–Q5 (truncated prompts).
4. Type "ball" in the search box → list narrows to Q2 ("A ball is dropped …").
5. Tap the small X inside the search box to clear it → the full list returns.
6. Tap Q2 + Q3 (multi-select). Each selected row gets a blue border + a blue
   checkbox with a white checkmark on the left. The top-right button updates
   to read "Add (2)".
7. Tap the "Add (2)" button (top-right) to commit your picks.
   ⚠ The X (top-left) CLOSES WITHOUT ADDING — always use the Add button.
8. The Questions section in the parent screen now has 2 NEW rows for
   Q2 and Q3, plus the question you created in B5.
```
**Report:** "B7 ok — 3 questions added (1 new + 2 from bank)".

### B8. Reorder + delete in the builder list

```
1. With ≥3 question rows in the builder, tap the "↑" button on the
   middle row → it swaps places with the row above.
2. Tap the "↓" on the new top row → swaps with the one below.
3. Tap the red trash icon on the bottom row → row vanishes.
```
**Report:** "B8 ok — reorder + remove work".

### B9. Save Draft and re-edit

```
1. With the form filled (Title, Topic = Kinematics, Batch = P6 Batch A,
   at least 2 questions), tap "Save Draft".
2. Screen pops back to the Quizzes tab. Your new draft "Manual test
   quiz" appears at the top, marked "Draft".
3. Tap it → opens quiz-builder again, all fields PRE-POPULATED from the
   saved row (title, scope, marks, questions in saved order).
```
**Report:** "B9 ok — draft persists + reloads".

### B10. Publish

```
1. From the re-opened quiz-builder, scroll to the bottom.
2. Tap "Publish" (blue).
3. Saves + pops back to the Quizzes tab.
4. The quiz row now reads "Published".
5. Open the admin /quizzes page in a browser → the same quiz appears
   with EMERALD "Published" pill.
```
**Report:** "B10 ok — publish persists" or what failed.

---

## C. Student mobile — happy path (real device)

Sign out the teacher → sign in as **Student A1** (Batch A).

### C1. Home dashboard renders + no Weak Topics yet

```
1. After sign-in, lands on Student Home.
2. Header shows "Good morning/afternoon/evening, P6 Student A1 …".
3. The "Weak topics" section is ABSENT (you haven't submitted any
   quiz with <70%).
4. The "Today's schedule" + "Attendance %" cards from Phase 4 are still
   visible.
```
**Report:** "C1 ok — Weak Topics hidden on first run".

### C2. Library → topic shows Practice Quizzes section

```
1. Tap "Library" tab.
2. Subjects grid shows "Physics".
3. Tap Physics → Mechanics → Kinematics.
4. After any Phase-5 content items, scroll down: "Practice Quizzes"
   section header appears with EXACTLY 1 row visible:
      Kinematics — Easy 4    4 questions · 5 min · 0 attempts
   Each row has a blue list-checks icon + the title.
5. Back to Chapter list → tap "Vectors" → 1 row visible:
      Vectors — Hard 1       1 question · 2 min · 0 attempts
6. The DRAFT "Drafts — hidden" must NOT appear anywhere for Student A1.
```
**Report:** "C2 ok — Kinematics has 1 quiz, Vectors has 1 quiz, no draft".

### C3. Quiz intro screen

```
1. Tap "Kinematics — Easy 4".
2. Screen replaces the tab bar (top-level Stack route).
3. Header: close X (top-left) + quiz title centered.
4. Below: rules card listing
      4 questions · 5 minutes
      Correct: +4    Wrong: -1    Skip: 0    Total possible: 16
5. Big blue "Start Quiz" button.
6. Caption "Auto-saves every action. You can leave and come back."
```
**Report:** "C3 ok — intro renders".

### C4. Start attempt — timer + Q1

```
1. Tap "Start Quiz".
2. Screen transitions to the attempt UI in <2s on a mid-tier phone.
3. Top bar: close X (left) · quiz title (centred) · timer pill (right).
4. Timer pill reads "05:00" and DECREASES by 1 every second
   (verify: wait 5 seconds, value should read ~04:55).
5. Question card shows "Q 1 / 4" + the prompt text. (If you ran §0.5
   SQL, Q1's prompt is "Solve $x^2 - 4 = 0$ for $x$." — KaTeX should
   render the equation in a smaller WebView panel within the card.)
6. Below: 4 option rows with letter circles A/B/C/D. All circles grey
   by default.
7. Bottom: flag button (left) + Prev/Next pills + Q-grid (small 1/2/3/4
   pills horizontally scrollable) + Submit button (only on last Q).
```
**Report:** "C4 ok — timer counts down, Q1 visible".

### C5. KaTeX rendering check

(Only meaningful if you ran §0.5 SQL.)

```
1. Look at Q1's prompt. The `$x^2 - 4 = 0$` should appear as TYPESET
   math (x squared with a real superscript), NOT as raw "$x^2 - 4 = 0$"
   text.
2. KaTeX is rendered by mounting a tiny WebView inside the QuestionCard
   when the prompt contains `$…$` / `\(…\)` / `\[…\]` delimiters
   (D-178). Plain-text prompts render to native <Text> (no WebView).
3. The KaTeX render takes ~200–600ms on first paint; subsequent question
   navigations should be near-instant because the CDN-cached KaTeX
   bundle stays loaded.
```
**Report:** "C5 ok — math glyphs render" OR "C5 skipped — no math prompt"
OR "C5 FAIL — raw `$…$` text shown".

### C6. Select an answer + see Q-grid update

```
1. Tap option A on Q1. The A circle turns BLUE; option border BLUE.
   Other options stay grey.
2. The Q-grid pill 1 at the bottom turns GREEN (answered).
3. Tap option B → A returns to grey, B turns blue. Pill 1 still GREEN
   (still answered, just different option).
4. Tap option B again → DESELECTS (back to grey). Pill 1 turns WHITE
   (unanswered). A "Clear" text appears next to the flag button when
   an option is currently selected.
```
**Report:** "C6 ok — selection toggles + pill updates".

### C7. Flag for review

```
1. With Q1 either answered or unanswered, tap the 🚩 flag pill.
2. Pill turns AMBER and the Q-grid pill 1 turns YELLOW (if unanswered)
   or PURPLE (if answered + flagged — exact colour names from the
   NavigationGrid component palette).
3. Tap the flag again → reverts.
```
**Report:** "C7 ok — flag toggles colour".

### C8. Navigate via Next/Prev + Q-grid

```
1. Tap "Next" (right arrow at the bottom). Q2 appears. Q-grid pill 2
   highlighted BLUE (current).
2. Answer Q2 (any option) → pill 2 turns GREEN.
3. Tap "Prev" → Q1 again, selection from C6 still ticked.
4. Tap Q-grid pill 4 → jumps to Q4 directly.
5. Answer Q3 + Q4. All 4 pills GREEN.
```
**Report:** "C8 ok — nav works in both directions".

### C9. Auto-save survives app background

```
1. With some Qs answered, background the app:
      iOS: swipe up to home (do NOT swipe Expo Go away).
      Android: home button.
2. Wait ~30 seconds.
3. Return to Expo Go. Quiz attempt screen still on Q4 (or wherever).
4. Timer continues counting from where it was (server-anchored — server
   uses `deadline_at` which is `started_at + duration_min`).
5. Selections + flags from before backgrounding are still visible.
```
**Report:** "C9 ok — state preserved + timer continues".

### C10. Resume across screen exit

```
1. Tap the close X at the top-left → returns to library.
2. Tap "Kinematics — Easy 4" again → intro screen.
3. Tap "Start Quiz" again. Should resume the same attempt — selections
   from C8 still ticked (auto-saved to `quiz_answers` via PostgREST,
   server returns the saved_answers payload in `quiz-start`).
4. Confirm the timer continued running (e.g., if you spent 1m before
   exit + 1m on library + 30s wait + 1m back = ~3.5 min, timer reads
   ~01:30 remaining).
```
**Report:** "C10 ok — attempt resumes with answers + timer state".

### C11. Submit confirmation modal

```
1. Tap "Submit" button (visible only on last Q OR you can scroll to
   bottom of any Q's stack — depends on the build, just look for the
   green "Submit" pill).
2. Modal pops up: "Submit quiz?"
3. Body: "You've answered N/4{, flagged M}.".
4. Buttons: Cancel (grey text) + Submit (green pill).
5. Tap Cancel → modal closes, no submit.
6. Re-open + tap Submit. Spinner briefly, then result screen.
```
**Report:** "C11 ok — modal opens + submit works".

### C12. Result screen

```
1. After submit, transitions to RESULT stage:
      Big number: "X / 16" with subtitle "Y%"
      Stat row: Correct (green) · Wrong (red) · Skipped (grey)
2. Score arithmetic check:
      seed canonical answers:
        Q1: "m/s² (correct)"
        Q2: "20 m/s (correct)"
        Q3: "Straight horizontal line on a v-t graph (correct)"
        Q4: "Returned to its starting point (correct)"
      If you picked all 4 correctly → score = +16 → 100%.
      If you picked 2 correct, 2 wrong → +4+4-1-1 = +6 → 38%.
3. Below: blue "View Solutions" button + grey "Retake" + grey "Back".
```
**Report:** "C12 ok — score = N/16, Y%, breakdown matches".

### C13. Solutions screen

```
1. Tap "View Solutions".
2. Header: "Solutions" + back chevron.
3. Scrollable list of per-question cards. Each card shows:
      a. Q index + total ("Question 1 of 4")
      b. The prompt
      c. All 4 options. The CORRECT option highlighted GREEN with a
         green check. YOUR option highlighted (BLUE if same as correct;
         RED with X if different).
      d. Explanation text in a subtle italic panel below
4. For Q1 only (because the seed linked it to a reference video), a
   "Related: Intro to Kinematics (placeholder)" tile appears at the
   bottom of the card.
5. Tap the Related tile → navigates to `video/[contentId]` Phase 5
   player. (Player may or may not actually play because the seed uses
   a non-real YT id by default.)
```
**Report:** "C13 ok — solutions render with green/red highlights".

### C14. Retake

```
1. From the Result screen (back-nav from Solutions if needed), tap
   "Retake".
2. Returns to the intro screen. Tap "Start Quiz" → fresh attempt.
3. Verify: `quiz-attempts` table grows by 1 row in Supabase Studio:
      select id, submitted_at, score
      from public.quiz_attempts
      where student_id = <Student A1's app_users.id>
      order by started_at desc limit 3;
```
**Report:** "C14 ok — retake creates new attempt row".

### C15. Weak Topics card appears (low score)

> Weak topics are decided by your **best** score on a topic (one ≥70% attempt
> clears it). Student A1 may already have a high Kinematics attempt from
> C4–C14, so use a FRESH student here for a deterministic result.

```
1. Sign out → sign in as Student A2 (Batch A — same scope as A1, but with
   no quiz attempts yet).
2. Library → Physics → Mechanics → Kinematics → "Kinematics — Easy 4".
3. Start Quiz. Deliberately SKIP all 4 questions — do NOT select any
   option; just tap "Next" through them, then "Submit" on the last one.
   Confirm modal shows "answered 0/4". Submit → Score 0/16 → 0%.
   (Why skip, not pick-wrong? marks_wrong = −1, so picking a wrong option
   on every question would give −4/16. Skipping = marks_skip 0 = clean 0.)
4. Tap "Back" to library.
5. Tap "Home" tab.
6. "Weak topics" section now visible above any other sections.
7. The row reads "Kinematics — 0%" with suggested quiz
   "Kinematics — Easy 4" + attempt count. (0% is A2's best Kinematics score.)
8. Tap the row → navigates to `quiz/<id>` intro screen of the suggested
   quiz.
```
**Report:** "C15 ok — weak topic surfaces" or what failed.

### C16. Weak Topic disappears at ≥70%

```
1. Still as Student A2, take "Kinematics — Easy 4" again, this time
   answering all 4 correctly. Submit. Score 16/16 → 100%.
2. Tap "Back", then the "Home" tab.
3. Pull-to-refresh on Home (drag down) OR navigate away + back.
4. The "Kinematics" row in Weak Topics is now GONE — A2's BEST Kinematics
   score is 100% (≥ 70% threshold), so the topic is no longer weak.
```
**Report:** "C16 ok — high score clears weak topic" or what stayed.

---

## D. Student mobile — edge cases (real device)

### D1. No-leak visual check (advanced — Safari dev tools)

```
1. With the Expo iOS dev menu enabled (shake to open), connect Safari:
      Safari → Develop → <Your iPhone> → JSContext
2. In an active attempt, open Network tab.
3. Trigger a `quiz-start` re-call (background app + foreground OR tap
   close + re-enter intro + Start Quiz again — resume call).
4. Find the `/functions/v1/quiz-start` request → Response tab.
5. Search the JSON body for the substring `"is_correct"`.
6. Expected: ZERO matches anywhere in the response.
   (Automated smoke T12 already verified this — this is just for trust.)
```
**Report:** "D1 ok — no is_correct in payload" OR "D1 skipped — no
Safari dev tools" OR "D1 FAIL — found <where>".

### D2. Cross-batch — Batch B student sees Vectors only

```
1. Sign out → sign in as Student B1 (Batch B).
2. Library → Physics → Mechanics → Vectors.
3. Practice Quizzes section: 1 row "Vectors — Hard 1" visible.
4. Back to Chapter list → tap "Kinematics".
5. Practice Quizzes section: EMPTY (or section header absent).
   Student B1 cannot see Kinematics — Easy 4 because it's batch-A-scoped.
```
**Report:** "D2 ok — cross-batch RLS scoped correctly".

### D3. Direct URL to other-batch quiz blocked

```
1. As Student B1, open the iOS Universal-Link OR manually type into a
   note: `exp://<your-LAN-ip>:8081/--/quiz/<Quiz 1 id>` (use the
   Kinematics quiz id from §0.1).
   (Alternative: copy-paste the Quiz 1 id into the URL bar of the Expo
   Go dev client.)
2. App routes to the quiz intro screen.
3. Tap "Start Quiz".
4. Expected: red error UI "quiz not in your batch" with a Retry button.
   (Server-side `quiz-start` returns 403; the screen renders the error.)
```
**Report:** "D3 ok — 403 displayed" or what loaded instead.

### D4. Zero-answer submit

```
1. Sign back in as Student A1.
2. Start the Kinematics quiz. Don't touch any options. Don't flag.
3. Tap Submit → confirm modal: "You've answered 0/4." Tap Submit.
4. Result screen: 0/16 score, 0 correct, 0 wrong, 4 skipped.
5. No app crash, no error toast.
```
**Report:** "D4 ok — 0-answer submit graded as 0/16".

### D5. Auto-submit on timer expiry

(Quiz 1 has a 5-min timer. To test auto-submit faster, ask the user OR
seed a 1-min quiz via SQL OR just wait 5 mins.)

```
1. Start a fresh Kinematics attempt. Answer 1 question. Leave the screen
   in the foreground.
2. Wait until the timer hits 00:00.
3. The attempt auto-submits → result screen appears WITHOUT you
   tapping anything.
4. In Supabase Studio: select id, is_auto_submit, score from
   public.quiz_attempts where student_id = <A1's id> order by
   started_at desc limit 1; expect `is_auto_submit = true`.
```
**Report:** "D5 ok — auto-submit fires at 00:00".

### D6. Replay protection (re-submit blocked)

```
1. After any successful submit (e.g., from C12), the result screen is
   visible.
2. Background the app. Re-open.
3. Re-tap the quiz in library → intro → Start Quiz.
4. Expected: tapping Start Quiz does NOT create a new attempt (it should
   either re-show the submitted result OR start a fresh attempt — the
   intro screen handles this by routing to result if a submitted attempt
   exists, OR by creating a new attempt on retake).
5. Via PostgREST replay attempt (advanced — only if you have a curl
   client handy): re-call `POST /functions/v1/quiz-submit` with the
   same `attempt_id` → expect 409 "attempt already submitted".
   (Automated smoke already verified this.)
```
**Report:** "D6 ok — replay rejected or intro handles re-entry".

### D7. Practice Quizzes section reflects attempt count

```
1. After 2+ submitted attempts on Quiz 1, go to Library → Kinematics.
2. Practice Quizzes row "Kinematics — Easy 4" subtitle should now say
   something like "4 questions · 5 min · 2 attempts · Best 100%" (the
   exact text depends on the `useQuizDiscovery` template — confirm the
   attempts count is non-zero).
```
**Report:** "D7 ok — section shows attempt count".

---

## E. Teacher — KaTeX + write surface coverage (real device)

Sign in as the teacher.

### E1. Create a KaTeX-heavy question

```
1. Quizzes tab → New → fill scope (Kinematics + P6 Batch A).
2. Title = "KaTeX smoke".
3. + New question modal. Prompt:
      Evaluate $\int_0^\infty e^{-x^2}\,dx = \frac{\sqrt{\pi}}{2}$
4. Difficulty = Medium.
5. Options:
      A: $\sqrt{\pi}$
      B: $\frac{\sqrt{\pi}}{2}$  (mark correct)
      C: $\pi/4$
      D: $1$
6. Explanation: "Gaussian integral over $[0, \infty)$ is $\sqrt{\pi}/2$."
7. Save. Question row appears in the parent screen.
8. Add the quiz with this 1 question. Publish.
```
**Report:** "E1 ok — KaTeX quiz saved".

### E2. KaTeX renders on student attempt

```
1. Sign out → sign in as Student A1.
2. Library → Physics → Mechanics → Kinematics → "KaTeX smoke".
3. Start Quiz. The prompt renders the integral as TYPESET math (an
   actual ∫ symbol with super/subscripts and a real square root) —
   NOT as raw `\int_0^\infty` text.
4. Each option (B's $\sqrt{\pi}/2$, etc.) renders similarly. Tapping
   an option highlights the entire WebView panel BLUE.
5. (KaTeX is loaded from cdnjs — first-render takes 200–600ms. After,
   it's cached.)
```
**Report:** "E2 ok — math glyphs typeset correctly".

### E3. Single-answer enforcement (correct-option is radio)

> Questions are single-answer MCQ — `quiz-submit` credits exactly ONE correct
> option (`find((o) => o.is_correct)`). The editor enforces this so a teacher
> can't author a question the grader would mis-score. (Previously the editor
> allowed ticking multiple, which silently graded the 2nd+ "correct" option as
> wrong — fixed; the toggle is now single-select.)

```
1. Quizzes tab → New → scope (Kinematics + P6 Batch A) → Title "Single answer".
2. + New question. Type a prompt + fill option text A–D.
3. Tap option A's circle → it turns green with a white check.
4. Tap option B's circle → B turns green AND A's check CLEARS automatically.
5. Tap C → C green, B clears. There is NEVER more than one green at a time.
```
**Report:** "E3 ok — correct toggle is single-select" or "BUG — two greens
stayed ticked".

### E4. Cross-teacher quiz edit blocked

(Only meaningful if you have a 2nd teacher account. Skip if only 1
teacher in the seed.)

```
1. Sign in as a SECOND teacher (you'd need to bootstrap one — skip if
   only one teacher in your seed).
2. Quizzes tab → list shows ONLY their own quizzes (none of teacher 1's
   quizzes appear).
3. Direct URL to teacher 1's quiz id → form may load but Save returns
   RLS error 42501 (PostgREST UPDATE blocked by `quizzes_teacher_update`
   policy `created_by = current_app_user_id()`).
```
**Report:** "E4 ok" or "E4 skipped — single teacher in seed".

---

## F. SQL sanity (I've already verified these; redo only if curious)

Run in Supabase Studio → SQL Editor (project `orqwyazvcthgxoadfxfv`).

```sql
-- 7 Phase 6 tables created with the right column counts.
select table_name, count(*) as n_cols
from information_schema.columns
where table_schema = 'public'
  and table_name in ('questions','question_options','question_solutions',
                     'quizzes','quiz_questions','quiz_attempts','quiz_answers')
group by table_name order by table_name;
-- Expect:
--   question_options    7
--   question_solutions  4
--   questions           9
--   quiz_answers        5
--   quiz_attempts      13
--   quiz_questions      4
--   quizzes            16
```

```sql
-- All 7 tables have RLS enabled.
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('questions','question_options','question_solutions',
                  'quizzes','quiz_questions','quiz_attempts','quiz_answers')
order by relname;
-- All relrowsecurity = true.
```

```sql
-- 33 policies across the 7 tables.
select count(*) from pg_policies
where schemaname = 'public'
  and tablename in ('questions','question_options','question_solutions',
                    'quizzes','quiz_questions','quiz_attempts','quiz_answers');
-- Expect 33.
```

```sql
-- The exam-images Storage bucket exists, private, 5 MB, jpeg/png/webp.
select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'exam-images';
-- Expect public=false, file_size_limit=5242880,
-- allowed_mime_types={image/jpeg,image/png,image/webp}.
```

```sql
-- After completing §C12 with at least one successful submit, check the
-- audit_log for quiz_submitted.
select action, entity_id, actor_role, after_data->>'score' as score
from public.audit_log
where action = 'quiz_submitted'
order by occurred_at desc limit 5;
```

---

## G. Performance + cross-platform spot-checks (optional)

### G1. iOS — KaTeX cold-render time

```
1. Open a KaTeX-heavy quiz fresh (force-quit Expo Go first).
2. From `Start Quiz` tap to first math glyph appearing: should be
   under ~1.5 s on a wired-Wi-Fi cdnjs hit.
3. Navigate Next / Prev between Qs that all contain math. Each
   transition's KaTeX should render in <300ms (HTTP-cached after first).
```
**Report:** "G1: KaTeX first paint Ns" or "G1: skipped".

### G2. Android Redmi 8A cold start (hardware-blocked)

```
Same script as Phase 5 G1 — currently DEFERRED (no Redmi 8A available).
```
**Report:** "G2: skipped — no Redmi 8A".

### G3. Network airplane-mode mid-attempt

```
1. Mid-attempt, enable airplane mode.
2. Tap options + flag a question. Local state still updates (React
   `setState` works offline).
3. Auto-save fires every 500ms — the PostgREST upsert will silently
   fail. NO visible error toast on mobile (auto-save errors are
   swallowed in the hook).
4. Disable airplane mode. Tap another option. Next auto-save flushes
   the queued state to `quiz_answers`.
5. Submit. Server grades from the latest auto-saved answers.
```
**Report:** "G3 ok — recovers after airplane mode".

### G4. Pull-to-refresh on home + library

```
1. Drag down on Home → spinner appears, then state refreshes (Weak
   Topics + sessions + attendance %).
2. Drag down on Library subjects view → spinner; subjects re-fetched.
3. Drag down on Library topic view → spinner; quiz list re-fetched.
```
**Report:** "G4 ok — pull-to-refresh works at 3 levels".

---

## H. What I (the agent) already verified — DON'T re-test

Everything below was exercised by automated tests with passing assertions.

- **DB layer:** All 4 migrations applied. Tables, columns, FKs, CHECK
  constraints, indexes, triggers, RLS policies, storage bucket,
  `get_vault_secret` RPC grants — all queried via `information_schema` /
  `pg_policies` / `pg_indexes` / `pg_proc`.
- **All 5 edge fns:** deployed, ACTIVE, `verify_jwt = true`. Verified via
  `list_edge_functions`.
- **Auth gates:** every fn rejects anon (401), wrong role (403), invalid
  body (400).
- **`quiz-start`:** scope check (batch + course); idempotent reuse of
  in-flight attempt; sanitised payload (`is_correct` NEVER serialised —
  stringify+grep proves zero matches across 12 RLS scenarios); randomised
  question + option order snapshotted to `quiz_attempts.metadata`.
- **`quiz-submit`:** scoring correctness (4-question mixed input: +4 +4
  -1 +0 = 7/16); replay protection (second call → 409); `activity_days`
  upsert; audit `quiz_submitted` row written.
- **`quiz-attempt-result`:** 200 re-fetch; 409 on in-flight attempt;
  401 anon; correct images signed on every call.
- **`quiz-image-presign`:** 403 student; 200 teacher with signed upload
  URL; 400 on size > 5MB; 400 on disallowed mime type.
- **`quiz-admin-mutate`:** 403 student + teacher; 200 owner; audit row
  written for each op (publish/unpublish/archive/delete); 409 on
  `delete_question` while in use; 200 for `archive_question`.
- **RLS:**
  - Student in batch A cannot start a quiz scoped to batch B.
  - Student CANNOT SELECT `public.questions` directly (returns `[]`).
  - Student CANNOT SELECT `public.question_options` (returns `[]`).
  - Student CANNOT SELECT `public.question_solutions` (returns `[]`).
  - Student CAN SELECT a published-in-scope quiz.
  - Student CANNOT see a quiz from another course.
  - Student CANNOT SELECT another student's `quiz_attempts`.
  - Teacher CAN SELECT every question (for the bank picker).
  - Teacher who owns a quiz CAN update it; non-owner CANNOT.
  - Student CAN upsert `quiz_answers` for own in-flight attempt.
  - Student CANNOT upsert `quiz_answers` after submit (WITH CHECK fails).
  - `quiz-start` response stringify+grep finds zero `"is_correct"`.
- **Pure helpers (27 unit assertions):** `gradeAnswer` (4 cases),
  `gradeAttempt` (mixed 4-q), `containsMath` (7 cases including dollar-
  amount negative), `shuffleStable` (no-mutate + same-elements +
  deterministic with fixed rng), `reconcileOrder` (subset, removed,
  none-saved, empty-canonical).
- **TypeScript:** every workspace typechecks. ESLint clean.
- **Mobile jest:** 53/53 across 6 suites.
- **Security advisor:** only the long-standing Phase-1
  `auth_leaked_password_protection` warning remains (unrelated to Phase 6).

---

## I. Report-back format

Quick list per section. For each subsection just write `OK`, `OK — note: <x>`,
or `FAIL — <one-line cause + what you saw>`.

```
A1 ok
A2 ok — pills correct
A3 ok
A4 ok — pill + audit flipped
A5 ok
A6 ok — CSV header matches
A7 ok
A8 ok
A9 ok — disabled
A10 skipped

B1 ok — 8 tabs visible
B2 ok
B3 ok
B4 ok
B5 ok
B6 ok — alerts shown
B7 ok
B8 ok
B9 ok
B10 ok

C1 ok
C2 ok
C3 ok
C4 ok — timer counts down 1Hz
C5 ok — math glyphs (or: skipped, no math prompt)
C6 ok
C7 ok
C8 ok
C9 ok
C10 ok
C11 ok
C12 ok — score = 12/16, 75%
C13 ok
C14 ok
C15 ok — Kinematics 0% surfaced
C16 ok — cleared at 100%

D1 ok (or skipped)
D2 ok
D3 ok — 403 shown
D4 ok — 0/16 graded
D5 ok — auto-submit at 00:00
D6 ok
D7 ok — attempt count = 2

E1 ok
E2 ok
E3 ok — A correct, B wrong (or whatever you see)
E4 ok (or skipped)

G1: KaTeX first paint 1.2s
G2: skipped
G3: ok
G4: ok
```

Anything that **fails** — paste the step + screenshot if visual + the
relevant Metro / Vercel / Supabase Edge-fn log line. I'll diagnose and
patch before we move further.
