# Phase 4 — Manual Test Plan (CP1 → CP12)

> Exhaustive click-by-click verification list for every Phase 4 surface that
> needs a human eye (real device, browser, two-device race, etc.). Backend
> checkpoints CP1–CP8 are auto-verified by smoke scripts; CP9–CP12 each need
> manual passes. After you complete all sections, report back per the
> "What to report" line in each section.

**Scope:** Phase 4 manual verification only. Everything below this line is
real-device / real-browser work. All migrations, edge fns, RLS, HMAC,
publication, and cron are already proven by `pnpm test:hmac`, `pnpm test:rls`,
`pnpm smoke:qr-sign`, `pnpm smoke:qr-verify`, `pnpm smoke:cp6`,
`pnpm smoke:materialize`, `pnpm smoke:realtime`, and `pnpm smoke:manual-mark`.

---

## 0. One-time setup

### 0.1 Fresh fixtures

Each pass through this plan needs an open scan window. Run:

```
pnpm seed:manual-test
```

Note down what the script prints — you'll need:
- **Teacher** email + password
- **Student 1** email + password
- **Student 2** email + password
- **Open session** id (open ~2h from script run)
- **Tomorrow session** id

These ARE valid for ~2 hours. Re-seed if the script's "open" session has
slipped past its end time. The current run (saved with this doc) was:

```
Batch    a57aa32e-a825-4fea-8324-d1d171526eaa   Manual Test 2026-05-17T06-35-57
Teacher  manual-teacher-1778999757559@fynestudy.example.com   CPK%U=fRYm2XQ6
Stud 1   manual-student-1-1778999757559@fynestudy.example.com  &=bzXUc57yRyxQ
Stud 2   manual-student-2-1778999757559@fynestudy.example.com  5Qdz-5d+QTEaqz
Open     1fde6729-227e-4ff0-b181-51faaf69d748   12:01 → 14:06 IST Sun 17 May
Upcoming 77bca85a-871f-4401-a7ff-eb1baa060f47   12:06 → 13:06 IST Mon 18 May
```

Re-seed at any point with `pnpm seed:manual-test` — old fixtures stay in
place; the script is idempotent.

### 0.2 Owner admin (for §C admin tests)

Use the bootstrap admin already in the dev DB:

```
Email      owner@fynestudy.example.com
Password   (the one you set in Phase 2 — see your Bitwarden / 1Password)
TOTP       (your enrolled secret)
```

Admin panel URL: <https://fyne-study-app-admin.vercel.app/>
(If Vercel is still on the Phase 1 placeholder, run admin locally with
`pnpm --filter @fynestudy/admin dev` and use <http://localhost:3000/>.)

### 0.3 Metro clean restart procedure (D-158, NON-NEGOTIABLE)

After CP10's route surgery, Metro's hot-reload **cannot** propagate the
changes. Every time you change app branches, or every fresh test session:

```
1.  Ctrl+C  in the Metro terminal.
2.  Force-quit Expo Go on the phone:
    iOS — App Switcher (swipe up + pause), find Expo Go, swipe its card UP.
    Android — Recents button, swipe Expo Go AWAY.
    The runtime must actually be killed — Home/Back is not enough.
3.  pnpm dev:mobile -- --clear        ← USE THIS, NOT raw `expo start`
    The --clear flag is NOT optional. The double dash forwards --clear
    to the wrapper. The wrapper sets EXPO_OFFLINE=1 which suppresses the
    "It is recommended to log in" prompt that appears on every manifest
    fetch from Expo Go. Running `pnpm --filter @fynestudy/mobile exec
    expo start --clear` BYPASSES the wrapper and you will hit the
    arrow-key prompt every reload — DO NOT use that form on Windows.
4.  Open Expo Go from the HOME-SCREEN icon (not recents — your recents are
    empty now anyway).
5.  Scan the new QR.
6.  CRITICAL — watch the Metro log:
       iOS Bundled NNNms <project> (NNNN modules)
    The module count in parens MUST be in the thousands. If it reads
    "(1 module)" or any small N, the cache wasn't cleared — go back to 1.
```

If any later step in this plan fails with `Maximum update depth exceeded`
or `Attempted to navigate before mounting the Root Layout component`, run
this procedure again BEFORE assuming a real bug. (Phase 4 CP10 burned ~1 h
on this — three identical errors, all stale-bundle.)

---

## A. CP9 — Student attendance screen (real-device pending since 2026-05-16)

`apps/mobile/app/(student)/attendance.tsx` + `useQrToken` +
`useAttendanceHistory` + `useAttendanceRealtime`. Code-verified, never put on
a phone.

### A1. Sign in as Student 1

```
1.  Force-quit Expo Go, do the §0.3 clean restart.
2.  At login screen, enter Student 1 credentials from §0.1.
3.  Tap "Sign in".
4.  Expected: lands on the student Home tab.
5.  Bottom tab bar shows SIX tabs:
       Home · Classes · Library · Attendance · Profile · Menu
```
**Report:** "A1 passed" or which tab / login text differs.

### A2. Attendance tab — within open window

(Make sure the open-now session from §0.1 is still inside its scan window.
If it's past, re-seed.)

```
1.  Tap the "Attendance" tab.
2.  Expected at top:
      "Attendance" header
      Subtitle "Show your QR; teacher scans it."
3.  Below: a card titled "Now / Next" with the open session — subject name +
    "Today" badge + time range (e.g. "12:01 pm – 02:06 pm").
4.  Below that card: a "Show your QR" panel containing:
      A live QR code (black/white square)
      Caption "Refreshes in NNs" — the seconds count must tick DOWN
      A small "Refresh now" button (pull-to-refresh also works)
5.  Wait ~30 seconds without touching the screen.
6.  Expected: the QR visibly changes (new pattern); the countdown resets.
7.  Below the QR panel: "This week" + "This month" stat chips. Both should
    read "0/0" or similar at first (you haven't been marked yet).
```
**Report:** "A2 passed — QR rotated at NN seconds" (note the rotation
interval). Or note the failure.

### A3. Attendance tab — outside any window

(Force this by re-seeding so the open session is in the future, OR wait
until after the current open window closes.)

```
1.  Re-enter Attendance tab.
2.  Expected: instead of the QR panel, a card reading:
      "No live class right now"
      "Your next class is on <date> at <time>."
3.  No QR is shown.
```
**Report:** "A3 passed".

### A4. History modal

```
1.  Still on Attendance tab. Find the "View detailed history" link or
    button (bottom of screen).
2.  Tap it.
3.  Expected: a modal slides up with a calendar grid for the current
    month, with marked days color-coded:
       green = present, amber = late, red = absent, grey = no class.
4.  Tap a day with no class.
5.  Expected: no detail / "No class".
6.  Close the modal (X icon or swipe down).
```
**Report:** "A4 passed — calendar heatmap rendered correctly".

---

## B. CP10 — Teacher scan + roster + classes

### B1. Sign in as teacher

```
1.  On the phone, sign out from Student 1: Profile tab → "Sign out".
2.  At login screen, enter Teacher credentials from §0.1.
3.  Tap "Sign in".
4.  Expected: lands on teacher Home tab. Bottom bar shows SIX tabs:
       Home · Scan · Classes · Library · Batch · Profile
    There is NO "Roster" tab.
```

### B2. Scan tab — camera preview + banner

```
1.  Tap "Scan" tab.
2.  First time: iOS prompts to allow Expo Go camera access → tap "Allow".
3.  Expected layout:
    - DARK PILL banner at top (black/55), with:
        tiny amber caption "SCANNING FOR"
        bold white line — e.g. "<subject> · 12:01 pm · Manual Test ..."
        chevron-down icon on the right
    - Centre: 240×240 framed area with 4 YELLOW corner brackets and a
      caption pill "Point at student's QR".
    - Bottom: white button labelled "Open roster" with a checklist icon.
```
**Report:** "B2 passed".

### B3. Session picker dropdown

```
1.  Tap the dark "SCANNING FOR" banner.
2.  A black/80 dropdown appears with two rows:
       <subject> · 12:01 pm    Manual Test · Today
       <subject> · 12:06 pm    Manual Test · Upcoming
3.  Tap "Upcoming" (12:06 pm). Dropdown closes. Banner shows the tomorrow
    session.
4.  Tap banner again → dropdown reopens. Tap the "Today" row. Banner
    reverts.
```
**Report:** "B3 passed".

### B4. Classes tab — segmented + class row

```
1.  Tap "Classes" tab.
2.  Top header: tiny caption "Classes" + bold "Your schedule".
3.  Segmented bar with three pills: "Today N" / "Upcoming N" / "Past N"
    (N = count of sessions in each bucket).
4.  Below "Today" segment is selected: one card with
       Blue calendar icon (left)
       Subject name (bold)
       "Manual Test 2026-05-17… · JEE_MAIN"
       "Sun, 17 May · 12:01 pm – 02:06 pm"
       Right-side pill "Scheduled" (or "Live" if you're inside the window)
       Below: "0 / 2 marked" + a blue "Scan" button + a slate "Roster" btn.
5.  Tap "Upcoming" pill → tomorrow's card.
6.  Tap "Past" pill → empty state sparkles + "No recent classes" + "Past
    classes from the last 30 days will appear here."
7.  Tap "Today" again to return.
```
**Report:** "B4 passed".

### B5. Ad-hoc class FAB

```
1.  Bottom-right of Classes screen: blue circular "+" FAB. Tap it.
2.  Bottom sheet "New ad-hoc class" slides up with calendar-plus icon and
    subtitle "One-off session in one of your assigned batches."
3.  Batch row reads "JEE_MAIN · Manual Test 2026-05-17…" with a chevron.
4.  Duration row: chips 30 min / 45 min / 60 min (selected) / 90 min.
5.  "Starts" card: e.g. "12:15 pm — 01:15 pm (IST)" with caption "Starts at
    the next 15-minute mark. Adjust duration above."
6.  Tap 90 min → time range updates.
7.  Tap "Create class" → spinner → sheet closes → app navigates to the
    new Roster screen (auto-pushes /roster/<new-uuid>).
```
**Report:** "B5 passed — created session ID …" (copy from the URL hint or
just confirm).

### B6. Roster screen — header + bulk + pills

```
1.  You should now be on the Roster screen for the freshly-created session
    (or tap "Roster" from any session row in §B4).
2.  Top: back chevron (left) + "Roster" header.
3.  White card with:
       Tiny blue uppercase "MANUAL TEST 2026-05-17… · AD-HOC"
       Big bold subject name
       Grey time range
       Row of 4 count chips:  0 Present · 0 Late · 0 Absent · 2 Pending
       Two stretched buttons: "All Present" (emerald), "All Absent" (red)
4.  Below: heading "Students" + tiny right caption "Long-press a row to
    change".
5.  Two student rows alphabetical: "Test Student One", "Test Student Two".
    Each row: initials avatar (TS), full name, "UNMARKED" label below,
    three round pills P (emerald-outline), L (amber-outline), A (red-outline).
```
**Report:** "B6 passed".

### B7. Roster — first mark

```
1.  Tap the GREEN "P" pill on row 1 (Test Student One).
2.  Expected: pill fills solid emerald; label flips from UNMARKED to MANUAL.
3.  Count chips become:  1 Present · 0 Late · 0 Absent · 1 Pending.
```
**Report:** "B7 passed".

### B8. Roster — change status (correction sheet)

```
1.  Tap the RED "A" pill on row 1.
2.  Expected: a bottom sheet slides up titled
       "Change status — Test Student One"
    Below title: "Current: present"
    NEW STATUS row: PRESENT / LATE / ABSENT (ABSENT preselected solid red).
    REASON row: chips "Late entry confirmed", "QR scan failed", "Teacher
    error", "Other". Text input "Type a reason".
3.  Tap "Teacher error" chip — it goes solid blue, text input reads it.
4.  Tap "Save".
5.  Expected: sheet closes; row 1's "A" pill is solid red; label is now
    "CORRECTION". Chips: 0 Present · 0 Late · 1 Absent · 1 Pending.
```
**Report:** "B8 passed".

### B9. Roster — long-press on unmarked

```
1.  Long-press (~500 ms) row 2 (still UNMARKED).
2.  Expected: a native Alert pops up
       Title:  "Not marked yet"
       Body:   "Tap a pill (P / L / A) to set this student's initial status."
       OK button.
3.  Tap OK.
```
**Report:** "B9 passed".

### B10. Roster — late mark

```
1.  Tap the AMBER "L" pill on row 2.
2.  Expected: pill fills solid amber; label flips to MANUAL.
3.  Chips: 0 Present · 1 Late · 1 Absent · 0 Pending.
```
**Report:** "B10 passed".

### B11. Roster — bulk button disabled when 0 pending

```
1.  "All Present" and "All Absent" buttons should now appear visually
    DISABLED (background slate-200, not green/red).
2.  Try tapping "All Absent". No Alert appears; nothing happens.
```
**Report:** "B11 passed".

### B12. Camera-denied fallback

```
1.  Open Settings app on the phone.
2.  Apps → Expo Go → Permissions → Camera → DENY.
3.  Return to FyneStudy.
4.  Tap "Scan" tab.
5.  Expected (NOT a black void):
       Slate-50 background
       64×64 amber circle with a camera icon
       Headline "Camera access needed"
       Body "FyneStudy uses the camera to scan students' attendance QR
            codes. Enable it from Settings to continue."
       BLACK pill button "Open Settings" with a settings cog icon.
6.  Tap "Open Settings" → iOS deep-links directly to Expo Go's permission
    page.
7.  Toggle Camera back ON, return to app.
8.  Scan tab works again.
```
**Report:** "B12 passed".

### B13. (REQUIRES SECOND PHONE) Two-device QR scan

```
Phone B = a second phone.

1.  On Phone B: sign in as Student 1 (creds from §0.1).
2.  Phone B → Attendance tab. Rotating QR for the open session appears.
3.  On Phone A (teacher): Scan tab. Confirm dark banner is on the 12:01 pm
    session.
4.  Point Phone A at Phone B's QR code.
5.  Expected within ~1 second:
      Phone A vibrates; the 240×240 overlay flashes GREEN.
      Emerald toast near the top:
          "✔ Test Student One"
          "Marked present" (or "Marked late" if past the 10-min mark)
      Phone B simultaneously refreshes to a "You're marked!" or status-OK
      view (and the toast on Phone B's attendance card now reads Present).
6.  Without leaving Scan, point at Phone B's QR again.
7.  Expected: red toast "Already marked".
8.  Tap the dark banner → switch to 12:06 pm (Upcoming) session.
9.  Point at Phone B's QR (still showing the 12:01 pm session's QR).
10. Expected: red toast "Wrong class".
11. Switch banner back to 12:01 pm.
12. Wait 35+ seconds without scanning anything; Phone B's QR will have
    rotated. Take a screenshot of Phone B's QR BEFORE it rotates again, then
    scan that screenshot 35+ seconds later.
13. Expected: red toast "QR expired".
```
**Report:** "B13 passed — sub-steps 4/6/9/12/13 all behaved as expected"
or describe deviations.

### B14. (REQUIRES SECOND PHONE) Late status by clock

```
After B13 has marked Student 1 present in the 12:01 session:

1.  Re-seed (§0.1) so a fresh OPEN session is created with start time ~now.
2.  Wait 11 minutes from that start (or pick a session whose start is
    already 11+ min ago but ≤ 30 min ago).
3.  Have Student 2 (Phone B) open Attendance and let the QR generate.
4.  Phone A scans Student 2's QR.
5.  Expected: green toast "Marked late" (not "Marked present").
6.  On Phone B: Attendance card shows "Late" badge.
```
**Report:** "B14 passed".

### B15. (REQUIRES SECOND PHONE) Window-closed status by clock

```
1.  Use a session that started 31+ minutes ago AND is still within
    scheduled_end + 15 min (the qr-sign window).
2.  Student tries to scan: from Phone A's side, the result is a red toast
    "Scan window closed for new entries" — or the student's QR fails to
    generate ("Window closed").
3.  However, teacher can STILL manually mark from Roster screen (B7).
```
**Report:** "B15 passed".

### B16. Realtime tick (one-device version)

```
1.  Phone A: navigate to the Roster screen for the open session (use Scan
    → "Open roster" or Classes → Roster).
2.  Note the count chips, e.g. "1 Present · 0 Late · 0 Absent · 1 Pending".
3.  In a desktop terminal, run:
        pnpm seed:manual-test         (gives you a fresh student row)
    Then in psql / Supabase Studio SQL editor, insert an attendance row for
    the session you're viewing:
        insert into public.attendance (session_id, student_id, status,
                                       method, marked_by)
        values ('<session_id>', '<a_student_user_id>', 'present', 'manual',
                '<teacher_user_id>');
4.  Within ~2 seconds, the count chip on Phone A should tick UP by 1, even
    though you didn't touch the phone.
```
**Report:** "B16 passed — chip updated without a refresh" (or skip if
no SQL access — this is auto-covered by `smoke:realtime`).

---

## C. CP11 — Student dashboard wiring

### C1. Sign in as Student 1 again

```
1.  Teacher → sign out (Profile tab).
2.  Sign in as Student 1.
3.  Expected: lands on Home tab.
```

### C2. Greeting + sessions count

```
1.  At top: avatar circle (initials of full_name), FyneStudy logo, bell.
2.  Greeting line "Good <morning|afternoon|evening>, <FirstName>."
       The time band is IST:
         05–11 → morning
         12–16 → afternoon
         17–21 → evening
         else  → "Hi, <FirstName>."
3.  Sub-line "You have N classes scheduled today." (real count from today's
    schedule for your batch — for the seed batch, this is usually 2).
```
**Report:** "C2 passed — greeting was '<text>', count was N".

### C3. Streak placeholder card

```
1.  Below greeting: a white card with an amber flame icon.
2.  Bold text "0-day streak".
3.  Sub-text "Daily login streak — full tracking lands in Phase 8."
```
**Report:** "C3 passed".

### C4. Today's Schedule cards

```
1.  Heading "Today's Schedule" + a "See all" link on the right.
2.  Below: a horizontal scroll row with one card per real session in your
    batch today (NOT the mock Adv. Calculus / Physics 101 cards from before).
3.  Each card:
       Status badge top-left (Live Now / Upcoming / Ended / Present / Late /
       Absent)
       Time range top-right (e.g. "12:01 pm – 02:06 pm")
       Subject name bold
       Sub-line "Scan window open" / "Opens 15 min before" / "Window closed"
       Bottom button "Show QR now" (blue, if window is open and unmarked)
                  or "Open Attendance" (slate, otherwise)
4.  Tap the "See all" link → routes to /attendance.
5.  Tap any card's button → routes to /attendance.
6.  Pull to refresh from top → spinner appears briefly, sessions reload.
```
**Report:** "C4 passed — N real session cards shown".

### C5. Attendance percentage

```
1.  Below schedule: a white card titled "Attendance" with subtitle "Last 7
    days" and a trending-up icon.
2.  If you have any attendance rows in the last 7 days:
       Large blue percentage e.g. "100%"
       Right of it: "N/M marked" (N = present+late, M = total)
       Blue progress bar at the width of that %
       Below: "Last 30 days: NN% (N/M)"
3.  If you have zero attendance rows in the last 7 days:
       Grey "No data yet"
       "Attendance % shows up once you've been marked for at least one
        session."
4.  Bottom: slate "Open Attendance" button → routes to /attendance.
```
**Report:** "C5 passed — week was NN%, month was NN%".

### C6. "More coming soon" card

```
1.  Below Attendance card: a small white card titled "More coming soon"
    with body about mastery / progress / leaderboard / announcements
    arriving in Phase 5–8.
2.  The Course Progress / Recent Materials / Announcements mock sections
    from the old Phase-0 design are GONE.
```
**Report:** "C6 passed".

---

## D. CP12 — Admin /attendance page (browser)

URL: `<admin>/attendance` (e.g. <http://localhost:3000/attendance> if you're
running admin locally, or `<vercel-url>/attendance`).

### D1. Sign in

```
1.  Open the admin URL.
2.  Sign in as the owner admin (§0.2).
3.  Complete TOTP.
4.  Expected: lands on /  (Overview).
5.  In the left nav, you should see a new "Attendance" item, between
    "Courses" and "Audit log".
6.  Click "Attendance".
```
**Report:** "D1 passed".

### D2. Empty / pick-a-batch state

```
1.  At /attendance, the header reads "Attendance" with sub-text "Per-batch
    matrix · click any cell to correct · export to CSV.".
2.  Below: a filter bar with three controls:
       From (date input — defaulted to today-6)
       To   (date input — defaulted to today)
       Batch (dropdown labelled "Pick a batch")
       Apply button
       Export CSV button (disabled — greyed out)
3.  Below filter bar: a dashed empty card "Pick a batch above to load the
    attendance matrix."
```
**Report:** "D2 passed".

### D3. Load the seed batch

```
1.  In the Batch dropdown, find "JEE_MAIN · Manual Test 2026-05-17T06-35-57".
    (If you re-seeded, find the matching newest "Manual Test …" entry.)
2.  Pick it.
3.  Click "Apply".
4.  URL becomes /attendance?from=YYYY-MM-DD&to=YYYY-MM-DD&batch=<uuid>.
5.  Expected: a table appears with:
       Row 1 = sticky header (Student | <session columns>)
       Each session column header shows date "17 May 12:01" + subject
       Rows = students alphabetically (Test Student One, Test Student Two)
6.  Each cell is one of:
       Coloured "P" / "L" / "A" pill (emerald / amber / red)
       Light grey "—" (unmarked) — disabled, can't click
7.  Hover over any cell with data → tooltip shows status (method) and
    a marked_at timestamp.
```
**Report:** "D3 passed — matrix loaded with N students × M sessions".

### D4. Correction modal — happy path

```
1.  Click any coloured (non-grey) cell — e.g. Test Student One's "A" cell
    from §B8.
2.  Expected: a modal "Correct attendance — Test Student One" opens.
       Description: "<subject> · <date> · current status: absent"
       "NEW STATUS" row: PRESENT / LATE / ABSENT (none preselected)
       "REASON" row: chips "Late entry confirmed", "QR scan failed",
       "Teacher error", "Other" + text input below.
       "Save correction" button (DISABLED until status picked + reason ≥3
       chars).
3.  Click "PRESENT" → pill turns solid emerald.
4.  Click the "QR scan failed" chip → text input fills with that phrase.
5.  Click "Save correction".
6.  Expected: modal closes; row's cell flips to "P" (emerald) within 1 sec.
7.  Click the same cell again — modal now shows "current status: present".
8.  Close the modal (X icon or Cancel).
```
**Report:** "D4 passed".

### D5. Correction modal — validation

```
1.  Click any coloured cell.
2.  Leave both NEW STATUS and Reason untouched. "Save correction" stays
    disabled.
3.  Click a NEW STATUS pill (e.g. PRESENT). "Save" still disabled.
4.  Type just "ok" in the reason input. "Save" still disabled (< 3 chars).
5.  Add a 3rd char → "okk". "Save" enables.
6.  Click an already-matching status (current PRESENT → click PRESENT)
    + reason → click Save. Expect inline error "Status already matches."
7.  Cancel.
```
**Report:** "D5 passed".

### D6. CSV export

```
1.  With a batch loaded and the matrix populated, click "Export CSV".
2.  Browser downloads a file named:
       attendance_<batch_name>_<from>_to_<to>.csv
3.  Open the CSV in a text editor or spreadsheet.
4.  Expected:
       Row 1 = "Student","Email","<col1>","<col2>",…
       Each col header = "17 May 12:01 — <subject>" (with " (ad-hoc)"
       suffix where applicable)
       Each data row = student name, student email, status strings
       ("present" / "late" / "absent" / "")
       Strings containing commas / quotes / newlines are wrapped in "…"
       with doubled "".
```
**Report:** "D6 passed — CSV had N rows × M columns".

### D7. Date filter

```
1.  Change "From" to 2 days from now (i.e. clearly in the future).
2.  Keep "To" today.
3.  Click "Apply".
4.  Expected: matrix re-renders. Either no rows / no columns ("No sessions
    in <from> → <to> for this batch.") or just the future sessions show.
5.  Reset to defaults — change "From" back to today-6, "To" today, Apply.
```
**Report:** "D7 passed".

### D8. Audit + correction trail (DB-side check, no UI)

The correction modal calls `attendance-correct` which writes an
`attendance_corrections` row + an `audit_log` row. To eyeball this:

```
1.  In Supabase Studio SQL editor, run:
       select a.action, a.entity_id, a.before_data, a.after_data,
              a.occurred_at, au.full_name as actor
       from public.audit_log a
       left join public.app_users au on au.id = a.actor_user_id
       where a.action = 'attendance_corrected'
       order by a.occurred_at desc
       limit 5;
2.  Expected: at least one row with the correction you just did in §D4,
    `before_data.status = 'absent'`, `after_data.status = 'present'`,
    `after_data.reason = 'QR scan failed'`, `actor = <your admin name>`.
3.  Then:
       select prev_status, new_status, reason, changed_at
       from public.attendance_corrections
       order by changed_at desc limit 5;
4.  Expected: matching row.
```
**Report:** "D8 passed — audit row + correction row present" (or paste
the SQL output back).

---

## E. Performance + housekeeping (low-end device)

### E1. Cold-start budget

```
1.  Force-quit Expo Go.
2.  Start a stopwatch.
3.  Open Expo Go from the home icon; scan the dev QR.
4.  Stop when the login screen first paints fully.
5.  Target: ≤ 3000 ms on a Redmi 8A class device. On modern iPhones it
    should be well under 2000 ms.
```
**Report:** "E1 — cold start NNNNms on <device model>".

### E2. Screen transitions

```
1.  As a logged-in teacher:
2.  Tap Classes → Scan → Classes → Roster (via a row) → back arrow.
3.  Each transition should feel ≤ 200 ms (smooth, no perceptible stutter).
```
**Report:** "E2 passed".

### E3. WebView / camera memory

```
1.  As teacher, stay on Scan tab for 5 minutes pointed at a static QR.
2.  Switch to Classes → Roster → back to Scan a few times.
3.  No app crash, no growing lag.
```
**Report:** "E3 passed".

### E4. Realtime ghosts check

```
1.  Open Roster, then navigate away (tap Classes).
2.  Then back to Roster (different session).
3.  Then sign out.
4.  Watch the Metro log for any "channel not removed" / "subscription
    leaked" warnings. None expected.
```
**Report:** "E4 passed".

---

## F. AC coverage matrix (Phase 4 §10)

This is just the mapping — you don't need to re-run anything below; it's
here so you can tell me which AC is green from your work above.

| AC# | What it says | Covered by |
|---|---|---|
| 1  | Migrations run cleanly | already ✓ (CP1 accepted) |
| 2  | `pg_cron` job exists | already ✓ (`cron_active=1`) |
| 3  | `materialize_sessions(14)` inserts | already ✓ (`smoke:materialize`) |
| 4  | Student sees QR during window | §A2 |
| 5  | QR rotates ≤30s | §A2 |
| 6  | Scan → toast within 1s | §B13 |
| 7  | Student's screen refreshes to Present | §B13 |
| 8  | Repeat scan → "Already marked" | §B13 |
| 9  | 30s+ expired QR | §B13 |
| 10 | Wrong session → mismatch toast | §B13 |
| 11 | Manual P/L/A works | §B7, §B8, §B10 |
| 12 | "All Present" bulk works | §B5 + (would need a session with pending students; do via re-seed if needed) |
| 13 | Late status by clock | §B14 |
| 14 | Very late blocks scan, manual still ok | §B15 |
| 15 | Ad-hoc session creates + works | §B5 |
| 16 | Correction long-press | §B8, §B9 |
| 17 | Admin shows correction | §D3, §D4 |
| 18 | Camera-denied fallback | §B12 |
| 19 | Cross-batch isolation (RLS) | already ✓ (`test:rls` 24/24) |
| 20 | Cold start under 3s | §E1 |
| 21 | CI green + RLS tests | already ✓ |

---

## G. What to send back

For each section, copy the line:

```
A1 ✓
A2 ✓
…
```

Or for failures, paste the smallest reproduction (which step number, what
you saw vs. expected, screenshot if possible). I'll then:

1. Re-run any automated check you flagged.
2. If a UI bug needs a code change, fix it and re-validate.
3. Otherwise, append the Phase 4 §14 acceptance ledger (CP13) and tag the
   phase for the PR.

**Important:** the seed credentials in §0.1 may have aged past their scan
window by the time you read this. Re-run `pnpm seed:manual-test` and use
the freshly-printed credentials — the doc fixture block is a snapshot, not
authoritative.












---------

 RESUME PHASE 4 — FYNESTUDY MOBILE/BACKEND (post-restart, 2026-05-17 carry-over)

  State summary (read memory before doing anything else):
  - CP1–CP12 are all CODE-COMPLETE and every automated gate is green.
  - CP10 (teacher scan/roster/classes), CP11 (student dashboard wiring), CP12 (admin /attendance page) all landed in the previous session.
  - CP13 (Phase 4 §14 acceptance ledger) is HELD until I finish the manual walkthrough.
  - I have NOT executed any manual test yet. Zero of seven sections in docs/phases/phase-4-manual-tests.md are done. I went off to play Roblox
  and shut down. Treat this as a clean re-entry.
  - All Phase 4 work is uncommitted on `main`. NO PR is open. Do NOT commit, push, or open a PR without me explicitly saying "open the PR".

  BEFORE READING THIS PROMPT FURTHER, do these in order:
  1. Read C:\Users\kaust\.claude\projects\C--Users-kaust-OneDrive-Desktop-FyneStudyLive\memory\MEMORY.md
  2. Read the file linked there as "Phase 4 status" (project_phase-4-status.md) — current state of CP1–CP13 + full mechanical-proof corpus.
  3. Read "Phase 4 manual tests pending" (project_phase-4-manual-tests-pending.md) — points to the test plan doc.
  4. Read "Phase 4 decisions" (project_phase-4-decisions.md) — binding rules D-148, D-156, D-157, D-158.
  5. Read "Metro stale-bundle gotcha" (feedback_metro-stale-bundle.md) — non-negotiable restart procedure.
  6. Read CLAUDE.md (repo root) for hard rules.
  7. Read docs/phases/phase-4-manual-tests.md cover-to-cover — that's the gating doc.
  8. Run TaskList — you'll see #1 CP10 in_progress (awaiting my walkthrough), #2 CP11 completed, #3 CP12 completed, #4 CP13 pending. Don't
  recreate.
  9. Run `git status --short` to confirm uncommitted Phase 4 work is still on disk.

  WHAT'S PENDING — MANUAL TESTS I MUST PERFORM

  I have to execute every section in docs/phases/phase-4-manual-tests.md before CP13 can start. Sections are:
    §0 Setup (re-seed + Metro clean-restart procedure)
    §A CP9 student attendance — 4 tests (this is a carry-over from 2026-05-16, never been on a phone)
    §B CP10 teacher scan/roster/classes — 16 tests (incl. two-device QR race, camera-denied, late-by-clock, window-closed-by-clock, Realtime
  tick)
    §C CP11 student dashboard wiring — 6 tests
    §D CP12 admin /attendance page (browser) — 8 tests (incl. SQL audit-trail spot-check)
    §E Performance / housekeeping — 4 tests (cold-start ≤3s on Redmi 8A class, transitions, WebView memory, Realtime ghosts)
    §F AC coverage matrix (mapping, nothing to run)
    §G How to report back

  STATUS: 0 of 7 sections done. NONE of these tests have been performed yet. The seed credentials saved in the doc's §0.1 block are STALE — they
   were valid Sun 17 May 12:01–14:06 IST and will be past by the time you read this.

  THE PLAN FOR THIS SESSION

  Step 0 — Re-orient.
  0a. Run `pnpm seed:manual-test` and paste the new credentials back to me.
  0b. Run mcp__claude_ai_Supabase__execute_sql with:
        select (select count(*)::int from public.audit_log) as audit_total,
               (select count(*)::int from public.audit_log where action='attendance_manual_marked') as manual_marked,
               (select count(*)::int from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and
  tablename='attendance') as realtime_attendance,
               (select count(*)::int from pg_tables where schemaname='public' and rowsecurity=false) as tables_without_rls,
               (select count(*)::int from cron.job where active and jobname='materialize-sessions-nightly') as cron_active;
      Confirm: tables_without_rls=0, realtime_attendance=1, cron_active=1. (The other counts may have moved up from re-runs — that's fine.)
  0c. Run mcp__claude_ai_Supabase__list_edge_functions — confirm 17 ACTIVE functions including attendance-manual-mark.
  0d. Run mcp__claude_ai_Supabase__get_advisors for both security and performance — confirm 1 security WARN (auth_leaked_password_protection —
  Phase 1 backlog) and 28 perf lints (the intentional multi-policy RLS + earlier FK INFOs).
  0e. Run `git diff HEAD -- apps/mobile/app/_layout.tsx apps/mobile/app/\(teacher\)/_layout.tsx` — both must be EMPTY (D-157 lock). On Windows
  PowerShell wrap the parens in single quotes.
  0f. Optional but recommended — re-run the smoke gauntlet to prove nothing regressed while my PC was off: pnpm test:hmac, pnpm test:rls, pnpm
  smoke:qr-sign, pnpm smoke:qr-verify, pnpm smoke:cp6, pnpm smoke:materialize, pnpm smoke:realtime, pnpm smoke:manual-mark. Realtime can flake
  on cold start — retry once if it fails the first call.
  0g. Once 0a–0f are green, summarize: "Backend still solid. Manual walkthrough ready. Re-seeded creds: <paste>."

  Step A — Help me run the manual walkthrough, section by section.

  For each test in docs/phases/phase-4-manual-tests.md (§A through §E):
    - Quote the section header to me.
    - Re-state the exact click-by-click steps (don't make me cross-reference the doc — show me the steps inline so I can act on them straight
  from the chat).
    - Use the freshly-re-seeded credentials from Step 0a wherever the doc's frozen §0.1 block says "Teacher" / "Student 1" / etc.
    - Wait for me to report back "section <X.N> passed" or "failed — <description>".
    - On any failure, FIRST suspect stale Metro bundle per [[metro-stale-bundle]]. Quote the "(N modules)" bundle line as evidence before adding
   more code fixes.
    - On a real (non-stale-bundle) failure, fix the code in place, re-run the relevant smoke + typecheck, and tell me to retest that one step.
  Don't bulk-edit.

  Run order: §A → §B → §C → §D → §E. (§A first because it's the oldest pending item.)

  Skip §B13/§B14/§B15/§B16 if I tell you "single phone only" — those need a second device. Note the skip but don't block on it.

  Step B — Only after I say "all manual tests passed" or "skipping <list> until later", move to CP13.

  Step B — CP13 — Phase 4 §14 acceptance ledger.

    - Mark task #4 in_progress.
    - Read docs/phases/phase-3.md §14 to mirror its shape.
    - Append §14 to docs/phases/phase-4.md with:
      - AC results table (all 21 ACs from phase-4.md §10, with pass/fail per AC and the section that covered it — §F of the manual test doc has
  the mapping).
      - Mechanical proof corpus (typecheck, lint, smoke counts — copy from phase-4-status memory + this session's fresh runs).
      - DoD checklist (§13 of phase-4.md).
      - Deliberate deviations: D-115, D-148, D-152, D-153, D-154, D-156, D-157, D-158 (the ones in phase-4-decisions memory).
      - Carry-overs into Phase 5 (Vercel deploy fix, Sentry/PostHog, Android cold-start hardware, 16 perf advisor INFOs, the
  auth_leaked_password Phase 1 backlog).
      - Phase-3-vs-Phase-4 comparison table.
    - Do NOT commit or auto-accept. PAUSE for me to say "Phase 4 accepted".

  Step C — After "Phase 4 accepted":

    - Update project_phase-4-status.md memory to CLOSED.
    - Wait for me to say "open the PR" before any git commit / push / gh pr create.
    - Do NOT commit on your own initiative.

  GROUND RULES (same as last session)

  - NEVER auto-commit. NEVER push. NEVER open a PR without explicit "open the PR" from me.
  - Verify Supabase claims by SQL, not by eye ([[supabase-verify-by-sql]]).
  - Step-by-step verification with exact URLs / button names / expected screen text ([[step-by-step-verification]]).
  - If I report an RN error after a code fix, FIRST suspect stale Metro bundle ([[metro-stale-bundle]]). Quote the "(N module)" bundle line as
  evidence before adding more fixes.
  - After each section I confirm passes, give a 1-line "§X done. Next: §Y." update — don't write long summaries between steps.

  WHAT IS ALREADY DONE — DO NOT REDO

  - CP1–CP8 backend (migrations, RLS, HMAC, qr-sign, qr-verify, correct/bulk/adhoc, materialize, realtime publication) — accepted.
  - CP9 mobile student attendance code — accepted (manual deferred — covered in §A).
  - CP10 mobile teacher scan + classes + roster (route at apps/mobile/app/roster/[sessionId].tsx OUTSIDE the (teacher) tab group per D-157;
  layout files both at zero diff vs HEAD).
  - CP11 mobile student dashboard wiring (apps/mobile/app/(student)/index.tsx rewritten — greeting + streak placeholder + real Today's Schedule
  + Attendance % + "More coming soon").
  - CP12 admin /attendance page (page.tsx + attendance-client.tsx + actions.ts + "Attendance" nav item in (dashboard)/layout.tsx).
  - docs/phases/phase-4-manual-tests.md — the test plan doc itself.
  - All gates: pnpm -r typecheck, mobile lint, admin lint, 8 smoke suites — all green at session close.

  DO NOT rewrite, refactor, or "polish" any of the above. The code is correct on disk. If a manual test fails, fix only the specific failure,
  don't touch surrounding files.

  Begin with Step 0a (re-seed) and Step 0b–0f (state recheck) IN PARALLEL — they're independent. Once that's reported, ask me which section I
  want to start with. I'll usually pick §A.
