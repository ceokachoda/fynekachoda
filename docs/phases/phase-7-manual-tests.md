# Phase 7 — Manual Test Plan (Visual + Real-Device only)

> **Scope:** this doc covers ONLY what an automated test cannot do — real
> browser rendering, real device interactions, server-anchored timer UX,
> tab-switch banner visibility, AppState wiring, native pickers, locked-
> down attempt feel, and the visual no-`correct_option_id`-leak check via
> the network inspector. Every functional/data behaviour has been
> auto-verified by me on this dev project (`orqwyazvcthgxoadfxfv`) — see
> §H.
>
> **DO NOT skip sections.** Phase 7 is CODE-COMPLETE but has had ZERO
> human-in-the-loop testing. Server-time enforcement is critical here —
> bugs in the timer, the tab-switch counter, or the regrade fn can let
> students cheat or cause grade disputes. Treat every section as a fresh
> bug hunt.

---

## 0. One-time setup

### 0.1 Fresh fixtures

```
pnpm seed:exam-manual-test --reset
```

The `--reset` wipes prior `p7-*` users + `P7_TEST_*` courses before
reseeding. (First-ever run: the flag is harmless, just a no-op.)

Copy the printed block to a scratch file. You'll need:
- **Course id** + topic id (`Kinematics`)
- **Batch A id** + **Batch B id**
- **Teacher** email + initial password (`p7-teach-<ts>@…`)
- **Student A1** + **Student A2** (Batch A) email + password
- **Student B1** (Batch B) email + password
- **Exam 1 id** — "Mechanics Live <ts>" — published, batch A, 5 questions,
  30 min, **manual release**, starts 30s before seed time (LIVE NOW)
- **Exam 2 id** — "Instant Reveal <ts>" — published, batch A, 2 questions,
  5 min, **instant release**, starts 60s before seed time (LIVE NOW)
- **Exam 3 id** — "Scheduled Tomorrow <ts>" — published, batch A, 5
  questions, 60 min, manual release, starts +24h
- A pre-seeded offline test score: student A1's "Weekly Paper Test <ts>"
  on today's date, 72/100.

All four accounts have `must_change_password = false`.

**Time pressure:** Exam 1 and Exam 2 are LIVE for only 30 minutes and 5
minutes respectively from the seed instant. If you take too long between
seed and §C, re-seed with `--reset` to get a fresh time window. Exam 3
is always available for the "scheduled" UX in §C2.

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

Phase 7 adds 4 new top-level routes (`exam/[id]`, `exam-builder/[examId]`,
`exam-results/[examId]`, `offline-scores`), 1 new teacher tab
(`(teacher)/exams`), a new Exams section on the student home dashboard,
and a new `TabSwitchBanner` component. Hot-reload **cannot** propagate
route-tree changes. Every test session:

```
1. Ctrl+C in Metro terminal.
2. Force-quit Expo Go (iOS: swipe Expo Go card UP. Android: swipe away.)
3. pnpm dev:mobile -- --clear     ← the wrapper, with --clear.
4. Open Expo Go from the HOME-SCREEN icon (not recents).
5. Scan the QR.
6. Metro log MUST say "(NNNN modules)" with N in thousands.
   If it says "(1 module)" the cache didn't clear — go back to step 1.
```

### 0.4 What's NEW vs Phase 6

Quick mental map of what to look for that didn't exist before:
- **Admin sidebar:** two new entries — "Exams" and "Offline scores".
- **Teacher tab bar:** a new "Exams" tab (8 tabs total — visually
  crowded on narrow phones, that's acceptable; Phase 8 may consolidate).
- **Teacher Exams tab:** a small "Offline" pill in the header that
  opens the top-level `offline-scores` route.
- **Student home dashboard:** new "Exams" section ABOVE Weak Topics,
  showing up to 5 visible exams with countdown / live / submitted /
  released status.
- **Four new full-screen routes:** all top-level Stack (no tab bar):
  - `exam/[id]` — 5-stage attempt UI (pre / attempt / submitted / result / solution)
  - `exam-builder/[examId]` — teacher builder
  - `exam-results/[examId]` — roster + question analysis + regrade
  - `offline-scores` — paper-test entry

### 0.5 Verify edge fns are deployed

```
1. In Supabase Studio → Edge Functions tab.
2. Confirm these 9 functions exist + are ACTIVE:
      server-time            verify_jwt = false  (NB: only this one)
      exam-start             verify_jwt = true
      exam-tab-switch        verify_jwt = true
      exam-submit            verify_jwt = true
      exam-release-results   verify_jwt = true
      exam-regrade           verify_jwt = true
      offline-score-upsert   verify_jwt = true
      exam-attempt-result    verify_jwt = true
      exam-admin-mutate      verify_jwt = true
```
**Report:** "0.5 ok" or which fn is missing.

---

## A. Admin `/exams` + `/offline-scores` — visual layout (browser)

Sign in as the owner. You're verifying the page LOOKS right and clicks
DO things.

### A1. Nav items present + page loads

```
1. Open the admin URL. Sign in.
2. Left sidebar should show THIRTEEN entries now (in order):
      Overview · Students · Teachers · Admins (Phase 11) · Batches
      Courses · Attendance · Content · Quizzes · Exams ·
      Offline scores · Question bank · Audit log (Phase 11)
3. "Exams" and "Offline scores" are real blue links (not greyed).
4. Click "Exams". URL goes to /exams.
```
**Report:** "A1 ok — 13 nav entries" or which is missing.

### A2. /exams page layout

```
1. Title: "Exams"
2. Subtitle: "Moderate graded exams · publish · release · regrade · delete."
3. Filter card with 4 controls + Export button:
      Course | Batch | Status (All/Draft/Scheduled/Live/Closed/Released) |
      Search box | [Export CSV]
4. Table header reads:
      Title · Batch · Course · Starts (IST) · Marks · Q · Subm/Tot · Status · Actions
5. The 3 seeded rows appear (filter Course = P7_TEST_<ts> if list is
   long):
      Mechanics Live <ts>      P7 Batch A  …  +4/-1/0  5  0/0  Live (rose)
      Instant Reveal <ts>      P7 Batch A  …  +4/-1/0  2  0/0  Live (rose)
      Scheduled Tomorrow <ts>  P7 Batch A  …  +4/-1/0  5  0/0  Scheduled (blue)
6. Status pill colors:
      Draft     = slate grey
      Scheduled = blue
      Live      = rose / red
      Closed    = amber  (after the duration window passes, results not
                          yet released)
      Released  = emerald green
7. The "Starts (IST)" column shows IST timestamps (not UTC).
```
**Report:** "A2 ok — pills colored + IST shown" or what's wrong.

### A3. Filter + search — UI reaction only

```
1. Status = "Live" → 2 rows (Exam 1 + Exam 2).
2. Status = "Scheduled" → 1 row (Exam 3).
3. Status = "Released" → 0 rows (none released yet).
4. Clear Status. Batch = P7 Batch A → all 3 rows (they're all batch A).
5. Search "Instant" → 1 row. Clear search.
```
**Report:** "A3 ok".

### A4. Force-release + Un-release (admin override)

```
1. Find Exam 1 (Mechanics Live …). Click "Force release" in the actions.
2. Page reloads. Status pill flips to EMERALD "Released" + button text
   flips to "Un-release".
3. Audit row check (Supabase Studio → SQL Editor):
      select action, entity_id, occurred_at
      from public.audit_log
      where action = 'exam_results_force_released'
      order by occurred_at desc limit 1;
   Most recent row should match Exam 1's id.
4. Click "Un-release" on Exam 1.
5. Status returns to "Live" or "Closed" (depends on time elapsed).
   Button text returns to "Force release". Audit row
   `exam_results_unreleased` appears.
```
**Report:** "A4 ok — both directions work + audit logged".

### A5. Publish / Unpublish toggle (admin override)

```
1. Find Exam 3 (Scheduled Tomorrow). Status pill "Scheduled".
2. Click "Unpublish". Status flips to slate "Draft".
3. Confirm:
      select is_published from public.exams where id = '<exam3>';
   Expected: false. Audit row `exam_unpublish` exists.
4. Click "Publish". Status returns to "Scheduled" (because starts_at is
   in the future).
```
**Report:** "A5 ok".

### A6. Delete confirmation modal (do NOT confirm)

```
1. Pick any exam row. Click "Delete".
2. Black-overlay modal pops up:
      Title:   "Delete exam?"
      Body:    Mentions title and "all N attempts" + "audit log first" +
                "This cannot be undone."
      Buttons: Cancel (grey) + Delete permanently (red).
3. Click Cancel → modal closes, row stays.
4. Click backdrop → modal closes.
5. DO NOT actually delete — you need the exams for §C.
```
**Report:** "A6 ok — modal opens + cancels".

### A7. CSV export — /exams

```
1. With no filters, click "Export CSV".
2. Downloads `exams-2026-05-19.csv`.
3. Open in Excel or text editor.
4. Verify header row:
      id,title,course,batch,starts_at_ist,duration_min,marks_correct,
      marks_wrong,marks_skip,result_release,is_published,
      results_released_at,question_count,submitted_count,
      attempt_count,created_by
5. Verify the `starts_at_ist` column is IST (e.g., `19/05/2026, 11:42`,
   NOT a UTC timestamp).
```
**Report:** "A7 ok — header + IST".

### A8. /offline-scores page layout

```
1. Click "Offline scores" in the sidebar.
2. Title: "Offline scores"
3. Subtitle mentions paper-test scores across batches.
4. Filter card: Batch / Search / Export CSV.
5. Table header reads:
      Test · Batch · Course · Subject · Student · Score · Entered · Actions
6. ONE seeded row visible:
      Weekly Paper Test <ts>  /  P7 Batch A  /  …  /  —  /
      P7 Student A1 <ts>  /  72/100  /  P7 Teacher <ts>  /  19/05/2026, …
```
**Report:** "A8 ok — 1 row visible".

### A9. /offline-scores filter + CSV

```
1. Filter Batch = P7 Batch A → 1 row stays. Other batches = 0 rows.
2. Click "Export CSV" → downloads `offline-scores-2026-05-19.csv`.
3. Verify header:
      id,test_name,test_date,batch,course,subject,student,score,
      max_score,notes,entered_by,entered_at_ist
4. The `entered_at_ist` column is IST.
```
**Report:** "A9 ok".

### A10. Delete offline score (do NOT confirm)

```
1. Click "Delete" on the offline row.
2. Modal: "Delete offline score?" with student name + score on the
   test + date. Cancel + Delete permanently buttons.
3. Cancel → modal closes, row stays.
```
**Report:** "A10 ok — modal opens + cancels".

---

## B. Teacher mobile — exam builder + offline scores (real device)

Sign in as the teacher after §0.3 clean restart.

### B1. Tab bar shows 8 tabs

```
1. Bottom tab bar (left → right):
      Home · Scan · Classes · Library · Quizzes · Exams · Batch · Profile
   The new "Exams" tab has a clipboard-check icon.
2. On narrow phones the labels may compress or scroll horizontally —
   that's acceptable as long as all 8 icons are visible.
```
**Report:** "B1 ok — 8 tabs" or which is missing.

### B2. Exams tab — list view

```
1. Tap "Exams" tab.
2. Header: "Exams" + 2 pills top-right:
      [Offline]  (white border)
      [+ New]    (blue)
3. Below header: a list of 3 rows (the seeded exams, newest first by
   starts_at desc):
      Scheduled Tomorrow <ts>   P7 Batch A · Tue 20 May 11:42 · 60 min · Scheduled (blue) · 5 Qs · 0 attempts
      Mechanics Live <ts>       P7 Batch A · Mon 19 May 11:41 · 30 min · Live now (red) · 5 Qs · 0 attempts
      Instant Reveal <ts>       P7 Batch A · Mon 19 May 11:41 ·  5 min · Live now (red) · 2 Qs · 0 attempts
4. Each row has:
      a. Blue file-check icon in a rounded square (left)
      b. Title (bold) + subtitle (batch + IST time + duration)
      c. Status line in colour (Draft / Scheduled / Live now / Closed / Released)
      d. A "Results · Locked" or "Results · Released" pill at the bottom
5. Tap any exam row → opens exam-builder. Tap back → returns.
6. Tap the "Results" pill → opens exam-results screen for that exam.
```
**Report:** "B2 ok — 3 rows, status colors correct, pills navigate".

### B3. + New exam-builder screen

```
1. Tap "+ New" (top-right).
2. Screen replaces tab bar (top-level Stack route).
3. Header: "New Exam" with back chevron on the left.
4. Card 1 "Basics":
      Title (text input, empty)
      Batch (picker, "Choose batch")
      Starts (picker, shows next 30-min-rounded slot in IST)
      Duration (picker, "60 min")
5. Card 2 "Marking & options":
      Row of 3 inputs: + Correct (4) / − Wrong (-1) / Skip (0)
      Switch: Randomize question order (ON)
      Switch: Randomize option order (ON)
      Row "Result release" with picker (Manual selected)
6. Card 3 "Questions · 0":
      Italic placeholder "No questions yet. Add some from the bank below."
      Blue button "Add from Question Bank"
      White button "+ New Question (via quiz builder)"
7. Bottom: grey "Save Draft" + blue "Publish" buttons.
8. Both Save buttons are GREY-DISABLED if Title is empty.
```
**Report:** "B3 ok — form renders + buttons disabled when empty".

### B4. Batch picker (RLS-scoped)

```
1. Tap the Batch row.
2. Modal "Choose batch" slides up listing ONLY the batches you teach
   (P7 Batch A · P7_TEST_<ts>). You should NOT see batches from other
   courses or batches you don't teach.
3. Tap P7 Batch A.
4. Row updates to show "P7 Batch A · P7_TEST_<ts>".
```
**Report:** "B4 ok — only assigned batches visible".

### B5. Starts picker — date + time grid

```
1. Tap the Starts row.
2. Modal "Pick start date + time" slides up.
3. Two horizontal scrolls:
      a. Date strip: today + next 30 days. Today is auto-selected.
      b. Time grid: 96 quarter-hour slots in a wrap layout (00:00, 00:15,
         …, 23:45). The next-30-min-rounded slot is auto-selected.
4. Tap a future date (e.g., 3 days from now). Strip updates highlight.
5. Tap a time slot (e.g., 14:30). Time chip highlights.
6. Tap "Use this time" (blue) at the bottom.
7. Modal closes. The Starts row now reads
   "<weekday> DD MMM HH:MM" in IST.
```
**Report:** "B5 ok — date + time picker works".

### B6. Duration + Result release pickers

```
1. Tap Duration. Modal lists: 15 / 30 / 45 / 60 / 90 / 120 / 180 minutes.
2. Pick "90 minutes". Row updates.
3. Tap Result release. Modal lists 2 options:
      Manual (teacher releases later)
      Instant (release on submit)
4. Pick Instant. Row updates.
```
**Report:** "B6 ok — both pickers work".

### B7. Add from Question Bank sheet

```
1. Tap "Add from Question Bank" (blue) in Card 3.
2. Modal slides up full-screen: "Question Bank" with close X + search bar.
3. List shows the 5 seeded questions (Q1–Q5) with truncated prompts.
4. Type "ball" in search → list narrows to Q2 ("A ball is dropped from
   rest…").
5. Clear search.
6. Tap Q1 → green "Added" pill appears on the row; the row dims.
7. Tap Q2 + Q3 likewise.
8. Tap close X (top-left). Modal closes.
9. Back on the builder: Card 3 header now reads "Questions · 3". The
   three added questions appear as rows with prompt + ↑ / ↓ / trash
   buttons.
```
**Report:** "B7 ok — 3 questions added".

### B8. Reorder + remove

```
1. Tap "↑" on the middle question row → swaps with the row above.
2. Tap "↓" on the new top row → swaps back down.
3. Tap the red trash icon on the bottom row → row vanishes. Header
   now reads "Questions · 2".
```
**Report:** "B8 ok — reorder + remove".

### B9. Save Draft + re-edit

```
1. Set title = "Manual test exam". Tap "Save Draft".
2. Returns to Exams tab. New row appears with status "Draft" (slate).
3. Tap the new row → exam-builder opens with everything pre-filled
   (title, batch, starts, duration, marks, randomize switches, result
   release, 2 questions in the saved order).
```
**Report:** "B9 ok — draft persists + reloads".

### B10. Publish (with future starts_at)

```
1. From the re-opened draft, scroll to the bottom.
2. Tap "Publish" (blue).
3. Returns to Exams tab. Row status flips to "Scheduled" (blue).
4. Admin /exams page shows the same exam with EMERALD "Published"
   pill (in admin terminology). Status badge may also show "Scheduled".
```
**Report:** "B10 ok — published".

### B11. Validation guards on Publish

```
1. Create another new exam. Leave title empty. Tap Publish.
2. Alert "Missing fields — Add title + batch + start time + duration
   before saving."
3. Add title + batch + start, but leave Questions empty. Tap Publish.
4. Alert "No questions — Add at least one question before publishing."
5. Save Draft on empty-title also fires the missing-fields alert.
```
**Report:** "B11 ok — validation fires".

### B12. Offline scores screen — from Exams tab header

```
1. Back to Exams tab. Tap the "Offline" pill (top-right, next to "+ New").
2. Opens top-level `offline-scores` route. Header: "Offline Test Scores"
   + back chevron.
3. Above the keyboard / above the fold:
      Card with Batch picker (Choose batch), Test name (empty input),
      Date row (today by default), Max score (default "100"),
      Subject picker ("None", disabled until batch picked).
4. Below the card: italic placeholder "Pick a batch above to load
   its roster."
5. Bottom: blue "Save All" button DISABLED.
```
**Report:** "B12 ok — screen renders with disabled button".

### B13. Pick batch → roster loads + existing score pre-fills

```
1. Tap Batch picker → modal lists P7 Batch A. Tap it.
2. The Subject picker enables.
3. Below the card: "Roster · 2 student(s)" header + a list of 2 rows:
      P7 Student A1 <ts>    [empty input] / 100
      P7 Student A2 <ts>    [empty input] / 100
4. Now type the SAME test name and date as the seed
   ("Weekly Paper Test <ts>" + today). Subject = "None".
5. The seeded score should pre-populate on student A1's row as "72"
   with a small green caption "Previous: 72" below.
6. Student A2's row stays empty.
```
**Report:** "B13 ok — existing score pre-fills" or what failed.

### B14. Enter scores + Save All — insert vs update

```
1. Change the test name to "Manual Practice Test <today>" (a new test
   to avoid touching the seeded one).
2. Enter score 45 for A1, 38 for A2.
3. Tap "Save All".
4. Alert: "Saved — 2 new, 0 updated."
5. Tap Save All again without changes → "Saved — 0 new, 2 updated."
   (Because the same natural key now exists, second save is upsert →
   updated count = 2.)
6. Change A1 to 50. Tap Save All → "Saved — 0 new, 2 updated." (One
   row's score actually changed; the upsert always reports the same
   updated count for both rows because both exist.)
7. Check admin /offline-scores page → 3 rows visible (seeded + your
   new test for A1 + A2).
```
**Report:** "B14 ok — insert + update counts work".

### B15. Out-of-range rejection (client-side)

```
1. Re-open offline-scores. Pick Batch A, type any test name + date,
   Max score = 50.
2. Enter score 75 for A1.
3. Tap "Save All".
4. Alert "Out of range — A score for <A1 name> is outside [0, 50]."
   (Client-side check; the edge fn also validates server-side as a
   backup.)
```
**Report:** "B15 ok — client-side range check fires".

---

## C. Student mobile — happy path (real device)

Sign out → sign in as **Student A1** (Batch A).

### C1. Home dashboard surfaces Exams section

```
1. Lands on Student Home.
2. New "Exams" section visible (with a clipboard-check icon), ABOVE
   any "Weak topics" section.
3. The section lists up to 5 exams visible to Student A1:
      Scheduled Tomorrow <ts>   IST date · 60 min · Scheduled (slate)
      Mechanics Live <ts>       IST date · 30 min · Live now (red)
      Instant Reveal <ts>       IST date ·  5 min · Live now (red)
4. Each row has a chevron + blue icon.
5. Tap "Mechanics Live <ts>" → opens `/exam/<id>` pre-attempt screen.
```
**Report:** "C1 ok — Exams section visible + 3 rows".

### C2. Pre-attempt for a SCHEDULED exam

```
1. Back to home. Tap "Scheduled Tomorrow <ts>".
2. Pre-attempt screen:
      Header: close X (top-left)
      Title: "Scheduled Tomorrow <ts>"
      Subtitle: "<IST date> · 60 min · 5 questions"
      Rules card with 4 bullets (server clock decides / leaving the app
                                  is logged / auto-saves / results released
                                  by your teacher)
      Center card: "Starts in" with a live countdown that DECREASES
                   every second (e.g., "23h 59m 30s")
      Disabled grey "Enter Exam" button at the bottom of the card.
3. Confirm the countdown actually ticks (wait 5s, the seconds value
   drops by 5).
```
**Report:** "C2 ok — countdown ticks, CTA disabled".

### C3. Pre-attempt for a LIVE exam

```
1. Back. Tap "Mechanics Live <ts>".
2. Pre-attempt:
      Header: close X
      Title + IST date / 30 min / 5 questions
      Rules card (same as C2)
      Center card: red "● Live now" dot + label
                   "Window closes in <countdown>"
                   BLUE "Enter Exam" button (enabled)
```
**Report:** "C3 ok — Live now CTA enabled".

### C4. Tap Enter Exam → locked-down attempt loads

```
1. Tap "Enter Exam".
2. Loading spinner briefly, then attempt UI loads in <2s on a mid-tier
   phone.
3. Layout:
      Top bar: close X (left) · title (centered) · TIMER PILL (right)
      Timer pill reads "30:00" (or whatever the duration is) and DECREASES
      by 1 every second.
4. Question card shows "Q 1 / 5" + prompt text. Below: 4 option rows
   with A/B/C/D circles + text.
5. Bottom: flag pill (left) + Prev/Next pills + Q-grid (horizontally
   scrollable pills 1..5) + Submit pill (only on Q5).
6. NO bottom tab bar visible (it's a top-level Stack route).
7. NO animations or visual effects (the screen is intentionally
   utilitarian per the CLAUDE.md exam-screen perf rule).
```
**Report:** "C4 ok — locked-down UI renders + timer ticks".

### C5. Server-anchored timer holds across app background

```
1. Note the current timer value (e.g., "29:55").
2. Background the app (swipe up to home on iOS / Home button on Android).
3. Wait 30 seconds.
4. Re-open Expo Go → exam attempt still on the same Q.
5. Timer pill now reads approximately the original value MINUS 30
   seconds (e.g., "29:25", not "29:55"). The countdown is anchored on
   the server-issued `deadline_at`, NOT on a local interval that paused
   while backgrounded.
```
**Report:** "C5 ok — timer survived background pause".

### C6. Tab-switch banner appears

```
1. Note: the moment you backgrounded the app in C5 was a tab-switch
   event. So a yellow/amber banner SHOULD already be visible at the
   top of the question scroll area now reading:
      "⚠ You left the app. Switches: 1"
2. Background the app + return. Banner now reads "Switches: 2".
3. Background + return 1 more time. Banner now reads "Switches: 3 ·
   Further switches may be reviewed by your teacher." and the banner
   colour turns RED (severe).
```
**Report:** "C6 ok — banner appears at 1, escalates at 3" or what failed.

### C7. Answer questions + nav

```
1. Tap option A on Q1. A circle turns BLUE. Q-grid pill 1 turns GREEN.
2. Tap "Next" pill → Q2 appears.
3. Tap option B on Q2. Pill 2 turns GREEN.
4. Tap the flag pill on Q2 → Q-grid pill 2 turns YELLOW (flagged_unanswered
   if you cleared the option) or composite colour (flagged + answered).
5. Tap "Prev" → Q1 visible, selection still ticked.
6. Tap Q-grid pill 4 → jumps to Q4.
7. Answer Q3 + Q4. All 4 pills GREEN (assuming you cleared Q2's flag or
   the colour palette differentiates).
```
**Report:** "C7 ok — nav + answer + flag all work".

### C8. Submit confirmation modal

```
1. Tap "Submit" pill (visible on Q5 OR you can submit early from any
   Q via the same pill at the bottom of the Q-grid — depends on the
   build, just find the green pill).
2. Modal pops up: "Submit exam?"
3. Body: "You've answered N/5{, flagged M}. This cannot be undone."
4. Buttons: Cancel (grey text) + Submit (green pill).
5. Tap Cancel → modal closes, no submit.
6. Re-open + tap Submit. Spinner briefly.
```
**Report:** "C8 ok — modal opens + cancel works".

### C9. Submitted (manual release) — waiting for teacher

```
1. After tapping Submit on Exam 1 (which is `result_release='manual'`):
2. Stage transitions to "Submitted":
      Header: close X
      Big text "Submitted" centred near the top
      Subtitle "Results will be released by your teacher."
      A grey "Check release status" pill below
3. Tap the "Check release status" pill — no change yet (teacher hasn't
   released).
```
**Report:** "C9 ok — submitted screen shown".

### C10. Result screen for INSTANT release (Exam 2)

```
1. Back to dashboard. Tap "Instant Reveal <ts>".
2. Pre-attempt → "Enter Exam" → attempt UI.
3. Answer both questions (don't need to be right). Submit.
4. Because Exam 2 is `result_release='instant'`, the submit response
   carries the score and the stage jumps STRAIGHT to "Result" (not
   "Submitted"):
      Big "X / 8" + percentage
      Stat row: Correct (green) / Wrong (red) / Skipped (grey)
5. Below: blue "View Solutions" button + grey "Back" button.
```
**Report:** "C10 ok — instant result shown".

### C11. Solutions screen

```
1. From Exam 2 result, tap "View Solutions".
2. Header: "Solutions" + back chevron.
3. Scroll of per-question cards:
      Q index + total
      Prompt
      All options. CORRECT option highlighted GREEN with green check.
                   YOUR option highlighted BLUE (if matched correct) or
                   RED with X (if mismatched).
      Explanation panel below.
4. Back chevron → returns to Result screen.
```
**Report:** "C11 ok — solutions render with green/red highlights".

### C12. Re-open submitted Exam 1 — still locked

```
1. Tap close X to return to home.
2. Tap Exam 1 (Mechanics Live …) again.
3. Goes STRAIGHT to the "Submitted" stage (no intro, no attempt) —
   because the attempt is submitted but results aren't released yet.
4. The "Check release status" pill still says "Still locked" if you
   tap it (until teacher releases — see §E).
```
**Report:** "C12 ok — re-open lands on Submitted, not a fresh attempt".

---

## D. Student edge cases (real device)

### D1. No-leak visual check (Safari dev tools — advanced)

```
1. With Expo iOS dev menu enabled, connect Safari → Develop →
   <your iPhone> → JSContext.
2. In an active attempt (start a fresh Exam 2 attempt to be safe),
   open Network tab.
3. Find the `/functions/v1/exam-start` request → Response tab.
4. Search the JSON body for the substrings `"correct_option_id"` and
   `"is_correct"`.
5. Expected: ZERO matches for either across the entire response body.
   (Automated smoke T10 already verified this — this is just for
   visual trust.)
```
**Report:** "D1 ok — no leak" OR "D1 skipped — no Safari dev tools"
OR "D1 FAIL — found `<field>` at `<path>`".

### D2. Cross-batch: Student B1 sees NO Phase 7 exams

```
1. Sign out → sign in as Student B1 (Batch B).
2. Home dashboard. The "Exams" section is ABSENT (Student B1's batch
   has no published exams).
3. Try direct URL via Expo Go dev menu:
   `exp://<lan-ip>:8081/--/exam/<Exam 1 id>` (paste in Reload menu or
   send via Notes app).
4. Routes to the pre-attempt screen. Header shows "Exam not visible
   to you." in red. Back button works.
   (Server's `exam-start` will return 403 if the student taps "Enter
   Exam" — but the pre-attempt loads via PostgREST which RLS-filters
   to 0 rows, so the screen shows the error before letting them try.)
```
**Report:** "D2 ok — B1 sees no exams + 403 on direct URL".

### D3. Try to enter SCHEDULED exam before start

```
1. As Student A1, home → tap Exam 3 (Scheduled Tomorrow).
2. Pre-attempt countdown visible.
3. The "Enter Exam" button is DISABLED (grey).
4. (Server-side, even if a student tried to call `exam-start` for a
   future exam, it returns 400 with "exam has not started yet" + the
   `seconds_until_start` — verified by smoke. Pre-attempt UI doesn't
   even attempt the call.)
```
**Report:** "D3 ok — Enter Exam disabled pre-start".

### D4. Auto-submit at timer expiry

```
1. As A1, start a fresh attempt on a SHORT exam — use Exam 2 (5 min)
   for a faster test.
2. Answer 1 of 2 questions. Leave the screen in the foreground (don't
   background).
3. Wait until the timer hits 00:00.
4. The attempt AUTO-SUBMITS without you tapping anything → stage
   transitions to Result (because Exam 2 is instant-release).
5. In Supabase Studio:
      select id, auto_submitted, score
      from public.exam_attempts
      where student_id = <A1 id> and exam_id = '<exam2>'
      order by started_at desc limit 1;
   Expected: `auto_submitted = true`.
6. (If the exam was manual-release, you'd land on "Submitted" instead.)
```
**Report:** "D4 ok — auto-submit at 00:00".

### D5. Replay protection (re-submit blocked)

```
1. After any successful submit on Exam 2 (which is instant-release),
   close the screen and re-tap Exam 2 from home.
2. Goes straight to Result screen (no fresh attempt).
3. Server-side guarantee: a second `POST /exam-submit` for the same
   attempt_id returns 409. (Smoke already verified.) The UI never
   gets there because it sees the submitted attempt in pre.
```
**Report:** "D5 ok — re-entry lands on result, no new attempt".

### D6. Server-time enforcement vs device clock

(Optional / advanced — needs willingness to mess with your phone clock.)

```
1. As A1, start a fresh Exam 1 attempt (Mechanics Live — 30 min).
2. Note the timer value (e.g., 29:50).
3. Go to phone Settings → General → Date & Time → disable auto-time,
   set time forward by 1 hour.
4. Return to Expo Go.
5. Timer pill on the exam still shows the server-anchored countdown
   (≈29:00 after about a minute of you fiddling). It does NOT jump
   forward 1 hour to "expired".
6. Try to submit — server `exam-submit` accepts the answer (within
   the real window). If you'd waited past the real 30-min window even
   after un-cheating the clock, the server would have flagged
   `auto_submitted=true` regardless.
7. RESET your phone clock to auto-time before continuing.
```
**Report:** "D6 ok — server clock wins" OR "D6 skipped — didn't risk it".

### D7. Mid-attempt network drop

```
1. Start a fresh attempt on any LIVE exam.
2. Answer 1-2 questions (auto-save should land each within ~500ms).
3. Enable airplane mode.
4. Answer more questions + flag. Local state still updates.
5. Auto-save fires silently — the PostgREST upsert fails, retried
   in the next debounce cycle (errors are swallowed in the hook).
6. Disable airplane mode. Tap another option. Next auto-save flushes
   the queued state.
7. Submit. Server grades from the latest synced answers.
```
**Report:** "D7 ok — recovers after airplane mode".

---

## E. Teacher release-results + regrade (real device)

Sign in as the teacher.

### E1. Open exam-results board for Exam 1

```
1. Exams tab → tap "Results · Locked" pill on Exam 1's row (or tap
   the row to open builder, then close to come back; alternatively
   directly tap the pill).
2. Top-level `exam-results/<id>` route opens. Layout:
      Header: back chevron + title
      Info card:
         "N attempts · M submitted · 5 questions"
         An amber/emerald status dot + label:
            "Results NOT released" (amber) if not yet released
            "Results released <IST datetime>" (emerald) if released
         BLUE "Release Results to Students" button (visible only when
         not released).
      Roster section header.
      Per-question analysis section header.
3. Roster shows submitted attempts (you should have at least 1 from §C).
   Each row: avatar circle + student name + count breakdown (✓ X ✗ Y
   skipped) + auto-submit / tab-switch badges + score X/Y + percentage.
4. Question analysis shows 5 rows (one per Q): Q index + prompt +
   progress bar (% correct) + "Regrade" button on the right.
5. Tab-switch badge appears only if tab_switch_count > 0 (yellow if 1-2,
   red if 3+ per the smoke). The student you backgrounded the app for
   in §C6 should show "tab×3" badge in red.
```
**Report:** "E1 ok — board renders" or what's missing.

### E2. Release Results

```
1. Tap "Release Results to Students" (blue).
2. Confirm alert pops:
      Title: "Release results?"
      Body: "Students will be able to view scores + solutions immediately.
             This cannot be undone (admins can un-release)."
      Buttons: Cancel + Release (red).
3. Tap Release.
4. Page refreshes. Status dot flips to EMERALD with "Results released
   <IST datetime>". The blue "Release Results" button DISAPPEARS.
5. Audit row check:
      select action, entity_id, occurred_at
      from public.audit_log
      where action = 'exam_results_released'
      order by occurred_at desc limit 1;
   Most recent matches Exam 1's id.
6. Sign out → sign in as Student A1 → home → tap Exam 1.
7. NOW lands on Result screen (not Submitted) with score breakdown.
   Tap "View Solutions" → solution cards render.
```
**Report:** "E2 ok — release flips status + students see result".

### E3. Regrade — change_correct

```
1. Sign back in as teacher. Open Exam 1 → Results.
2. On the question analysis section, find a question. Tap "Regrade".
3. Modal slides up: "Regrade" header + back chevron.
4. Body:
      Prompt (truncated)
      "Choose action" card with 3 radio rows:
         ◉ Change correct option   (Pick a new correct option …)
         ◯ Mark no correct         (Everyone gets marks_skip …)
         ◯ Mark all correct        (Everyone gets full marks …)
      "Pick new correct" card with the 4 option radios (the current
         correct option labelled "PREV" in green).
      Reason textarea (multi-line, required).
      Yellow warning panel "This recomputes every submitted attempt's
                            score. Original key + per-attempt scores
                            saved to audit_log."
      Red "Apply Regrade" button at the bottom.
5. Tap a DIFFERENT option as the new correct.
6. Type reason "Test regrade — change correct".
7. Tap "Apply Regrade".
8. Alert: "Regrade complete — N attempt(s) recomputed." (N matches
   submitted attempt count.)
9. Page refreshes. Roster scores visibly change (the affected student
   may go from correct to wrong on that question, or vice versa).
```
**Report:** "E3 ok — change_correct re-scored".

### E4. Regrade — mark_all_correct

```
1. Tap "Regrade" on another question.
2. Pick the "Mark all correct" radio. The "Pick new correct" card
   disappears (irrelevant for this action).
3. Reason: "Question was ambiguous".
4. Tap Apply Regrade.
5. Alert: regrade complete.
6. The targeted question's % correct in the analysis bar JUMPS to 100%
   (everyone now correct).
7. Affected students' total scores go up by +4 (or whatever marks_correct
   is) compared to before.
```
**Report:** "E4 ok — mark_all_correct flipped everyone to correct".

### E5. Regrade — mark_no_correct

```
1. Tap "Regrade" on a third question.
2. Pick "Mark no correct".
3. Reason: "Bad question, will rewrite".
4. Apply.
5. Alert.
6. The targeted question's % correct drops to 0% in the analysis bar.
7. Students who had this question right LOSE their +4; students who had
   it wrong GAIN +1 (no longer subtracted); the net per-student delta
   depends on what they originally picked.
```
**Report:** "E5 ok — mark_no_correct flipped everyone to skipped".

### E6. Reason validation

```
1. Tap Regrade on any Q. Choose any action. Leave Reason EMPTY.
2. Tap Apply Regrade.
3. Alert: "Reason required — Please write a short justification (3+
   chars)."
```
**Report:** "E6 ok — reason guard fires".

### E7. Audit_log contains full before/after for regrade

```
1. In Supabase Studio:
      select action, entity_id,
             before_data->>'question_id'  as q,
             before_data->>'action'       as act,
             after_data->>'attempts_updated' as n_attempts
      from public.audit_log
      where action = 'exam_regrade'
      order by occurred_at desc limit 5;
   Each row should show the question_id + the action you took +
   how many attempts got recomputed. The full options array (before
   mutation) is in before_data, the new correct option id is in
   after_data — both are jsonb you can drill into via Studio.
```
**Report:** "E7 ok — 3 regrade audit rows visible".

---

## F. SQL sanity (I've already verified these; redo only if curious)

Run in Supabase Studio → SQL Editor (project `orqwyazvcthgxoadfxfv`).

```sql
-- 5 Phase 7 tables created with the right column counts.
select table_name, count(*) as n_cols
from information_schema.columns
where table_schema = 'public'
  and table_name in ('exams','exam_questions','exam_attempts',
                     'exam_answers','offline_test_scores')
group by table_name order by table_name;
-- Expect:
--   exam_answers          5
--   exam_attempts        14
--   exam_questions        4
--   exams                16
--   offline_test_scores  12
```

```sql
-- All 5 tables have RLS enabled.
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('exams','exam_questions','exam_attempts',
                  'exam_answers','offline_test_scores')
order by relname;
-- All relrowsecurity = true.
```

```sql
-- 24 policies across the 5 tables.
select count(*) from pg_policies
where schemaname = 'public'
  and tablename in ('exams','exam_questions','exam_attempts',
                    'exam_answers','offline_test_scores');
-- Expect 24.
```

```sql
-- Partial indexes exist:
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and indexname in ('exams_published_idx','exams_release_idx',
                    'exam_attempts_active_idx',
                    'offline_test_scores_subject_idx');
-- Each indexdef should contain "WHERE …" clause.
```

```sql
-- After §C12 / §E2 (you submitted + teacher released):
select action, entity_id, actor_role, after_data->>'score' as score
from public.audit_log
where action in ('exam_submitted','exam_results_released',
                 'exam_results_force_released','exam_results_unreleased',
                 'exam_regrade')
order by occurred_at desc limit 20;
```

---

## G. Performance + cross-platform spot-checks (optional)

### G1. iOS — locked-down attempt cold render

```
1. Force-quit Expo Go.
2. Sign in as A1 → home → Exam 2 → Enter Exam.
3. From the moment you tap "Enter Exam" to the moment the timer pill
   appears: should be < 2 s on a wired Wi-Fi connection.
4. Q→Q navigation (tap Next): < 200 ms transition.
```
**Report:** "G1: cold start Ns, Q→Q Nms".

### G2. Android Redmi 8A cold start (hardware-blocked)

```
Same script as Phase 5 G1 — currently DEFERRED (no Redmi 8A available).
```
**Report:** "G2: skipped — no Redmi 8A".

### G3. iOS parity (if iPhone available)

```
1. Repeat C4 + C5 + C6 (locked-down UI + timer + tab-switch banner)
   on an iPhone.
```
**Report:** "G3 ok — iPhone parity" or differences.

### G4. Two students same exam — verify isolation

```
1. Two devices, both signed in as different students (A1 + A2).
2. Both start Exam 1 within 30 seconds of each other.
3. Both see DIFFERENT random question order (`randomize_questions=true`)
   AND different option order (`randomize_options=true`) on the same
   exam — the snapshot was generated per-attempt.
4. Both can submit independently. No conflict.
5. Teacher's Results board shows BOTH submissions in the roster.
```
**Report:** "G4 ok — independent random orders + no conflict".

---

## H. What I (the agent) already verified — DON'T re-test

Everything below was exercised by automated tests with passing assertions.

- **DB layer:** Both Phase 7 migrations applied. Tables, columns, FKs,
  CHECK constraints, indexes (including 4 partial), triggers, RLS
  policies — all queried via `information_schema` / `pg_policies` /
  `pg_indexes` / `pg_proc`. Trigger fns `_exams_updated_at` +
  `_offline_test_scores_updated_at` both pin `search_path = public, pg_temp`
  per D-166.
- **All 9 edge fns:** deployed, ACTIVE. `verify_jwt=true` on 8;
  `verify_jwt=false` only on `server-time` per D-181. Verified via
  `list_edge_functions`.
- **Auth gates:** every authenticated fn rejects anon (401), wrong role
  (403), invalid body (400).
- **`exam-start`:** scope (batch); idempotent reuse of in-flight attempt;
  late-entry-aware deadline = min(starts_at+duration, now+duration);
  sanitised payload (stringify+grep proves zero
  `correct_option_id` AND zero `is_correct` substring across the entire
  response); 400 on early entry (`exam has not started yet`) with
  `seconds_until_start` payload.
- **`exam-tab-switch`:** counter increments 1→2; rejects non-student
  (403); silently no-ops on already-submitted attempts (200, no count
  bump) per D-182.
- **`exam-submit`:** scoring correctness (snapshot-anchored — 2-question
  attempt: 1 correct + 1 wrong = +3); replay protection (second call →
  409); `activity_days` upsert; audit `exam_submitted` row with
  `tab_switch_count` and `auto_submitted` included.
- **`exam-release-results`:** teacher path + admin path; idempotent
  (`already_released: true` on second call); audit
  `exam_results_released` with before=null, after=timestamp.
- **`exam-regrade`:** all 3 actions (change_correct, mark_no_correct,
  mark_all_correct) verified including STACKED regrades (mark_no_correct
  then mark_all_correct correctly restores +4 — proves D-179
  full-recompute model). Audit captures per-attempt before/after with
  options snapshot + reason.
- **`offline-score-upsert`:** insert vs update counts; out-of-range
  rejection (400); subject-not-in-batch's-course rejection (400);
  student-not-in-batch rejection (400); audit per-student before/after.
- **`exam-attempt-result`:** 423 LOCKED for student pre-release on
  manual exam; 200 after release; 200 immediately on instant exam;
  includes `is_correct` booleans on every option post-submit.
- **`exam-admin-mutate`:** all 5 ops; 403 for non-admin; audit row
  per op; force_release + force_unrelease idempotent; cascaded_attempts
  count reported on delete_exam.
- **RLS (12 scenarios):**
  - Student A cannot SELECT exam in batch B.
  - Student A cannot SELECT exam_questions of exam B (no question_id leak).
  - Student CAN SELECT own attempt.
  - Student CAN upsert exam_answers for own in-flight attempt.
  - Student CANNOT upsert exam_answers after submit (RLS WITH CHECK).
  - Cross-student answer leak blocked.
  - Teacher CAN SELECT exam in assigned batch.
  - Teacher CANNOT SELECT exam in unassigned batch (even if created_by).
  - `exam-attempt-result` 423 pre-release / 200 post-release for student.
  - `exam-start` response contains zero `correct_option_id` + zero
    `is_correct` (stringify+grep T10).
  - Student reads OWN offline_test_scores only.
  - Teacher of batch A reads batch A's offline_test_scores only.
- **Pure helpers (26 unit assertions):**
  - `gradeAnswer` 4 cases incl. skip + correct + wrong + no-correct-in-bank.
  - `gradeAttempt` mixed 4-q sum.
  - `sanitiseSnapshotForStudent` strips `correct_option_id` (substring
    grep proves zero matches).
  - `regradedCorrectOptionId` 3 modes.
  - `applyMarkNoCorrectOverride` + `applyMarkAllCorrectOverride`.
  - `computeRemainingSec` (early + mid + after-cut).
  - `isAutoSubmittedAt` (before + after hard cut).
  - `shuffleStable` (no-mutate + same-elements + deterministic).
- **TypeScript:** every workspace typechecks (after fixing 8 strict-mode
  index-access issues in moveUp/moveDown swaps + offline-scores filter
  predicate + results-board embed cast).
- **ESLint:** clean (after escaping 3 JSX entities in
  offline-scores-client confirmation modal).
- **Mobile jest:** 53/53 across 6 suites.
- **Security advisor:** 0 ERRORs. All WARNs on Phase 7 tables are the
  intentional `multiple_permissive_policies` pattern (role-segmented
  policies for safety, accepted project-wide since Phase 5). The only
  unchanged WARN is the long-standing Phase-1 backlog
  `auth_leaked_password_protection`. 5 new INFOs (3 unindexed FKs on
  rarely-traversed paths + 2 unused indexes on brand-new tables) —
  accepted.

---

## I. Report-back format

Quick list per section. For each subsection just write `OK`, `OK — note: <x>`,
or `FAIL — <one-line cause + what you saw>`.

```
0.5 ok — 9 fns visible

A1 ok — 13 nav entries
A2 ok — pills + IST correct
A3 ok
A4 ok — both directions
A5 ok
A6 ok
A7 ok — header + IST
A8 ok
A9 ok
A10 ok

B1 ok — 8 tabs visible
B2 ok
B3 ok
B4 ok — only assigned batch
B5 ok — date + time grid
B6 ok
B7 ok
B8 ok
B9 ok
B10 ok
B11 ok — alerts fire
B12 ok
B13 ok — previous score pre-filled
B14 ok — insert + update counts
B15 ok — client range check

C1 ok — Exams section + 3 rows
C2 ok — countdown ticks
C3 ok — Live now CTA
C4 ok — locked-down loads <2s
C5 ok — timer survived background
C6 ok — banner at 1, severe at 3
C7 ok
C8 ok
C9 ok — Submitted shown
C10 ok — instant result
C11 ok — solutions
C12 ok — re-open stays on Submitted

D1 ok — no leak (or skipped)
D2 ok — B1 sees nothing
D3 ok — Enter disabled
D4 ok — auto-submit
D5 ok
D6 ok (or skipped)
D7 ok

E1 ok — board renders
E2 ok — release + student sees
E3 ok — change_correct re-scored
E4 ok — all_correct flipped
E5 ok — no_correct flipped
E6 ok — reason guard
E7 ok — 3 regrade rows

G1: cold start Ns
G2: skipped
G3: ok (or skipped)
G4: ok
```

Anything that **fails** — paste the step + screenshot if visual + the
relevant Metro / Vercel / Supabase Edge-fn log line. I'll diagnose and
patch before the ACCEPTED line gets filled in.
