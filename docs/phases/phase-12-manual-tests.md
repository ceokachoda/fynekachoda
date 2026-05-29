# Phase 12 — Full-Product Manual Acceptance Test Plan (PRE-LAUNCH QA)

> **This is THE final, whole-app QA pass.** Phase 12 closes the build:
> admin completion (real Overview metrics, audit-log viewer, admins
> management, bulk student import), hardening, and the production demo.
> Phase 12 is the LAST phase — once every section here is signed off in
> **§J**, the app is cleared to ship to the Play Store internal-testing track.
>
> **Run this end-to-end as if you were a brand-new institute owner setting
> up the product**, then a teacher, then a student. Treat every step as a
> fresh bug hunt — do not assume a feature works because an earlier phase's
> automated tests passed.
>
> **You are testing against the LIVE backend.** There is no separate
> staging/prod database — the admin panel and the mobile app both talk to
> the real Supabase project `fynestudy-dev`
> (`orqwyazvcthgxoadfxfv`). **Everything you create here is real.** See the
> test-hygiene rules in §0.4. Use clearly-named throwaway data (prefix
> **`ZZ Test`**) and clean it up when you finish.

---

## §0 — Prerequisites & setup

### 0.1 — What you'll run

**Admin panel** (web, in a desktop browser — Chrome recommended):
- Hosted: the Vercel URL (e.g. `https://fyne-study-app-admin.vercel.app/`), OR
- Local: at the repo root run `pnpm dev:admin`, then open
  `http://localhost:3000`.
- If the hosted URL shows an old placeholder or errors, fall back to the
  local dev server.

**Mobile app** (on a phone):
- Expo Go: at the repo root run `pnpm dev:mobile -- --clear` (always the
  wrapper, always `--clear` for this pass — see 0.3), then scan the QR with
  Expo Go, OR
- The installed **Play internal-testing build** on a real Android phone (no
  Metro needed — this is the closest to what your users get).

### 0.2 — Accounts you need

| Who | How to get it |
|---|---|
| **Owner admin** | `owner@fynestudy.example.com` (bootstrap). Password = your Phase 2 password. TOTP = your enrolled authenticator. If you've never enrolled TOTP, do §A2 first. |
| **A throwaway staff admin** | You'll CREATE this in §F2 (owner-only). |
| **A throwaway teacher** | Create in §D, or use a seed teacher. First mobile login forces a password change. |
| **A throwaway student** | Create in §C, or use a seed student. First mobile login forces a password change. |

**Per-feature seed scripts** (run at the repo root; each prints fresh logins
and a "what correct looks like" summary). Use these to get rich data fast
without hand-building it:

```
pnpm seed:quiz-manual-test --reset        # quiz attempt + KaTeX math
pnpm seed:exam-manual-test --reset        # graded exams (live + scheduled + instant)
pnpm seed:dashboard-manual-test --reset   # mastery / streaks / dashboards
pnpm seed:leaderboard-manual-test --reset # leaderboard + 11 badges + celebration
pnpm seed:live-manual-test --reset        # live + upcoming + recorded sessions (real video, no OBS needed)
pnpm seed:content-manual-test             # study-materials library (video + PDF)
```

> Seed accounts come with `must_change_password = false`, so you log
> straight in (skip the forced-change step for those). To exercise the
> forced-change flow itself, create a NEW account in §C/§D and use the temp
> password shown at creation.

### 0.3 — Metro clean restart (Expo Go only — NON-NEGOTIABLE)

If you're on the installed Play build, skip this. If you're on Expo Go, do
a clean restart at the start of EACH mobile session — hot-reload cannot
propagate route/tab changes and you'll test a stale bundle:

```
1. Ctrl+C in the Metro terminal (stop any running dev server).
2. Force-quit Expo Go:
      iOS:     swipe up, flick the Expo Go card away.
      Android: recents button, swipe Expo Go away.
3. pnpm dev:mobile -- --clear        ← the wrapper, WITH --clear.
4. Open Expo Go from its HOME-SCREEN icon (not from recents). Scan the QR.
5. The Metro log MUST print "(NNNN modules)" with N in the thousands.
   If it says "(1 module)" the cache did NOT clear — go back to step 1.
```
**Report:** `0.3 ok — bundled NNNN modules` (or "Play build, n/a").

### 0.4 — Test-hygiene rules (READ — you're on the live DB)

- Name everything you create **`ZZ Test <thing>`** (e.g. course `ZZ Test
  Course`, batch `ZZ Test Batch`, student "ZZ Test Student", admin "ZZ Test
  Admin"). The `ZZ` prefix sorts your junk to the bottom of every list and
  makes cleanup easy.
- Use throwaway emails you control, e.g.
  `zz.test.student+<n>@example.com`. **Real welcome emails are NOT sent in
  dev** — the temp password is shown on-screen at creation, so you don't
  need a real inbox.
- **Don't suspend, reset, delete, or regrade the bootstrap owner or any
  real institute account.** Only act on `ZZ Test …` data.
- At the end, clean up (see §0.5).

### 0.5 — Cleanup checklist (do this AFTER you finish all sections)

- Suspend or delete every `ZZ Test` student/teacher you created (Students →
  row → Suspend; or delete via the relevant admin page).
- Delete `ZZ Test` quizzes / exams / content / offline scores you made.
- Delete the `ZZ Test` admin (note: there's no in-UI admin-delete in this
  phase — leave it **suspended** instead, or remove it via SQL if you
  prefer).
- Seed data (`P*_TEST_*`, `p*-*` users) can be wiped by re-running the
  relevant seed with `--reset`, or left for the next pass.

### 0.6 — Device list (cover all three before sign-off)

| Tier | Device | Why |
|---|---|---|
| Low-end Android | **Redmi 8A class** (Android 9, 2 GB RAM) | The reference floor. Cold-start + transition budgets in §I are measured here. *(Hardware-gated — if unavailable, mark §I Redmi rows "skipped — no device".)* |
| Flagship Android | any recent Android | Performance headroom + parity. |
| iPhone (iOS) | any supported iPhone | iOS-specific behaviours flagged inline. |

Record which device each section ran on in the **§J** ledger.

---

# PART 1 — ADMIN PANEL (desktop browser)

## §A — Admin auth & security

### A1. Login
```
1. Open the admin URL. You land on a login screen (FyneStudy branding,
   Email + Password fields).
2. Enter a WRONG password for owner@fynestudy.example.com → submit.
3. You stay on login with an error (invalid credentials). You are NOT let in.
4. Enter the correct password → submit.
```
**Expected:** correct password advances you to the TOTP step (A2) if 2FA is
enrolled, or straight to the dashboard if not.
**Report:** `A1 ok` / `A1 FAIL — <what you saw>`.

### A2. TOTP 2FA — enroll (first time) / verify
```
If you have NOT enrolled 2FA yet:
1. After password, you're routed to /2fa/enroll. A QR code + a manual
   secret are shown.
2. Open Google Authenticator / Authy → add account → scan the QR (or type
   the secret).
3. Type the 6-digit code into the field → submit.
4. You're taken to the recovery-codes screen (/2fa/recovery) listing 10
   one-time codes. Save them somewhere safe. Continue.

If 2FA is ALREADY enrolled:
1. After password you land on /2fa/verify.
2. Type the current 6-digit code from your authenticator → submit.
3. A wrong/expired code is rejected; a correct one lets you in.
```
**Expected:** with 2FA enrolled, you CANNOT reach the dashboard without a
valid TOTP code.
**Report:** `A2 ok — enrolled / verified`.

### A3. Dashboard reached + identity shown
```
1. You land on the Overview page (§B covers it in detail).
2. Bottom-left of the sidebar shows YOUR name, email, and a role line
   reading "Owner admin".
```
**Report:** `A3 ok — signed in as owner`.

### A4. Owner-only gating + /forbidden
```
1. As owner, confirm the sidebar shows an "Admins" entry (4th item).
2. Click it → /admins loads (owner-only page).
3. (You'll prove a staff_admin is BLOCKED from this page in §F3.)
4. Manually visit /forbidden in the address bar → a "403 / not allowed"
   style page renders (this is where non-owners get bounced).
```
**Report:** `A4 ok — Admins visible to owner, /forbidden renders`.

### A5. Forced password change (admin)
> Verified in full in §F2 with the throwaway staff admin: a freshly created
> admin must change its password at first login. Just note it here.
**Report:** `A5 — see §F2`.

### A6. Sign out
```
1. Sidebar bottom → "Sign out".
2. You're returned to the login screen.
3. Press the browser Back button → you do NOT regain the dashboard (you're
   bounced to login). Session is gone.
```
**Report:** `A6 ok — signed out, back button doesn't restore session`.

---

## §B — Overview dashboard (real metrics)

Sign in as owner. Land on Overview ("A live snapshot of your institute.").

### B1. The OLD placeholder is gone
```
1. The page title is "Overview" with subtitle "A live snapshot of your
   institute."
2. There is NO "Phase 2 placeholder" / "coming soon" text anywhere on the
   page.
```
**Report:** `B1 ok — no placeholder text`.

### B2. Eight metric cards show real numbers
```
1. Two rows of FOUR cards (8 total). Row 1 (blue numbers):
      Students · Teachers · Active batches · Courses
   Row 2 (violet numbers):
      Published quizzes · Published exams · Study materials · Upcoming sessions
2. Each card shows a NUMBER (not "—", not "0" unless that count is genuinely
   zero), a label, and a one-line hint (e.g. "Enrolled accounts").
3. Sanity-check 2 of them against reality:
      - "Students" ≈ the row count on the Students page (§C1).
      - "Courses" ≈ the number of courses on the Courses page (§D).
   (If you've run seeds, expect non-trivial counts.)
```
**Report:** `B2 ok — 8 cards, real counts (students=N, courses=M)`.

### B3. Cards link to their pages
```
1. Click the "Students" card → navigates to /students.
2. Back. Click "Published exams" card → navigates to /exams.
3. Back. Click "Upcoming sessions" card → navigates to /attendance.
```
**Report:** `B3 ok — cards navigate`.

### B4. Recent-activity feed renders
```
1. Below the cards: a "Recent activity" panel with a "View audit log →"
   link top-right.
2. If any privileged action has happened (e.g. you created/suspended an
   account, corrected attendance), up to 8 rows show:
      "<role> <did something> · <table>"   +   a timestamp (IST).
   e.g. "owner admin created an account · app_users   28 May, 14:02".
3. If the institute is brand-new with zero audit history, it instead reads
   "No activity recorded yet." (acceptable).
4. Click "View audit log →" → lands on /audit (§F1).
```
> Tip: if the feed is empty, do §C3 (create a student) first, then return —
> a "created an account" row should appear.
**Report:** `B4 ok — activity feed renders + links to audit`.

---

## §C — Students (list, filter, create, BULK IMPORT, detail, lifecycle)

### C1. List + counts
```
1. Sidebar → "Students". Title "Students" + a "<N> results" subline.
2. Top-right has TWO buttons: "Import CSV" (outline) and "+ New student"
   (solid blue).
3. Table columns: Name · Email · Phone · Class · Status · Created.
4. Status badges: green "Active", amber "Pending PW change", red
   "Suspended".
```
**Report:** `C1 ok — list + Import CSV + New student buttons`.

### C2. Filter + search
```
1. The filter bar has a search box + a status dropdown
   (All / Active / Suspended / Pending PW change — exact labels may vary).
2. Type part of a known student's name → list narrows to matches.
3. Set status = "Suspended" → only suspended students show (may be 0 → an
   empty-state card with a "Clear filters" link).
4. Clear filters → full list returns.
```
**Report:** `C2 ok — search + status filter work`.

### C3. Create ONE student
```
1. Click "+ New student". A form opens (full name, email, phone, dob,
   batch, and the school/board/class/parent fields).
2. Fill: Full name "ZZ Test Student One", email
   zz.test.student+1@example.com, pick a batch (REQUIRED — course is
   derived from it), fill any required fields.
3. Submit.
4. On success a temporary password is shown ONCE on screen — copy it
   (you'll use it for the mobile first-login in §G1). There's a Copy button.
5. Go back to the Students list → "ZZ Test Student One" appears, status
   "Pending PW change" (amber).
```
**Report:** `C3 ok — student created, temp password shown, appears in list`.

### C4. BULK CSV IMPORT — download template
```
1. Students list → click "Import CSV". Lands on /students/import,
   "Bulk import students".
2. Section "1 · Choose the target batch": a batch dropdown. Pick your
   ZZ Test batch.
3. Section "2 · Upload the CSV": click "Download template" (top-right of
   that card). A file "students-template.csv" downloads.
4. Open it. The header row lists these columns:
      full_name, email, phone, dob, gender, address, school_name, board,
      current_class, parent_phone_1, parent_phone_2, parent_consent_method
```
**Report:** `C4 ok — template downloads with the 12 headers`.

### C5. BULK CSV IMPORT — make a small test CSV with a bad + duplicate row
```
Create a CSV (in Excel/Sheets/Notepad) using the template header, with
FOUR data rows engineered to exercise the preview:

   full_name,email,phone,dob,...
   ZZ Bulk A,zz.bulk.a@example.com,,,,,,,,,,
   ZZ Bulk B,zz.bulk.b@example.com,,,,,,,,,,
   ,zz.bulk.noname@example.com,,,,,,,,,,        ← INVALID (no name)
   ZZ Bulk Dup,zz.bulk.a@example.com,,,,,,,,,,  ← DUPLICATE email (matches row 1)

(You can leave the optional columns blank — only full_name + email matter
for the preview.)
```
**Report:** `C5 ok — test CSV prepared`.

### C6. BULK CSV IMPORT — upload + verify the preview
```
1. Back on /students/import, choose the file (the file input in section 2).
2. A preview table appears: Line · Name · Email · Status.
3. Above it, count chips:
      a green "N valid" chip (here: 2 valid)
      a red  "M skipped" chip (here: 2 skipped)
4. In the table:
      ZZ Bulk A          → green "Ready"
      ZZ Bulk B          → green "Ready"
      (no-name row)      → red "Name is missing"
      ZZ Bulk Dup        → red "Duplicate email in file"
   (Invalid rows are shaded red and will NOT be imported.)
```
**Report:** `C6 ok — preview shows 2 valid / 2 skipped with reasons`.

### C7. BULK CSV IMPORT — run it + verify results + credentials
```
1. Click the "Import 2 students" button (count matches the valid rows).
2. A "Creating accounts one by one — keep this tab open" note shows; wait
   (can take up to a minute).
3. Result panel: "Import complete" with "2 created · 0 failed · 2
   attempted." (If you re-run the SAME file, the 2 emails now collide and
   show under "Failed rows" as "Email already in use" — that's correct.)
4. Click "Download credentials (CSV)" → "new-student-credentials.csv"
   downloads with header `email,temp_password` and one row per created
   student.
5. Click "← Students" (or the nav) → "ZZ Bulk A" and "ZZ Bulk B" now appear
   in the Students list (status "Pending PW change"), both enrolled in the
   batch you picked.
```
**Report:** `C7 ok — 2 created, credentials CSV downloads, students appear`.

### C8. Student detail page
```
1. Students list → click "ZZ Test Student One".
2. Detail page shows profile fields (name, email, phone, dob), academic
   info (batch + course), and an action row (Suspend / Reset password) +
   a batch-transfer control + a per-student Audit history section.
```
**Report:** `C8 ok — detail renders`.

### C9. Suspend → Reactivate
```
1. On the detail page, click "Suspend". A confirm dialog "Suspend student?"
   with an optional Reason field appears.
2. Confirm. The page reflects suspended status (and the list badge turns red
   "Suspended").
3. Back on detail, the button now reads "Reactivate". Click it.
4. Status returns to active.
```
**Report:** `C9 ok — suspend + reactivate`.

### C10. Reset password
```
1. On the detail page, click "Reset password". Dialog "Reset password?".
2. Confirm. A NEW temporary password is shown with a Copy button + the note
   that existing sessions are signed out and the student must change it at
   next login.
3. Click "Done".
```
**Report:** `C10 ok — reset shows new temp password`.

### C11. Batch transfer
```
1. On the detail page, use the batch-transfer control. Pick a DIFFERENT
   active batch (a second ZZ Test batch is ideal — create one in §D first).
2. Confirm. The student's batch (and derived course) updates on the detail
   page.
3. (Reassign back to the original batch if you like.)
```
**Report:** `C11 ok — batch transfer works`.

---

## §D — Teachers, Batches, Courses, Curriculum

### D1. Courses
```
1. Sidebar → "Courses". A list of courses (e.g. JEE/NEET/CUET + any seeds).
2. Create a course "ZZ Test Course" (code like ZZTEST). Save → it appears.
3. Open it → it has a curriculum tree (Subjects → Chapters → Topics).
4. Add a Subject "ZZ Physics", a Chapter "ZZ Mechanics", a Topic
   "ZZ Kinematics". Each save reflects in the tree.
```
**Report:** `D1 ok — course + curriculum created`.

### D2. Batches
```
1. Sidebar → "Batches". Create "ZZ Test Batch" under "ZZ Test Course".
   Save → it appears as active.
2. (Create a "ZZ Test Batch 2" too, for the §C11 transfer test.)
```
**Report:** `D2 ok — batch(es) created`.

### D3. Teachers
```
1. Sidebar → "Teachers". List of teacher accounts.
2. Create "ZZ Test Teacher", email zz.test.teacher@example.com. On success a
   temp password is shown ONCE — copy it for §H1.
3. Open the teacher's detail → assign them to "ZZ Test Batch" (and any seed
   batch you want to test against). Save.
4. The assignment shows on the teacher detail.
```
**Report:** `D3 ok — teacher created + assigned to batch`.

---

## §E — Operational admin pages (spot-check each renders + one action works)

> These pages were each fully tested in their own phase. Here you only
> confirm they still load against the live DB and one core action works.

### E1. Attendance matrix
```
1. Sidebar → "Attendance". A student × session matrix renders for a chosen
   batch/date range.
2. Click one attendance cell → a correction modal lets you set
   Present/Late/Absent with a reason. Apply it to a ZZ Test student's cell.
   The cell updates.
3. Click "Export CSV" → a CSV downloads (timestamps in IST).
```
**Report:** `E1 ok — matrix + single-cell correction + CSV`.

### E2. Content moderation
```
1. Sidebar → "Content". A list of study materials (videos + PDFs) with
   filter/search + a publish toggle.
2. Toggle publish on a ZZ Test item (or any test item) off→on; the badge
   flips. (Don't unpublish real content.)
3. "Export CSV" downloads.
```
**Report:** `E2 ok — content list + publish toggle`.

### E3. Quizzes
```
1. Sidebar → "Quizzes". List with filters + a publish toggle + archive +
   delete (delete opens a confirm modal — Cancel it).
2. Confirm a seeded/ZZ quiz row shows its status pill.
```
**Report:** `E3 ok — quizzes list renders`.

### E4. Question bank
```
1. Sidebar → "Question bank". List of MCQ questions with filters + CSV.
2. Confirm rows render with prompt + topic.
```
**Report:** `E4 ok — question bank renders`.

### E5. Exams
```
1. Sidebar → "Exams". List with status pills (Draft/Scheduled/Live/Closed/
   Released), Force-release/Publish/Delete actions, IST start column.
2. Open the Delete modal on any row → Cancel it (don't delete).
```
**Report:** `E5 ok — exams list + pills + delete modal cancels`.

### E6. Offline scores
```
1. Sidebar → "Offline scores". Paper-test scores list, filterable by batch,
   with CSV export.
2. Confirm rows render (run the exam seed if empty).
```
**Report:** `E6 ok — offline scores render`.

---

## §F — Audit log + Admins management (Phase-12 headline features)

### F1. Audit log viewer
Sign in as owner. Sidebar → "Audit log" (last nav item). Title "Audit log"
with a "<N> events recorded" subline.

```
F1a — Table:
1. A table with columns When · Actor · Action · Entity · (Details).
2. The actor shows a NAME (resolved from app_users) with the role beneath
   it; system rows show "system".
3. Rows are newest-first.

F1b — Filters (the filter bar above the table):
1. "Actor role" dropdown → pick "owner admin" → Apply. Only owner-admin
   actions show.
2. "Action" text box → type "create_user" → Apply. Only create-user rows
   show. Clear.
3. "Entity table" text box → type "app_users" → Apply. Only app_users rows
   show. Clear.
4. "From" + "To" date pickers → set a narrow range (e.g. today only) →
   Apply. Rows outside the range disappear.
5. Click "Clear" → all filters reset, full list returns.

F1c — Pagination:
1. If there are more than ~50 events, a "Page X of Y" line + "← Prev" /
   "Next →" buttons appear at the bottom.
2. Click "Next →" → page 2 loads (older rows). "← Prev" goes back.
   (On page 1, "← Prev" is greyed/disabled; on the last page "Next →" is.)

F1d — Details dialog (before/after JSON):
1. Click "Details" on any row that changed data (e.g. a create_user or a
   suspend_user row).
2. A dialog opens titled "<action> · <entity>". It shows:
      Actor, Role, When, Entity ID, IP, User agent (a metadata grid), and
      TWO code panels side by side: "Before" (reddish) + "After" (greenish)
      showing the JSON snapshots. For a create, Before = "—" and After =
      the new record.
3. Close the dialog.

F1e — Export page (CSV):
1. Click "Export page (CSV)" (top-right above the table).
2. A file "audit-YYYY-MM-DD.csv" downloads with header
   occurred_at,actor,actor_role,action,entity_table,entity_id,ip_address
   and one row per row currently shown on this page.
```
**Report:** `F1 ok — table + filters + pagination + before/after dialog + CSV`
(or which sub-step failed).

### F2. Admins — create a staff admin (owner-only)
Sign in as owner. Sidebar → "Admins". Title "Admins", subtitle "Owner-only.
<N> admin accounts."

```
F2a — Create:
1. Click "+ New admin". A form appears: Full name, Email, Phone (optional),
   Role (dropdown defaulting to "Staff admin").
2. Fill: "ZZ Test Admin", zz.test.admin@example.com, leave Role = "Staff
   admin". Submit.
3. A green panel shows the credentials ONCE: Email, Temp password (mono,
   with a Copy button), Role. COPY THE PASSWORD — you need it for F2c/F3.
4. Click "Done".

F2b — List updates:
1. The admins table now lists "ZZ Test Admin" with:
      a "Staff admin" role badge (grey),
      status "Active" (green),
      its created date.
2. The OWNER row (you) shows a violet "Owner admin" badge and a small "You"
   tag next to your name.

F2c — Forced password change at first login (admin):
1. Sign out of the owner session.
2. Sign in as zz.test.admin@example.com with the temp password.
3. (No TOTP enrolled yet → you may be routed to enroll 2FA, OR straight to
   a "you must change your password" screen — either way you CANNOT reach
   the dashboard with the temp password still active.)
4. Set a new password → it's accepted and you proceed.
```
**Report:** `F2 ok — staff admin created, creds shown once, role badge + You tag, forced PW change`.

### F3. Staff admin is BLOCKED from /admins
```
1. Still signed in as the ZZ Test staff admin (from F2c).
2. Look at the sidebar — there is NO "Admins" entry (it's owner-only).
3. Manually type the /admins URL in the address bar → you are redirected
   AWAY (to /forbidden, the 403 page). You do NOT see the admins list.
4. Confirm the staff admin CAN still see the operational pages (Students,
   Teachers, Batches, etc.).
5. Sign out. Sign back in as owner for any remaining admin work.
```
**Report:** `F3 ok — staff admin can't reach /admins (redirected), sidebar hides it`.

---

# PART 2 — MOBILE APP (real phone)

> Do the §0.3 clean restart first (Expo Go). The student bottom tab bar has
> **6 tabs**: Home · Classes · Library · Attendance · Ranks · Profile.
> The teacher bar has **8 tabs**: Home · Scan · Classes · Library ·
> Quizzes · Exams · Batch · Profile.

## §G — Student full journey

> Use the student you created in §C3 ("ZZ Test Student One") with its temp
> password to exercise the forced change in G1. For the rich data screens
> (dashboard widgets, quiz, exam, leaderboard, mastery, badges), the
> fastest path is to run the relevant seeds (0.2) and sign in as a seed
> student — those accounts skip the forced-change and already have streaks,
> ranks, badges, quizzes and exams set up.

### G1. First login + forced password change
```
1. Open the app → Login screen. Enter ZZ Test Student One's email + the
   TEMP password from §C3. Submit.
2. You are routed to "Change password" (you cannot reach the app yet).
3. Enter a new password (twice if asked) → submit.
4. You land on the student Home tab.
```
> iOS note: the very first sign-in on iOS Expo Go can take a few seconds
> after the spinner (the session is written to the Keychain) — wait, don't
> tap repeatedly.
**Report:** `G1 ok — temp login forces change, lands on Home`.

### G2. Home dashboard widgets
(Sign in as a **leaderboard/dashboard seed** student — e.g. "Topper" — for
populated widgets.)
```
1. Top-left avatar (initials) · centered FyneStudy logo · bell icon.
2. Greeting "Good <morning/afternoon/evening>, <name>." with a STREAK FLAME
   pill top-right showing a number + "days" (orange for a 7-day streak,
   grey for 0).
3. A "Next" card (next class / continue item).
4. A stats strip with THREE pills: Attendance % · Mastery % · Rank. The
   "Rank" pill shows "#N" (not "—") for a ranked seed student; tapping it
   opens the Ranks screen.
5. "Today's schedule" strip.
6. "Weak topics" list (lowest-mastery topics).
7. "Recent badges" strip with small coloured badge chips.
8. Pull down to refresh → spinner, data reloads.
```
**Report:** `G2 ok — greeting, flame, stats(Rank=#N), schedule, weak topics, badges`.

### G3. Classes — Live / Upcoming / Recorded
(Run `pnpm seed:live-manual-test --reset` and sign in as its student for
populated segments — it seeds a LIVE, an UPCOMING, and an ENDED/recorded
session on a real public video, no OBS needed.)
```
1. "Classes" tab → title "My Classes", subtitle "Live sessions, recordings
   and graded exams."
2. A segmented control: Live | Upcoming | Recorded, each with a count.
3. "Live" tab: a live session row with a red "● Live" pill. Tap it → opens
   the live class screen (player + chat). (Full live UX = §H4.)
4. "Upcoming" tab: a scheduled session row. Tap → opens the lobby/countdown.
5. "Recorded" tab: an ended session with a violet "Watch" pill. Tap → the
   recording plays in the wrapped YouTube player.
6. Below the segments: an "Exams" section listing the batch's exams with
   status (Live now / Scheduled / Submitted / Score N/M).
```
**Report:** `G3 ok — Live/Upcoming/Recorded segments + Exams section`.

### G4. Library — play a video + open a PDF
(Run `pnpm seed:content-manual-test` for content.)
```
1. "Library" tab → a Subject list with a search box at the top.
2. Tap a Subject → Chapters; tap a Chapter → Topics; tap a Topic → Items.
   A back chevron walks you up the levels.
3. Tap a VIDEO item → the wrapped YouTube player opens. The visible play
   button appears; tap it → it plays with audio. (A Resume sheet appears if
   you've watched >10s before.) Back out → player UNMOUNTS (audio stops).
4. Tap a PDF item → it opens in the in-app PDF viewer; you can scroll AND
   pinch-zoom; a faint watermark with your identity is visible. Back out.
5. Type in the search box → the tree filters to matching items.
```
**Report:** `G4 ok — drill-down nav, video plays + unmounts on back, PDF scroll+zoom+watermark`.

### G5. Attendance — QR rotates ~30s
```
1. "Attendance" tab. Top shows an attendance ring/% + today's sessions.
   For a session whose window is OPEN, a "Scan now" badge shows and a
   ROTATING QR CODE is displayed.
2. Watch the QR for ~35 seconds: it REGENERATES roughly every 30s (the
   pattern visibly changes). This is the student's identity QR that the
   teacher scans.
3. A "History" view lists past sessions with Present/Late/Absent.
```
> The actual present-mark happens when the TEACHER scans this QR — see §H2,
> which verifies it lands in realtime.
**Report:** `G5 ok — attendance ring + QR rotates ~30s + history`.

### G6. Take a quiz end-to-end (incl. KaTeX math)
(Run `pnpm seed:quiz-manual-test --reset` and sign in as its student. The
quiz lives in the Library at the topic level, or via the dashboard's weak
topics.)
```
1. Open the seeded quiz → an intro screen (title, # questions, rules) →
   tap Start.
2. The attempt UI loads with a question + options. At least one question
   renders MATH via KaTeX (e.g. a fraction / superscript / symbol shows as
   properly typeset math, NOT raw "\frac{...}" text).
3. Answer questions; use the question-grid to jump; toggle a flag.
4. Auto-save happens silently as you answer.
5. Submit → a result screen shows your score; "View solutions" shows the
   correct option highlighted green and your wrong picks red, with
   explanations.
6. Confirm there is a "Retake" path (you can re-attempt a practice quiz).
```
**Report:** `G6 ok — quiz intro→attempt→result→solutions, KaTeX renders`.

### G7. Take an exam end-to-end (server timer + tab-switch warning)
(Run `pnpm seed:exam-manual-test --reset`; sign in as Student A1. Use the
LIVE exam "Mechanics Live" or the instant "Instant Reveal".)
```
1. Home dashboard → "Exams" section (or Classes → Exams) → tap a LIVE exam.
2. Pre-attempt screen: rules card + a "● Live now" indicator + an enabled
   "Enter Exam" button (a SCHEDULED exam shows a ticking countdown +
   DISABLED button instead).
3. Tap "Enter Exam" → locked-down attempt UI with NO bottom tab bar, and a
   TIMER PILL top-right counting DOWN every second.
4. Background the app for ~20s, return → the timer is now ~20s LOWER (it's
   anchored on the server, not paused), AND an amber banner appears at the
   top: "⚠ You left the app. Switches: 1". Repeat → "Switches: 2", and at
   3 the banner turns RED with a "may be reviewed by your teacher" note.
5. Answer questions, then tap the green Submit pill → a confirm modal →
   Submit.
6. INSTANT-release exam → you immediately see a score + "View Solutions".
   MANUAL-release exam → you see a "Submitted — results will be released by
   your teacher" screen (teacher releases in §H6).
7. Re-open a submitted manual exam → it lands straight on "Submitted", NOT
   a fresh attempt.
```
**Report:** `G7 ok — pre-attempt, server timer counts down across background, tab-switch banner escalates, submit→result/submitted`.

### G8. Leaderboard + Ranks + public card
(Sign in as a leaderboard seed student, e.g. "Topper".)
```
1. "Ranks" tab (trophy icon) → header "Leaderboard" + batch name.
2. Segmented control "Weekly" | "All-Time".
3. A "YOUR RANK" hero card: "#N / total" + a composite score.
4. A ranked list: 🥇🥈🥉 for top 3, "#4/#5/…" below; YOUR row is
   highlighted and reads "You". Other rows show name + last-2 phone digits
   + composite. NO email/DOB anywhere.
5. Tap another student's row → a public card pops: initials, name, batch,
   a flame + streak, and earned-badge chips. NO PII (email/phone/dob).
   Close it.
6. "How is this calculated?" → a sheet explaining 60% scores / 25% activity
   / 15% streak. Close.
7. Tap "All-Time" → list reloads.
```
**Report:** `G8 ok — hero rank, medals, public card (no PII), calc sheet, All-Time`.

### G9. Profile — Mastery + Badges + streak modal
```
1. "Profile" tab → header "My Profile", avatar + name + email.
2. A 3-way segmented control: Profile | Mastery | Badges.
3. "Profile": read-only Account (name/email/phone/dob, each with a lock
   icon) + Academic (batch/course) + a note that identity fields are
   read-only; an Actions card (Change password, Contact admin); and a red
   "Sign out" button at the bottom.
4. "Mastery": a weakest-first list of per-topic mastery bars.
5. "Badges": "Badge collection — N of 11 earned"; a 3-column grid of 11
   badges — earned ones are full colour, locked ones are dimmed with a lock.
   Tap a LOCKED badge → a "How to earn" hint card. Tap an EARNED badge →
   "✓ Earned <date>".
6. Back on Home, tap the streak flame → a "Your streak" modal: big flame,
   current + best streak, a 30-day heatmap, and a "badges earned during
   this streak" section.
```
**Report:** `G9 ok — Profile/Mastery/Badges tabs, badge grid earned vs locked, streak modal heatmap`.

### G10. Log out
```
1. Profile tab → scroll down → red "Sign out" button → tap it.
2. You're returned to the Login screen. Re-opening the app does NOT auto-log
   you back in.
```
> The student bar no longer carries a separate "Menu" tab; Profile is the
> sole settings/sign-out surface (Change password / Contact admin /
> Sign out).
**Report:** `G10 ok — Profile → Sign out returns to Login`.

---

## §H — Teacher full journey

> Sign in as the teacher you created in §D3 (forces a password change on
> first login, just like §G1), or a seed teacher. Confirm the 8-tab bar:
> Home · Scan · Classes · Library · Quizzes · Exams · Batch · Profile.

### H1. First login + dashboard
```
1. Log in with the teacher's temp password → forced password change →
   land on the teacher Home.
2. Home: "Hi, <name>" + today's date; a blue "Next" card with a "Take
   Attendance" button (if a session is upcoming/live); a "Pending" list;
   "Today's classes"; a "Quick actions" row (Scan QR · New exam · Upload);
   and a "My batches" list with student counts.
```
**Report:** `H1 ok — forced change, teacher dashboard renders`.

### H2. Scan a student QR → attendance marks in realtime
(Two devices: this teacher on one, a STUDENT of the same batch on another
showing their Attendance QR — §G5.)
```
1. Teacher "Scan" tab → the camera opens (grant camera permission if asked;
   a denied-permission fallback message shows if you decline).
2. Point it at the student's rotating QR (from §G5, on the other phone).
3. A success confirmation appears for the scanned student.
4. WITHOUT refreshing: on the STUDENT'S phone, that session's badge flips to
   "Present" in REALTIME (within a second or two). Also check the teacher's
   roster (§H7) — the student shows Present.
```
> Single-device alternative: skip this and verify the mark via the teacher
> roster (§H7) manual mark-up instead.
**Report:** `H2 ok — scan succeeds, student flips to Present in realtime`.

### H3. Classes + Schedule-Live FAB
```
1. Teacher "Classes" tab → segmented Today/Upcoming/Past sessions + a
   floating "Schedule Live" button (FAB).
2. Tap the FAB → a "Schedule Live" sheet: pick batch (defaults sensibly),
   subject, date/time. Create a "ZZ Test Live" session a few minutes out.
3. It appears in the list.
```
**Report:** `H3 ok — Schedule-Live sheet creates a session`.

### H4. Live control + RTMP copy buttons (OBS dry-run is OPTIONAL)
```
1. From a live/upcoming session you teach, open its live-control screen
   (or Classes → the session → control).
2. "Stream setup": a card shows "Server (RTMP URL)" + "Stream key", each
   with a "Copy" button, plus a "Copy Server + Key" button (it bundles both
   for pasting into a message to your laptop).
3. Tap "Copy" on the Server row → it flips to "Copied" briefly. Same for
   the key, and for "Copy Server + Key".
4. There's a red "Go Live" button. Tapping it (without OBS) still flips the
   session live so you can test the in-app CHAT, raise-hand queue, and
   message moderation (long-press a chat message → Delete / Mute), plus the
   "Pin an announcement" composer. "End class" stops it.
```
> **Full OBS broadcast dry-run is OPTIONAL / hardware-gated.** It needs OBS
> on a laptop streaming to the copied RTMP server+key, and YouTube
> provisioned. If you do it: students in §G3 "Live" should see your real
> video. Mark it "skipped — no OBS" if you don't run it.
**Report:** `H4 ok — RTMP/key copy buttons work, Go Live + chat/moderation/pin work (OBS: ok / skipped)`.

### H5. Content upload — video URL + PDF
```
1. Teacher "Library" tab → an upload screen.
2. Add a VIDEO by URL: paste a YouTube URL, set subject/chapter/topic, save
   → it appears (and shows in the student Library after publish, §G4).
3. Add a PDF: pick a small PDF from the phone → it presigns + uploads +
   finalizes → appears in the list.
```
**Report:** `H5 ok — video-URL + PDF upload both work`.

### H6. Quiz builder
```
1. Teacher "Quizzes" tab → list + "+ New". Create a "ZZ Test Quiz": pick a
   topic via the cascading picker, add a question inline OR "Add from bank",
   save/publish.
2. It appears in the list and (after publish) for students.
```
**Report:** `H6 ok — quiz builder creates + publishes`.

### H7. Exam builder + results release + regrade
```
1. Teacher "Exams" tab (8th-ish tab, clipboard-check icon) → list + "+ New"
   + an "Offline" pill.
2. Build "ZZ Test Exam": Basics (title/batch/start/duration), Marking
   (+correct/−wrong/skip + randomize switches), add questions from the
   bank, Save Draft → re-open → Publish.
3. After a student has submitted (from §G7), open that exam's "Results"
   screen: roster of submissions (score, correct/wrong/skipped, auto-submit
   + tab-switch badges) + per-question analysis bars.
4. Tap "Release Results to Students" → confirm → status flips to released;
   the student now sees their score + solutions (re-check §G7 step 6).
5. Tap "Regrade" on a question → pick an action (change correct / mark all
   correct / mark no correct), enter a REQUIRED reason, Apply → "N attempts
   recomputed"; roster scores visibly change.
```
**Report:** `H7 ok — builder + release + regrade re-scores`.

### H8. Roster mark-up (manual attendance)
```
1. From a session (e.g. Classes → a Past/Today session → its roster, or the
   Take-Attendance flow), open the roster.
2. Tap a student's pill to cycle/set Present/Late/Absent; tapping the active
   mark again sets it back to unmarked. A correction sheet captures a reason
   where needed.
3. The mark persists (re-open the roster → it's still set).
```
**Report:** `H8 ok — roster manual marks persist`.

### H9. Batch detail — heatmap / mastery / at-risk
```
1. Teacher "Batch" tab (or Home → a batch card) → the batch detail.
2. "Batch analytics" → tabs including Risk / mastery / attendance heatmap.
3. "Risk" tab: students with composite score < 0.40 (red composite pills +
   "Mastery X% · Attendance Y%"). The heatmap shows attendance density; a
   topic-mastery section shows per-topic bars.
```
**Report:** `H9 ok — batch heatmap + mastery bars + at-risk list`.

### H10. Teacher profile + sign out
```
1. "Profile" tab → teacher profile + a sign-out action.
2. Sign out → returns to Login.
```
**Report:** `H10 ok — teacher profile + sign out`.

---

## §I — Cross-cutting & low-end device

> Run §I on the Redmi 8A where the row says "Redmi". If no Redmi is
> available, run on the flagship/iPhone and mark Redmi rows "skipped".

### I1. Cold start ≤ 3s (Redmi 8A)
```
1. Force-quit the app fully.
2. Cold-open it (Play build preferred; Expo Go cold start includes the JS
   download so use the Play build for a true number).
3. Time from tap to the first interactive screen (Login or Home).
```
**Expected:** ≤ 3 s on Redmi 8A (Play build).
**Report:** `I1: cold start <N>s on <device>` (or "skipped — no Redmi").

### I2. Screen transitions ≤ 200ms
```
1. Tap between bottom tabs (Home↔Classes↔Library↔Ranks↔Profile).
2. Open + back out of a couple of stack screens (a quiz, a library item).
```
**Expected:** transitions feel instant; no visible >200ms jank on Redmi.
**Report:** `I2: transitions snappy / janky on <screen>`.

### I3. Only ONE WebView mounted; unmounts on blur
```
1. Open a library VIDEO (WebView/YT player) → it plays.
2. Navigate Back (or to another tab) → the audio STOPS (player unmounted).
3. Open a PDF, then a live class — at no point should two players be
   audible at once.
```
**Expected:** exactly one WebView alive at a time; leaving a player screen
unmounts it (audio stops, memory released).
**Report:** `I3 ok — single WebView, unmounts on blur`.

### I4. Airplane-mode recovery
```
1. While viewing a data screen (e.g. dashboard or an exam attempt), enable
   airplane mode.
2. The app shows cached state and doesn't crash; an error/retry appears
   where it tries to fetch.
3. Disable airplane mode → pull-to-refresh (or the screen auto-refetches on
   focus) → data returns. Mid-attempt exam auto-save flushes the queued
   answers once back online.
```
**Report:** `I4 ok — survives airplane mode, recovers on reconnect`.

### I5. Dark / light mode
```
1. Switch the phone's system theme (Settings → Display → Dark) while the
   app is open, and reopen the app.
```
**Expected:** the app remains LEGIBLE and consistent (the product is a
light-themed design; confirm nothing becomes unreadable, e.g. white text on
white). Note any contrast bugs.
**Report:** `I5 ok — readable in dark + light` (or list contrast issues).

### I6. Reduce-motion
```
1. Enable the OS "Reduce Motion" accessibility setting.
2. Re-open the app; trigger an animated surface (e.g. the badge celebration
   confetti on the dashboard, or the streak heatmap pulse).
```
**Expected:** animations are minimised/disabled and the app stays usable
(no motion-sickness-grade movement, nothing gets stuck).
**Report:** `I6 ok — reduce-motion respected`.

---

## §J — Sign-off ledger

> Fill one row per section, per device you ran it on. Add extra rows if you
> run the same section on multiple devices. The product is cleared to ship
> only when every section reads **Pass** on its target device(s).

| Section | Device | Pass / Fail | Notes | Tester | Date |
|---|---|---|---|---|---|
| 0.3 Metro clean restart | | | | | |
| A — Admin auth & security | | | | | |
| B — Overview dashboard | | | | | |
| C — Students (incl. bulk import) | | | | | |
| D — Teachers / Batches / Courses / Curriculum | | | | | |
| E — Operational admin pages | | | | | |
| F — Audit log + Admins | | | | | |
| G — Student full journey | | | | | |
| G — Student journey (iPhone) | | | | | |
| G — Student journey (Redmi 8A) | | | | | |
| H — Teacher full journey | | | | | |
| H — Teacher journey (iPhone) | | | | | |
| I — Cross-cutting & low-end device | Redmi 8A | | | | |
| I — Cross-cutting (flagship) | | | | | |
| Cleanup (§0.5) done? | n/a | | | | |

**Final ship decision:** ☐ All sections Pass → cleared for Play internal
testing.  ☐ Blocked — see Fail rows above.

---

### How to report a failure
For any **Fail**: paste the section + step number, what you saw vs. what was
expected, a screenshot if it's visual, and the relevant log line (Metro for
mobile, the browser console / Vercel log for admin, or the Supabase
Edge-function log). That's enough to diagnose and patch before sign-off.
