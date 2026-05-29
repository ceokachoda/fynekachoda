# FyneStudy — Final Pre-Launch Critical Test (A → Z)

> **What this is.** A short, go/no-go test to run **once, right before you publish**. It covers
> only the *critical, launch-blocking* features across all phases (1–12). If everything here
> passes on a real Android phone (and ideally an iPhone), the app is safe to ship. If any
> **critical** box fails, fix it before launching.
>
> **How long.** Fast path ≈ **20–30 min** (the must-pass core). Full pass ≈ **60–90 min**
> (adds Live/OBS + leaderboard + two-device flows).
>
> **Who.** Written for a non-technical person. Every step says exactly what to tap and what
> you should see. Tick each `[ ]` as you go.

---

## Phase coverage map (so nothing is missed)

| Phase | Feature | Tested in |
|---|---|---|
| 1–3 | Accounts, login, roles, admin panel | §1 Auth, §9 Admin |
| 4 | Attendance (QR + scan) | §2 |
| 5 | Library (video + PDF) | §3 |
| 6 | Practice quizzes | §4 |
| 7 | Exams (graded, timed) | §5 |
| 8 | Dashboards (student + teacher) | §6 |
| 9 | Live classes (YouTube/OBS) | §7 |
| 10 | Leaderboard + badges + streak | §8 |
| 11 | *Parents' WhatsApp report* | **Skipped by design — not tested** |
| 12 | Admin web panel + launch prep | §9 |

---

## §0 — Before you start (setup)

### 0.1 Devices
- **At least one** Android phone (this is what your students use, so it's the priority).
- **Ideally two** phones (one acts as **Teacher**, one as **Student**) — needed for the QR scan (§2) and live chat (§7). An iPhone as the second device is fine.
- A **computer with a browser** (Chrome) for the admin panel (§9), and for the optional Live test, **OBS** installed.

### 0.2 Get the app on the phone — pick ONE
- **Recommended — the real build (what your users will get):** build and install the
  internal/preview APK:
  ```
  eas build -p android --profile preview
  ```
  When it finishes, open the link on the phone and install. *(This is the true test — it's
  the minified, fast build. The earlier `development` build is NOT representative; never test
  smoothness on that one.)*
- **Alternative — Expo Go (developer mode):** from the project folder run
  `pnpm dev:mobile -- --clear`, open **Expo Go**, scan the QR.
  ⚠ **Only for Expo Go:** before each session, stop Metro (Ctrl+C), **force-quit Expo Go**
  (swipe its card away — the Home button is not enough), re-run `pnpm dev:mobile -- --clear`,
  reopen Expo Go, scan again, and confirm the terminal shows `(NNNN modules)` in the
  **thousands** (not `(1 module)`). A stale bundle = you're testing the OLD app. *(With the
  installed APK there is no Metro and no restart needed.)*

### 0.3 Get test data
The feature tests need sample data. Fastest way — run these from the project folder
(they write to the live database; the app/APK picks them up automatically):
```
pnpm seed:manual-test                 # attendance (Teacher + Students)  ← expires ~2h
pnpm seed:content-manual-test         # library (video + PDF)
pnpm seed:quiz-manual-test --reset    # quizzes
pnpm seed:exam-manual-test --reset    # exams                            ← time-sensitive
pnpm seed:dashboard-manual-test --reset  # dashboards                    ← "up next" expires ~15m
pnpm seed:live-manual-test --reset    # live classes                     ← goes live ~12m later
pnpm seed:leaderboard-manual-test --reset  # leaderboard (not time-sensitive)
```
> Several seeds print **logins (email + password) — copy them**. The ones marked
> *time-sensitive* must be run **right before** you test that section; if you run long,
> just re-seed and use the new data.

### 0.4 Admin panel + logins
- **Admin panel (browser):** your Vercel admin URL, e.g. `https://fyne-study-app-admin.vercel.app/`
  (exact URL + all real logins are in the git-ignored **`CREDENTIALS.local.md`** at the repo root).
- **Owner login:** `owner@fynestudy.example.com` / `FyneOwner#2026` **+ a 6-digit code** from
  your authenticator app (Google Authenticator / Authy).
- **Reviewer mobile logins:** student `review.student@fynestudy.app` / `ReviewStudent#2026`,
  teacher `review.teacher@fynestudy.app` / `ReviewTeacher#2026` (these skip the
  forced-password-change, so you sign straight in).

### 0.5 Golden rules (true for the whole app)
- **No self-signup** — every account is created by an admin.
- **Both iOS and Android** should pass; Android (a cheap phone) is the priority.
- The **server**, not the phone clock, controls exam/quiz timers and QR validity — changing
  the phone's clock must not cheat anything.
- During a quiz/exam, the **correct answer must never appear** until after you submit.

---

# ⏱ FAST PATH (the 20-minute must-pass core)
If you only do a few, do these: **T1, T2, T4, T6, T8, T13, T14, T15.** They prove a real
student can be created, log in, and use the core learning loop, and that the admin panel
works. Everything else strengthens confidence.

---

## §1 — Auth & login  *(Phases 1–3, 12)* — PHONE

### `[ ]` T1 — Logged-out app shows Login; student lands home; admin is bounced out
**Why critical:** new users must see Login first, and an admin must never get stuck on the
phone (the old confusing "Admin account" card was removed — admins are now sent back to login).
1. Fully close and reopen the app. If anyone is signed in, sign out (**Profile** tab → scroll
   down → red **Sign out**).
2. **(a)** Confirm the first screen is the **Login** screen (logo + Email + Password). No
   dashboard flashes first.
3. **(b)** Log in as the reviewer student (`review.student@fynestudy.app` / `ReviewStudent#2026`).
4. **(c)** Sign out. Now log in with the **owner admin** (`owner@fynestudy.example.com` /
   `FyneOwner#2026`).

**Expected:** (a) opens on **Login**. (b) student reaches **Home** with 6 tabs
(Home · Classes · Library · Attendance · Ranks · Profile). (c) the admin briefly shows a
loading spinner then is **returned to the Login screen** — it never reaches a dashboard and
never shows an "Admin account" card.
**Gotcha:** First iOS sign-in can take a few seconds — wait, don't tap repeatedly. If a weak
connection stops the profile loading, a neutral **"We couldn't load your account"** screen
with **Try again** / **Sign out** appears — that's correct, not a bug.

### `[ ]` T2 — First-login forced password change  *(do together with T13/T14)*
**Why critical:** every admin-issued account must change its temp password before using the app.
1. Log in with a **brand-new student** you created in the admin panel (see T13) using its
   one-time **temp password**.
2. You're sent to a **Change password** screen — set a new password.
3. Sign out, then sign back in with the **new** password.

**Expected:** You're forced to change the password the first time; after that you land on
**Home**, and the change screen does **not** appear again on later logins.

---

## §2 — Attendance  *(Phase 4)*  — needs `pnpm seed:manual-test`

### `[ ]` T3 — Student shows a live rotating QR — PHONE
1. Sign in as the seeded **Student** → tap the **Attendance** tab.
2. Look at the QR panel; note the "Refreshes in NNs" countdown.
3. Wait ~30 seconds without touching the screen.

**Expected:** A QR is shown, the countdown ticks down, and at ~30s the **QR visibly changes**
and the countdown resets.
**Gotcha:** If there's no class in its scan window right now, you'll instead see "No live
class right now" + your next class date — that's correct (re-seed if you want the QR).

### `[ ]` T4 — Teacher scans student's QR → marked present  *(TWO DEVICES — most critical)*
1. **Phone B (Student):** Attendance tab → QR showing.
2. **Phone A (Teacher):** sign in as the seeded Teacher → **Scan** tab → tap **Allow** for camera.
3. Confirm the dark "SCANNING FOR" banner names the correct class.
4. Point Phone A at Phone B's QR.

**Expected:** Within ~1s Phone A buzzes, the frame flashes **green**, and a toast shows
"✔ &lt;Student name&gt; — Marked present"; Phone B's card flips to **Present**.
**Then check the rejections:** scan the same QR again → **"Already marked"**; switch the banner
to a different (upcoming) class and scan → **"Wrong class"**; screenshot the QR, wait 35s, scan
the screenshot → **"QR expired"**. All three must be refused.

---

## §3 — Library  *(Phase 5)*  — needs `pnpm seed:content-manual-test` (run its §0.5 SQL to set a real video id)

### `[ ]` T5 — Student sees only their batch's content
1. Sign in as **Student 1 (Batch A)** → **Library** tab → tap **Physics → Mechanics → Kinematics**.
**Expected:** You see the Batch-A items + the course-wide formula sheet, but **NOT** any
Batch-B item and **NOT** the unpublished "Pending review" item.
**Gotcha:** Seeing another batch's or an unpublished item = a security failure (launch blocker).

### `[ ]` T6 — Video plays, watermark shows, audio stops on back
1. Library → Physics → Mechanics → Kinematics → tap the **video** ("Intro to Projectile Motion").
2. Tap the player to play. Watch ~30s.
3. Tap **back**.

**Expected:** Video plays **with audio** and **no YouTube chrome** (no channel name / "Watch on
YouTube" / related grid); a faint **watermark with the student's own masked phone** is visible.
On **back, the audio stops immediately**. Re-opening the video shows a "Resume / Start over" sheet.
**Gotcha:** If audio keeps playing after you leave the screen, that's a launch blocker.

### `[ ]` T7 — PDF renders with a watermark
1. Library → … → Kinematics → tap the **PDF** ("Kinematics Formula Sheet").
**Expected:** The PDF renders (white pages on a dark background) with a faint diagonal grid of
the student's-own watermark; scrolling moves the page, the watermark stays put; pinch-zoom works.
**Gotcha:** On **Android**, trying to screenshot a PDF is blocked with an OS toast; on **iOS**
nothing happens (silent) — that iOS difference is expected.

---

## §4 — Practice quizzes  *(Phase 6)*  — needs `pnpm seed:quiz-manual-test --reset`

### `[ ]` T8 — Take a quiz end-to-end + no answer leak
1. Sign in as **Student A1** → Library → Physics → Mechanics → Kinematics → **Practice Quizzes**
   → tap "Kinematics — Easy 4" → **Start Quiz**.
2. Confirm the timer pill counts **down** each second.
3. Answer all 4 questions (correct option texts end with "(correct)" if you want 100%), then
   **Submit** → **Submit**.
4. On the result screen tap **View Solutions**.

**Expected:** Timer counts down; result shows "**X / 16**" + a Correct/Wrong/Skipped breakdown
(all-correct = 16/16). The **Solutions** screen highlights the correct option green and yours
red/blue with an explanation.
**Gotcha (critical):** The correct answer must **only** appear on the Solutions screen *after*
submitting — never during the attempt. Math (if present) must render as real typeset math, not
raw `$...$` text.

---

## §5 — Exams  *(Phase 7)*  — needs `pnpm seed:exam-manual-test --reset` (run right before)

### `[ ]` T9 — Take a live exam; server timer survives backgrounding
1. Sign in as **Student A1** → Home → **Exams** → tap "Mechanics Live" → **Enter Exam**.
2. Confirm: no bottom tabs, a timer pill counting down, questions answerable (A/B/C/D + Next/Prev).
3. **Note the timer**, then background the app (go to the home screen) for **30 seconds**, then return.

**Expected:** The timer is now ~**30s less** (it did **not** pause while away). An amber banner
appears: "⚠ You left the app. Switches: 1" (it counts each time you leave; turns red at 3).
**Gotcha (critical):** If the timer pauses while backgrounded, or changing the phone clock
changes it, that's a cheating hole — fail.

### `[ ]` T10 — Submit + result release (instant vs manual)
1. Finish & **Submit** "Mechanics Live" → it shows **"Submitted — results will be released by
   your teacher"** (no score yet — this is a *manual-release* exam).
2. Now take "**Instant Reveal**" the same way → on submit it jumps **straight to the score** (instant release).
3. *(Teacher)* Exams tab → "Mechanics Live" → **Results · Locked** → **Release Results** → confirm.
   Then as the student, re-open "Mechanics Live" → you now see the score.

**Expected:** Manual exam = "Submitted" until the teacher releases; instant exam = score on
submit. Re-opening a submitted exam never restarts it.

---

## §6 — Dashboards  *(Phase 8)*  — needs `pnpm seed:dashboard-manual-test --reset` (run right before)

### `[ ]` T11 — Student home shows real data, and an empty account doesn't crash
1. Sign in as **A1** → Home: confirm a greeting + an **orange streak flame "7"**, an **"Up next"**
   card, a 3-pill stats strip (Attendance % · Mastery % · Rank), "Today's schedule", and "Weak topics".
   Tap a stat pill and the weak-topic card — each should navigate somewhere sensible.
2. Sign out → sign in as **A3 ("Fresh Start", no data)** → Home.

**Expected:** A1 shows real numbers and the taps navigate. A3 shows **clean zeros** (0% / 0% /
—, grey flame, friendly "you're on top of every topic" message) with **no red error and no
blank screen**.
**Gotcha:** A3 is what a brand-new real student looks like on launch day — a crash here breaks
every new user's first experience.

### `[ ]` T12 — Teacher dashboard + batch analytics
1. Sign in as the **Teacher** → Home (Next card + Pending + My batches).
2. Tap a **batch card** → Batch analytics → tap the **Risk / Mastery / Attendance** tabs.

**Expected:** Each tab switches instantly with no crash; the **Risk** tab lists the genuinely
at-risk student(s) only; mastery bars and the attendance strip render.

---

## §7 — Live classes  *(Phase 9)*  — needs `pnpm seed:live-manual-test --reset`

> Two levels: the in-app pieces (one/two devices), and the **real broadcast** (needs OBS).

### `[ ]` T-LIVE-A — Student joins a live class (in-app) — 1 device
1. Sign in as **Student 1** → **Classes** tab → confirm "Live | Upcoming | Recorded" → tap the
   red **Live** row.
**Expected:** Video plays with **no YouTube chrome** + the student's own watermark (which hops
corners after ~60s). Backing out stops the audio immediately.

### `[ ]` T-LIVE-B — Chat + raise-hand + moderation — 2 devices (recommended)
1. **Device 2 (Teacher):** Classes → **Live control** on the Physics row.
2. Teacher and Student send chat messages; Student taps **Raise hand**; Teacher **Resolves** it,
   **Pins** an announcement, and **deletes/mutes** a message; then taps **End class** → confirm.
**Expected:** Every action shows on the other device within ~1s; teacher messages get a green
"Teacher" badge; ending the class shows the student "This class has ended" + "Watch recording".

### `[ ]` T-LIVE-C — Real OBS broadcast (optional but recommended before launch) — needs OBS
1. Teacher → Classes → red **broadcast (Radio) FAB** → pick batch + duration → **Set up live class**.
2. In "Stream setup", tap **Copy Server + Key** → in OBS: Settings → Stream → Service **Custom**,
   paste Server + Key → **Start Streaming** (wait for the green bar).
3. In the app tap **Go Live**; on a student device open the class.
4. Wave at the webcam (≈10–30s YouTube latency is normal). **End in the app first**, then **Stop
   Streaming** in OBS.
**Expected:** Student sees your real camera feed (no YouTube chrome, with watermark); after a
few minutes the saved recording appears under "Recorded".
**Gotcha:** The YouTube broadcast must be **Unlisted**. Always end in the app first.
*(This streams from your personal YouTube channel today; switching to the institute's FyneStudy
channel later is a backend-only change — see `docs/youtube-switch-to-real-fynestudy-channel.md`.)*

---

## §8 — Leaderboard + badges + streak  *(Phase 10)*  — needs `pnpm seed:leaderboard-manual-test --reset`

### `[ ]` T-RANK-A — Ranks render correctly + no private info leaks
1. Sign in as **"Topper"** → **Ranks** tab → read the "Your rank" hero + the ordered list →
   tap another student's row to open their public card → close it → tap **All-Time**.
**Expected:** Ranks are ordered highest→lowest with 🥇🥈🥉 on the top 3 and "You" highlighted.
The public card shows **only** name + batch + streak + badges — **never** email/phone/DOB.

### `[ ]` T-RANK-B — Badge celebration fires once
1. Sign in as a student with an unseen badge (e.g. "Topper") → on Home a full-screen
   **"Badge unlocked"** celebration appears → tap **Awesome!** → pull-to-refresh.
**Expected:** The celebration shows once and does **not** re-appear after refresh. Profile →
**Badges** shows earned (colored) vs locked (dim) badges with "X of 11 earned".

---

## §9 — Admin web panel  *(Phases 2–3, 12)* — BROWSER

### `[ ]` T13 — Owner login + 2FA, then create a student & a teacher
1. Open the admin URL → enter a **wrong** password → confirm you're **refused**.
2. Enter the correct owner password → enter the **6-digit code** from your authenticator.
   *(First time only: you'll scan a QR to enroll and get 10 recovery codes — save them.)*
3. You land on **Overview**; the sidebar shows your name + "Owner admin".
4. Sidebar → **Students** → **+ New student** → fill name/email, **pick a batch** (required) →
   **Submit** → **copy the one-time temp password** shown.
5. Sidebar → **Teachers** → create a teacher the same way; open its detail → assign a batch.

**Expected:** You **cannot** reach the dashboard without a valid 6-digit code. Both new accounts
appear in their lists; the student shows "Pending PW change"; each shows a one-time temp password.
**Gotcha:** The temp password is shown **once** — copy it now (you need it for T14). Use throwaway
`ZZ Test` names/emails so you can clean up after.

### `[ ]` T14 — New student logs into the phone (the full pipeline)  — PHONE
1. On the phone, log in as the **student you just created** (T13) with its temp password.
2. Forced password change (T2) → set a new password → land on **Home**.
3. Tap Classes / Library / Attendance to confirm it's a real, batch-scoped account.

**Expected:** Admin-created account → logs in on a real phone → forced change → working home.
This is the single most important end-to-end proof before launch.

### `[ ]` T15 — Admin spot-checks: attendance, content, audit log  — BROWSER
1. Sidebar → **Attendance**: the student×session grid renders; click a cell → set a status with a
   reason → it saves; **Export CSV** downloads.
2. Sidebar → **Content**: toggle publish on a `ZZ Test` item → the badge flips.
3. Sidebar → **Audit log**: newest-first table; filter by Action = `create_user` → find the
   accounts you made in T13; click **Details** → see a Before/After JSON snapshot.

**Expected:** All three load against the live database; the attendance correction persists; the
publish toggle flips; and **every admin action you did appears in the audit log** with before/after.
**Gotcha:** If any create/suspend/correct leaves **no** audit row, that's a launch blocker.

---

## §10 — Smoothness sanity check  *(performance)*  — PHONE (best on a cheap Android)
### `[ ]` T16 — The app feels smooth
1. Scroll the **Library** lists, the **Leaderboard**, and a teacher **Roster** fast.
2. Open the **Attendance** QR screen and leave it a minute.
3. Open and close a **video** and a **quiz** a few times.

**Expected:** Scrolling is smooth (no stutter/jank); screens open without long blank waits (a
branded loader shows, not a frozen white screen); nothing heats up or crashes after a few minutes.
**Gotcha:** Test this on the **preview/production APK**, not the `development` build — the dev
build is always janky and is not what users get.

---

## ✅ Go / No-Go — minimum bar to publish
Ship only if **all of these are green** on at least one real Android phone (+ Chrome for admin):

- `[ ]` T1 Login screen + student home + admin bounced out
- `[ ]` T2 / T14 Forced password change + admin-created student logs into the phone
- `[ ]` T4 Teacher scans student QR (present + the 3 rejections)
- `[ ]` T6 Video plays + watermark + audio stops on back
- `[ ]` T8 Quiz: take, submit, score, no answer leak
- `[ ]` T9 Exam: server timer survives backgrounding
- `[ ]` T11 Student home real data + empty account doesn't crash
- `[ ]` T13 Owner login + 2FA + create student/teacher
- `[ ]` T15 Admin attendance/content/audit + every action audited
- `[ ]` T16 App feels smooth on a real phone

**Strongly recommended (do if you can):** T7 PDF, T10 exam release, T12 teacher analytics,
T-LIVE-A/B (and T-LIVE-C with OBS), T-RANK-A/B.

> **Cleanup after testing:** suspend/remove every `ZZ Test` account and item you created. Don't
> touch real institute data, and never suspend the owner.
