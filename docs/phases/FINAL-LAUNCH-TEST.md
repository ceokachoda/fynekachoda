# FyneStudy — Final Pre-Launch Test (complete beginner guide, A → Z)

> **What this is.** The single test you run **right before you publish to the Play Store**. It
> covers every critical feature across all phases (1–12). If everything here passes on a real
> Android phone, the app is safe to ship.
>
> **Written for a complete beginner.** Every step says exactly what to type, tap, and what you
> should see. Don't skip **Part A (Setup)** — that's where people get stuck.
>
> **Time:** Setup ≈ 30–45 min (mostly waiting for the build). Tests: Fast path ≈ 30 min, Full ≈ 90 min.
>
> 🔒 **About passwords:** this file lives on **public GitHub**, so it does **NOT** contain real
> passwords. Your actual logins are in **two private files on your computer** (not on GitHub):
> **`CREDENTIALS.local.md`** and **`APK-TEST-GUIDE.local.md`**, both in your project root folder.
> Open them in any text editor when a step asks for a login.
>
> **The admin-panel test is a separate file:** **`docs/phases/ADMIN-PANEL-TEST.md`** (do it as §9 below).

---

## Phase coverage map (nothing is missed)

| Phase | Feature | Tested in |
|---|---|---|
| 1–3 | Accounts, login, roles | §1 + the Admin test |
| 4 | Attendance (QR + scan) | §2 |
| 5 | Library (video + PDF) | §3 |
| 6 | Practice quizzes | §4 |
| 7 | Exams (graded, timed) | §5 |
| 8 | Dashboards | §6 |
| 9 | Live classes | §7 |
| 10 | Leaderboard + badges | §8 |
| 11 | *Parents' WhatsApp report* | **Skipped by design — not built, not tested** |
| 12 | Admin web panel | **`ADMIN-PANEL-TEST.md`** (§9) |

---

# PART A — SETUP (read this fully first)

## A1. What you need
- **A real Android phone** (this is what your students use — top priority).
- **A second phone** for just 2 tests (QR scan in §2, live chat in §7). An old iPhone works. *(Optional — skip those two if you only have one phone.)*
- **A computer** with your project folder open, plus a **browser (Chrome)** for the admin test.
- **An authenticator app** on your phone (Google Authenticator or Authy) — for the admin panel only.
- *(Optional, only for the real live-stream test §7-C)* **OBS** installed on the computer.

## A2. Where your logins live (open these two files on your computer)
| File (in your project root) | What's inside |
|---|---|
| **`CREDENTIALS.local.md`** | §1 = **Owner** login for the admin panel (email + password + you add a 2FA code). §2 = the **reviewer** mobile logins. |
| **`APK-TEST-GUIDE.local.md`** | All 4 ready **mobile** logins (1 teacher + 3 students, all in "Batch A") that sign straight in — no password change. |

> These accounts are already set up and **never expire**. You'll use them for most tests. When a
> step says "log in as the teacher / Student 1 / owner", get the exact email + password from these files.

## A3. Two kinds of test data — and the easy way to get fresh data
Some features need sample data (a class happening *now*, quizzes, etc.). You have two paths:

**🟢 Easiest (recommended): ask me to set it up.** Right before you test, tell me
**"set up fresh test data for my final test"** and I'll seed a complete, current dataset
(live class now, open attendance, quizzes, exams, leaderboard) and hand you the exact logins.
Then you skip all the terminal/seed steps below and just run the tests.

**🔵 Or do it yourself** with the seed commands in **A5**. This is fully documented so you're not
dependent on me — but it's the fiddly part, so only do it if you prefer.

What's **already there** (no setup needed) in **Batch A** with the accounts from `APK-TEST-GUIDE.local.md`:
- ✅ **Login, Library (4 real playable videos), a Recorded class, Dashboard, Profile** — work anytime.
- ⏳ **Live class, Attendance "open now", Quizzes, Exams, Leaderboard** — these are *time-based* or
  weren't seeded, so they need fresh data (path 🟢 or 🔵).

## A4. How to open a terminal in your project folder (Windows)
1. Open the **`FyneStudyLive`** folder in File Explorer.
2. Click the address bar, type **`powershell`**, press **Enter**. A blue PowerShell window opens
   already pointing at the project. *(Or: in VS Code, menu **Terminal → New Terminal**.)*
3. You type the commands below into this window and press **Enter**.

## A5. How to run a seed (the self-service data path) — IMPORTANT details
Seeds write sample data to your live database and **print the test logins at the end** — you
**copy those from the terminal** (their passwords change every run, so they're not written here).

**⚠ One-time fix per terminal window — set your owner password.** The seeds log in as the owner
to create accounts, and they default to an old password. Paste this first (replace the password
with your **real owner password from `CREDENTIALS.local.md` §1**):
```powershell
$env:OWNER_INITIAL_PASSWORD="PASTE_YOUR_OWNER_PASSWORD_HERE"
```
*(If you skip this and a seed says it can't sign in as owner, this is why.)*

Then run the seed you need:
| Feature | Command (run in PowerShell) | Time-sensitive? | Re-run safe? |
|---|---|---|---|
| Attendance | `pnpm seed:manual-test` | **Yes** — open class lasts ~2 h | adds new each run |
| Library | `pnpm seed:content-manual-test` | No | adds new each run |
| Quizzes | `pnpm seed:quiz-manual-test --reset` | No | `--reset` clears old |
| Exams | `pnpm seed:exam-manual-test --reset` | **Yes** — short exam ~5 min, long ~30 min | `--reset` clears old |
| Dashboard | `pnpm seed:dashboard-manual-test --reset` | Partly — "next class" card ~20 min | `--reset` clears old |
| Live class | `pnpm seed:live-manual-test --reset` | **Yes** — "upcoming" lobby ~12 min | `--reset` clears old |
| Leaderboard | `pnpm seed:leaderboard-manual-test --reset` | No | `--reset` clears old |

After it runs, scroll up in the terminal to the **"READY / Summary"** box and **copy the printed
`Email:` / `Password:` lines** for the accounts you'll use. Run **time-sensitive** seeds **right
before** you test that section; if you run long, just run the command again.

## A6. How to run a SQL snippet (needed only for Library video + Quiz math)
Two tests need one quick database tweak each. Here's how to run SQL:
1. Open **https://supabase.com/dashboard** in your browser and sign in.
2. Click your project (**fynestudy-dev**).
3. Left sidebar → **SQL Editor** → **+ New query**.
4. Paste the snippet → click **Run** (or press Ctrl+Enter). You should see **"Success"**.

- **For the Library video test (§3):** makes one video actually playable.
  ```sql
  update public.content_items
     set yt_video_id = 'dQw4w9WgXcQ', duration_sec = 213
   where title = 'Intro to Projectile Motion (Batch A only)';
  ```
  *(Only needed if you used the `content` seed; the ready Batch A videos already play, so you can skip this.)*
- **For the Quiz math test (§4):** makes one quiz question contain math so you can check it renders.
  ```sql
  update public.questions
     set prompt_md = 'Solve $x^2 - 4 = 0$ for $x$.'
   where prompt_md = 'What is the SI unit of acceleration?';
  ```
  *(Run this after the `quiz` seed.)*

## A7. Build the test app and put it on your phone (~20–30 min, mostly waiting)
> Test the **preview** build — it's the real, fast app your users get. *(Don't judge smoothness on
> the slow "development" build.)*

1. **Log in to Expo once** (in PowerShell): `npx eas-cli login` → enter your Expo account email + password.
2. **Start the build:** `eas build -p android --profile preview`
   - If it asks **"Generate a new Android Keystore?"** press **Y**.
   - It builds on Expo's servers (~10–20 min + queue). You can watch progress at **expo.dev →
     fynestudy → Builds**. *(Or just tell me **"build it"** and I'll start + watch it for you.)*
3. **Install on the phone:** when it's done you get a **link/QR** — open it **on the phone** →
   **Download** → open the `.apk` → Android warns "unknown source" → **Settings → allow once →
   Install** → open **FyneStudy**.

✅ **Setup done when** the app opens to a **Login** screen.

**Alternative (no build) — Expo Go developer mode:** run `pnpm dev:mobile -- --clear`, open **Expo
Go**, scan the QR. ⚠ Only for Expo Go: before each session stop it (Ctrl+C), **force-quit Expo Go**
(swipe its card away), re-run `pnpm dev:mobile -- --clear`, scan again, and confirm the terminal
shows `(NNNN modules)` in the **thousands** (not `(1 module)`) — otherwise you're seeing the old app.

---

# ⏱ FAST PATH (the 30-minute must-pass core)
If short on time, do: **T1, T2, T5, T7, T9, T11, the whole Admin test (§9), T16.** That proves a
student can log in and use the core learning loop, and the admin control room works.

---

# PART B — THE TESTS

> How to switch roles: **Profile tab → scroll down → Sign out**, then log in as the other account.
> **Student tabs:** Home · Classes · Library · Attendance · Ranks · Profile.
> **Teacher tabs:** Home · Scan · Classes · Library · Quizzes · Exams · Batch · Profile.

## §1 — Login & accounts  *(Phases 1–3)* — PHONE

### `[ ]` T1 — Logged-out shows Login · student lands home · admin is bounced out
*Accounts: reviewer student + owner (from `CREDENTIALS.local.md`).*
1. Open the app. If someone is signed in, sign out (Profile → Sign out).
2. **(a)** Confirm the first screen is **Login** (logo + Email + Password). No dashboard flashes.
3. **(b)** Log in as the **reviewer student** → you reach **Home** (6 tabs).
4. **(c)** Sign out. Log in with the **owner** email + password.

**Expected:** (a) opens on Login; (b) student → Home; (c) the admin briefly shows a spinner then is
**sent back to Login** — it must never reach a dashboard or show an "Admin account" card (admins use
the browser panel, not the phone).
**Gotcha:** First iOS sign-in can take a few seconds — wait, don't tap repeatedly. A weak connection
may show a neutral "We couldn't load your account · Try again" screen — that's correct, not a bug.

### `[ ]` T2 — First-login forced password change
*Account: a brand-new student you create in the Admin test (§9 / ADMIN-PANEL-TEST.md → "Create a student") with its one-time temp password.*
1. Log in with the new student's email + temp password.
2. You're forced to a **Change password** screen → set a new password.
3. Sign out, sign back in with the **new** password.

**Expected:** The change screen appears the first time only; afterward you go straight to Home.

## §2 — Attendance  *(Phase 4)*
*Data: ask me to "refresh test data", or run `pnpm seed:manual-test` (A5) and copy the printed Teacher + Student logins.*

### `[ ]` T3 — Student shows a live rotating QR — PHONE
1. Sign in as the attendance **Student** → **Attendance** tab.
2. Watch the QR + the "Refreshes in NNs" countdown for ~30 seconds.

**Expected:** A QR shows; at ~30s it **visibly changes** and the countdown resets.
**Gotcha:** If there's no class in its window now, you'll see "No live class right now" — that's
correct; re-seed (or ask me) for a fresh open class.

### `[ ]` T4 — Teacher scans student's QR  *(TWO DEVICES — most important attendance test)*
1. **Phone B (Student):** Attendance tab → QR showing.
2. **Phone A (Teacher):** sign in as the Teacher → **Scan** tab → **Allow** camera.
3. Point Phone A at Phone B's QR.

**Expected:** Within ~1s Phone A buzzes, flashes **green**, shows "✔ &lt;name&gt; — Marked present";
Phone B flips to **Present**. Then check refusals: scan the same QR again → **"Already marked"**;
switch the banner to a different class and scan → **"Wrong class"**; screenshot the QR, wait 35s,
scan the screenshot → **"QR expired"**.

## §3 — Library  *(Phase 5)*
*Data: the ready Batch A videos already play — use a `APK-TEST-GUIDE.local.md` student. (For PDFs, see the note.)*

### `[ ]` T5 — Browse + a video plays + watermark + audio stops on back — PHONE
1. Sign in as **Student 1** (Batch A) → **Library** tab.
2. Tap **Physics → Mechanics → Kinematics** → tap a **video**.
3. Tap the player to play; watch ~30s; then tap **back**.

**Expected:** Video plays **with sound**, **no YouTube chrome** (no channel name / "Watch on
YouTube" / related grid), with a faint **watermark showing the student's own masked phone**. On
**back, the audio stops immediately**. Re-opening offers **Resume / Start over**.
**Gotcha:** If audio keeps playing after you leave, that's a launch blocker.

### `[ ]` T6 — Student sees only their own batch's content
1. Still as Student 1, confirm the Kinematics list shows the Batch-A + course-wide items.
2. *(If you ran the `content` seed:)* sign in as **Student 3 (Batch B)** → the same topic must
   **not** show Batch-A-only items, and unpublished items must never appear.

**Expected:** No student sees another batch's or an unpublished item (security check).
**PDF note (optional):** to test a PDF, log in as the **teacher** → Library → upload a PDF → view
it back as a student. It should render with a tiled watermark; on Android a screenshot is blocked.

## §4 — Practice quizzes  *(Phase 6)*
*Data: run `pnpm seed:quiz-manual-test --reset` (A5) + the math SQL (A6); copy the printed Student A1 login. (Or ask me to seed it.)*

### `[ ]` T7 — Take a quiz end-to-end + no answer leak + math renders — PHONE
1. Sign in as **Student A1** → Library → Physics → Mechanics → Kinematics → **Practice Quizzes** →
   "Kinematics — Easy 4" → **Start Quiz**.
2. Confirm the timer counts **down**; if you ran the math SQL, confirm Q1 shows real typeset math
   (a proper x²), not raw `$...$`.
3. Answer all 4 (correct options end with "(correct)") → **Submit** → **Submit**.
4. On the result, tap **View Solutions**.

**Expected:** Timer counts down; result = "**X / 16**" + a Correct/Wrong/Skipped breakdown
(all-correct = 16/16). Solutions highlight the correct option **green**, yours red/blue, with an
explanation.
**Gotcha (critical):** The correct answer must appear **only on Solutions, after submitting** —
never during the attempt.

## §5 — Exams  *(Phase 7)*
*Data: run `pnpm seed:exam-manual-test --reset` **right before** (short window!); copy printed Student A1 + Teacher logins. (Or ask me to seed it.)*

### `[ ]` T8 — Take a live exam · server timer survives backgrounding — PHONE
1. Sign in as **Student A1** → Home → **Exams** → "Mechanics Live" → **Enter Exam**.
2. Confirm: no bottom tabs, a timer counting down, questions answerable.
3. **Note the timer**, background the app (go to home screen) for **30 seconds**, return.

**Expected:** The timer is now ~**30s less** (it did **not** pause). An amber banner shows
"⚠ You left the app. Switches: 1" (counts each time; red at 3).
**Gotcha (critical):** If the timer pauses while away, or changing the phone clock changes it, that's
a cheating hole = fail.

### `[ ]` T9 — Submit + result release (instant vs manual)
1. Finish & **Submit** "Mechanics Live" → shows **"Submitted — results released by your teacher"** (no score yet).
2. Take "**Instant Reveal**" → on submit it shows the **score immediately**.
3. *(Teacher)* Exams tab → "Mechanics Live" → **Results · Locked** → **Release Results** → confirm.
   Then as Student A1, re-open "Mechanics Live" → the score now shows.

**Expected:** Manual exam stays "Submitted" until released; instant exam reveals on submit;
re-opening a submitted exam never restarts it.

## §6 — Dashboards  *(Phase 8)*
*Data: run `pnpm seed:dashboard-manual-test --reset` **right before**; copy printed A1 + A3 + Teacher. (Or ask me.)*

### `[ ]` T10 — Student home shows real data, and a fresh account doesn't crash — PHONE
1. Sign in as **A1** → Home: confirm an **orange streak flame "7"**, an **"Up next"** card, a 3-pill
   stats strip (Attendance · Mastery · Rank), "Today's schedule", "Weak topics". Tap a stat pill
   and the weak-topic card — each should navigate.
2. Sign out → sign in as **A3 ("Fresh Start", no data)** → Home.

**Expected:** A1 shows real numbers and taps navigate. A3 shows **clean zeros** (0% / 0% / —, grey
flame, friendly "you're on top of every topic") with **no error and no blank screen**.
**Gotcha:** A3 = what a brand-new real student sees on launch day — a crash here breaks every new user.

### `[ ]` T11 — Teacher dashboard + batch analytics
1. Sign in as the **Teacher** → Home → tap a **batch card** → tap the **Risk / Mastery / Attendance** tabs.

**Expected:** Each tab switches instantly with no crash; Risk lists only the genuinely at-risk
student(s); mastery bars + attendance strip render.

## §7 — Live classes  *(Phase 9)*
*Data: run `pnpm seed:live-manual-test --reset` **right before**; copy printed Teacher + Student 1/2. (Or ask me.)*

### `[ ]` T12 — Student joins a live class (in-app) — 1 device
1. Sign in as **Student 1** → **Classes** tab → "Live | Upcoming | Recorded" → tap the red **Live** row.

**Expected:** Video plays, **no YouTube chrome**, with the student's own watermark (hops corners
after ~60s). Backing out stops audio immediately.

### `[ ]` T13 — Chat + raise-hand + moderation — 2 devices (recommended)
1. **Device 2 (Teacher):** Classes → **Live control** on the Physics row.
2. Both send chat messages; Student taps **Raise hand**; Teacher **Resolves** it, **Pins** an
   announcement, **deletes/mutes** a message, then **Ends class** → confirm.

**Expected:** Each action appears on the other device within ~1s; teacher messages show a green
"Teacher" badge; ending shows the student "This class has ended" + "Watch recording".

### `[ ]` T-LIVE-C — Real OBS broadcast (optional — needs OBS) 
*See `docs/phases/phase-9-youtube-setup.md` for the OBS walk-through. Skippable for a first pass; the
in-app flow above already proves chat/moderation work.*

## §8 — Leaderboard + badges  *(Phase 10)*
*Data: run `pnpm seed:leaderboard-manual-test --reset`; copy printed "Topper" login. (Or ask me.)*

### `[ ]` T14 — Ranks render correctly + no private info leaks + badge celebration — PHONE
1. Sign in as **"Topper"** → **Ranks** tab → read the "Your rank" hero + the ordered list → tap
   another student's row (public card) → close → tap **All-Time**.
2. On Home, a **"Badge unlocked"** celebration with confetti should appear → tap **Awesome!** →
   pull-to-refresh (it must not pop again).

**Expected:** Ranks ordered highest→lowest with 🥇🥈🥉 on the top 3 and "You" highlighted. The public
card shows **only** name + batch + streak + badges — **never** email/phone/DOB. The celebration fires
once. Profile → Badges shows earned (color) vs locked (dim), "X of 11 earned".

## §9 — Admin web panel  *(Phases 2–3, 12)* — BROWSER
### `[ ]` T15 — Run the full admin test
👉 Open **`docs/phases/ADMIN-PANEL-TEST.md`** and complete it (owner login + 2FA, create a student &
teacher, attendance, content, audit log, etc.). The student you create there is the one you use for
**T2** above.

## §10 — Smoothness  *(performance)* — PHONE (best on a cheap Android)
### `[ ]` T16 — The app feels smooth
1. Scroll the Library, Leaderboard, and a Roster fast. Open/close a video and a quiz a few times.
   Leave the Attendance QR screen open a minute.

**Expected:** Smooth scrolling (no stutter); screens open with a branded loader (not a frozen white
screen); nothing crashes or overheats after a few minutes.
**Gotcha:** Test on the **preview APK**, not the development build.

---

# PART C — Go / No-Go (minimum bar to publish)
Ship only if all of these are green on a real Android phone (+ Chrome for admin):
- `[ ]` T1 Login + student home + admin bounced out
- `[ ]` T2 Forced password change (admin-created student)
- `[ ]` T4 Teacher scans QR (present + 3 refusals)
- `[ ]` T5 Video plays + watermark + audio stops on back
- `[ ]` T7 Quiz: take, submit, score, no answer leak
- `[ ]` T8 Exam: server timer survives backgrounding
- `[ ]` T10 Student home real data + fresh account doesn't crash
- `[ ]` §9 Admin: owner login + 2FA + create accounts + audit (ADMIN-PANEL-TEST.md)
- `[ ]` T16 App feels smooth

**Recommended too:** T3, T6, T9, T11, T12/T13, T14.

---

# PART D — Cleanup (after testing)
- Tell me **"wipe the test data"** and I'll remove the seeded test students/classes/quizzes while
  keeping your owner account, the reviewer accounts, the course/batch, and the badge catalog.
- Or manually: in the admin panel, **Suspend** any `ZZ Test` accounts you created. Never suspend the
  owner or the real institute data.
- Keep the **reviewer accounts** working until Google approves the app (you give them to Google).
