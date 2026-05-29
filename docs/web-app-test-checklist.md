# FyneStudy Web — Full Beginner Test Guide 🧪

**This is THE file to test the web app.** It assumes you know *nothing*. Do it top to
bottom. By the end you'll have proven every important feature works on a laptop and a
phone.

- ⏱️ Time: ~45–60 minutes.
- 🧰 You'll use: your laptop, Google Chrome, your phone, and a terminal (PowerShell).
- 📦 The exhaustive 1029-line version is `Phases/phase-5-manual-tests.md` — you do **not**
  need it. This file is enough.

> **Golden rule while testing:** keep **F12 → Console** open on the laptop (Part 1,
> Step 6). If anything looks broken, the red text there is what you send me.

---

# PART 1 — SETUP (do this once, ~15 min)

## Step 0 — Do you have the tools?
You already ran the app earlier, so you have these. Only if something below says
"command not found":
- **Node.js + pnpm:** install Node from <https://nodejs.org> (the "LTS" button), then open
  PowerShell and run `npm install -g pnpm`.
- **Google Chrome:** install from <https://google.com/chrome>.

## Step 1 — Open a terminal in the project folder
1. Press the **Windows key**, type **PowerShell**, press **Enter**. A blue/black window opens.
2. Click in it, type this exactly (copy-paste it), press **Enter**:
   ```
   cd "C:\Users\kaust\OneDrive\Desktop\FyneStudyLive"
   ```
3. ✅ You should now see that path at the start of the line. You're "inside the project."

> 💡 Easier alternative: open the `FyneStudyLive` folder in File Explorer, right-click an
> empty area → **Open in Terminal**. (Same thing.)

## Step 2 — Create test accounts + sample data (THE SEEDS) — most important step
**Why:** your database is empty — there are no students, classes, quizzes, etc. yet. So
there's nothing to test. "Seeding" fills it with a teacher, students, and sample content.
Your keys are already set up, so you just run the commands.

Run these **one at a time** (paste a line → Enter → wait until it finishes and you get
your normal prompt back → then the next line):

```
pnpm seed:dashboard-manual-test --reset
pnpm seed:content-manual-test
pnpm seed:quiz-manual-test --reset
pnpm seed:exam-manual-test --reset
pnpm seed:live-manual-test --reset
```

**What each one makes:**

| Command | Creates (for testing…) |
|---|---|
| `seed:dashboard-manual-test` | 1 teacher + 3 students + a batch + attendance/streak/mastery data → Login, Dashboard, Profile, Attendance, Ranks |
| `seed:content-manual-test` | Library subjects/chapters/topics + sample **videos & PDFs** → Library |
| `seed:quiz-manual-test` | A published **practice quiz** → Quiz |
| `seed:exam-manual-test` | A **graded exam** + teacher → Exam, Teacher results |
| `seed:live-manual-test` | A **live class** session + chat → Live class, Chat, Raise hand |

**👀 What you'll see + what to COPY:** at the end of each seed it prints a block like this
(your emails will have numbers in them — that's normal):

```
== Accounts ==
Teacher
  Email:     p8-teach-1730000000@fynestudy.example.com
  Password:  FyneStudy01
Student A1 "Streak Star"  p8-stu-a1-1730000000@fynestudy.example.com / FyneStudy01
Student A2 "At Risk"      p8-stu-a2-1730000000@fynestudy.example.com / FyneStudy01
...
```

➡️ **Copy every `Email` + `Password` it prints into a notepad.** You'll log in with these.
Fill this in as you go (one teacher + one student per seed is enough):

```
DASHBOARD → Teacher: _______________________ PW: __________   Student: _______________________ PW: __________
CONTENT   → Student: _______________________ PW: __________
QUIZ      → Student: _______________________ PW: __________
EXAM      → Teacher: _______________________ PW: __________   Student: _______________________ PW: __________
LIVE      → Teacher: _______________________ PW: __________   Student: _______________________ PW: __________
```

> **Notes / gotchas:**
> - Each seed makes its **own** teacher + students. That's normal — for a given test,
>   use the login that *that test's* seed printed.
> - **Re-running a seed?** Add `--reset` (already shown) — it wipes that seed's *previous*
>   test data first so you don't pile up duplicates.
> - ⚠️ This adds **test data to your real backend**. Totally fine now (no real students
>   yet). When you're about to onboard real students, tell me and I'll wipe the test data.
> - ❌ **If a seed shows red error text**, copy it and send it to me — don't continue.

## Step 3 — Start the website on your laptop (localhost)
In the **same terminal**, run:
```
pnpm --filter @fynestudy/web dev
```
- Wait ~10–20 seconds until you see **`Ready`** (and a line like `Local: http://localhost:3000`).
- Open **Chrome** and go to **http://localhost:3000** → you should see the **Sign in** page.
- ⚠️ **Leave this terminal running** — it *is* the website. Closing it stops the site.
- To **stop** it later: click the terminal and press **Ctrl + C**.

> 💡 You need to run seeds AND the site. The site is now using this terminal, so if you
> want to run another seed, open a **second** PowerShell window (repeat Step 1's `cd`)
> and run the seed there.

> 🌐 **Don't want localhost?** You can do every test on the **live site** instead —
> `https://fyne-study-web.vercel.app` (or `https://fynestudy.live`). Same app, same data.
> Use the live site for **phone** tests (localhost only works on the laptop running it).

## Step 4 — Open Developer Tools (so you can report bugs)
On the laptop in Chrome: press **F12** → click the **Console** tab at the top of the panel
that opens. Leave it open. Red lines = errors (send them to me).

## Step 5 — First-login note
A brand-new seeded account may ask you to **set a new password** the first time you log in.
That's expected and good (it tests that flow) — just set any password (e.g. `Test1234!a`)
and continue. **Use that new password from then on for that account.**

## Step 6 — The "two accounts at once" trick (needed for Attendance + Live class)
Some tests need a **teacher and a student logged in at the same time**. Two ways:
- **Easiest:** laptop = one account, **phone (live URL)** = the other.
- **One laptop:** open a **normal Chrome window** (log in as account 1) **and** an
  **Incognito window** (`Ctrl + Shift + N`) (log in as account 2). Incognito keeps the two
  logins from clashing.

✅ Setup done. Now the tests.

---

# PART 2 — THE TESTS

For each test: do the numbered steps, compare to **"You should see,"** then tick **PASS**
or jot what broke. Do them on the **laptop** first; repeat the ⭐ ones on your **phone**
(live URL).

---

## ⭐ A · Login & logout
*Accounts: any seed's student + teacher.*
1. Go to `/login`. **You should see:** FyneStudy logo + Email + Password fields + a
   "Sign in" button.
2. Enter a **student** email + password → click **Sign in**. **You should see:** the
   **Home** dashboard. At the bottom (phone) or left side (laptop) there are **6 tabs**:
   Home · Classes · Library · Attendance · Ranks · Profile. **There is NO "Menu" tab.**
3. Sign out, go back to `/login`, type a **wrong password** → click Sign in. **You should
   see:** a clear red error message, and the app does **not** crash or freeze.
4. Log back in → go to the **Profile** tab → scroll down → click **Sign out**. **You should
   see:** back at the Sign in page. Now press the browser **Back** button → it should
   **not** let you back into the app.
5. Log in with a **teacher** account. **You should see:** a teacher Home; the tabs now
   include **Scan, Quizzes, Exams, Batch**.
- [ ] **PASS** / **FAIL:** ______________________________________________

## ⭐ B · Student dashboard & profile
*Account: the DASHBOARD seed's "Streak Star" student.*
1. On **Home**, look at each section. **You should see:** a greeting with the name; a
   **next class/exam** card; a stats row (attendance %, a **7-day streak**); today's
   schedule; weak topics; continue-watching; recent badges.
2. Check the numbers are **real** (not blank or the word "undefined" or "NaN"). Click a
   couple of sections → they should navigate somewhere sensible.
3. Go to **Profile** → there are **3 sub-tabs**: **Profile / Mastery / Badges**. Tap each.
   **You should see:** Profile shows name/email/batch (with a small lock = read-only);
   Mastery shows per-topic bars; Badges shows a grid.
4. On the Profile tab, click **Change password** → set a new one → it should succeed.
- [ ] **PASS** / **FAIL:** ______________________________________________

## C · Attendance (rotating QR)
*Needs the DASHBOARD seed's **teacher + a student** at the same time (use the two-window
trick from Step 6).*
1. As the **student** → **Attendance** tab. **You should see:** a big **QR code** and a
   countdown like **"Refreshes in 25s"** that ticks down and the QR changes every ~25–30s.
2. As the **teacher** → **Scan** tab → click **Start camera** → click **Allow** when the
   browser asks for the camera. Point the webcam at the student's QR (hold the student's
   phone/second-window up to the camera). **You should see:** a **green success** message,
   and the student's name appears in the roster list below.
3. Back as the student → Attendance/Home → the attendance % / history should update (you
   may need to refresh the page).
4. **Denied-camera test:** as the teacher, refresh Scan and click **Block** when asked for
   camera. **You should see:** a friendly message with a **link to the roster** to mark
   students by hand — **not** a crash.
- [ ] **PASS** / **FAIL:** ______________________________________________

## ⭐ D · Library — video & PDF
*Account: the CONTENT seed's student.*
1. Go to **Library**. **You should see:** a list of **Subjects**. Tap one → **Chapters**
   → tap one → **Topics** → tap one → **items** (videos/PDFs). Try the **Search** box at
   the top — it filters the list.
2. Open a **video** item. **You should see:** a YouTube player that plays, with a faint
   moving **watermark** (your name/phone) over it. Go back, reopen the same video → **You
   should see:** a small "**Resume** / Start over" choice.
3. Open a **PDF** item. **You should see:** the PDF pages with a **diagonal tiled
   watermark** across them, and **zoom + / −** buttons at the top that make it bigger/
   smaller. Scroll down a few pages, go back to Library, reopen the PDF → it should
   **reopen on the page you left**.
- [ ] **PASS** / **FAIL:** ______________________________________________

## ⭐ E · Quiz (practice)
*Account: the QUIZ seed's student.*
1. Find the quiz (Library → the topic, or Home → weak topics) → open it → click **Start
   Quiz**. **You should see:** one question at a time, a row/grid of **question numbers**
   to jump around, and a **flag** button. Any math shows as proper symbols (e.g. fractions),
   **not** raw text like `$x^2$`.
2. Answer a few questions, then **refresh the page** (F5). **You should see:** it puts you
   back where you were with your answers still selected.
3. Answer the rest → **Submit**. **You should see:** your **score**, and a **Review
   solutions** button that shows which answers were correct.
- [ ] **PASS** / **FAIL:** ______________________________________________

## ⭐ F · Exam (graded, timed)
*Account: the EXAM seed's student.*
1. Open the exam → start it. **You should see:** a **countdown timer** running, and the
   screen is "locked" (you can't select text or right-click).
2. **Clock test (important):** change your laptop clock forward 10 minutes —
   Windows: **Settings → Time & language → Date & time** → turn **off** "Set time
   automatically" → **Change** → set it 10 min ahead → Save. Go back to the exam. **You
   should see:** the timer does **NOT** suddenly jump down — the server controls the time.
   *(Then turn "Set time automatically" back ON.)*
3. Switch to a different browser tab for a second, then come back to the exam. **You should
   see:** a **"tab switch" warning** banner, and a counter that goes up each time.
4. **Submit** (or wait for the timer to hit 0 — it auto-submits). **You should see:** for an
   instant-result exam, your score; for a manual-release exam, a **"results locked"** card
   (until a teacher releases it).
- [ ] **PASS** / **FAIL:** ______________________________________________

## ⭐⭐ G · Live class + chat + raise hand  *(YOUR #1 priority)*
*Needs the LIVE seed's **teacher + student** at the same time (two-window trick).*
1. As the **teacher** → **Classes** → open the live class → look for **Live control** /
   **Manage**. **You should see:** a **Setup** screen with an **RTMP URL** and a **Stream
   key**, each with a **Copy** button. *(To broadcast a real video you'd paste these into
   OBS and hit stream — optional; the buttons/flow are what we're testing.)*
2. As the **student** → **Classes** → **Live** section → open the class. **You should
   see:** a **lobby / "waiting for teacher" countdown** (because the teacher isn't live
   yet).
3. As the teacher, click **Go live**. **You should see (student side):** the screen
   switches from the lobby to the **video player** area.
4. **Chat:** type a message as the student and as the teacher → **both** sides see both
   messages. Now send **6 messages very fast** as one user → **You should see:** it blocks/
   slows you (a rate-limit message).
5. **Raise hand:** as the student, tap **Raise hand**. **You should see (teacher side):**
   the student appears in a raised-hands list/queue.
6. **Moderate:** as the teacher, **delete** one of the student's messages, then **ban** the
   student. **You should see:** the banned student can no longer send chat or raise a hand.
7. As the teacher, click **End class**. **You should see (student side):** a "class ended"
   message.
8. **Recording (only if one exists):** Classes → **Recorded** → open a past class. **You
   should see:** it plays, with **playback-speed** buttons and the **chat replay** beside it.
- [ ] **PASS** / **FAIL:** ______________________________________________

## H · Teacher portal (quick pass)
*Account: any seed's teacher.*
1. **Content** tab → upload a **video** (paste a YouTube URL) and a **PDF** (pick a file).
   **You should see:** it processes and then appears in the Library.
2. **Quizzes** (or **Exams**) tab → create a new one → use **Add from bank** to add
   questions → **Publish**. **You should see:** it now shows up for students.
3. **Exams** → open an exam's **results**. **You should see:** the student roster + a
   per-question analysis load with **no "answer-keys failed" error**. Try **Release
   results** and **Regrade** — they should work.
4. **Batch** tab → open a batch. **You should see:** a heatmap, mastery bars, and an
   at-risk list load.
- [ ] **PASS** / **FAIL:** ______________________________________________

## ⭐ I · Works on every device (responsive + install)
*Do this on your **phone** (live URL) and by resizing the laptop window.*
1. **Phone:** **You should see:** a bottom tab bar; nothing runs off the right edge (no
   sideways scrolling); buttons are big enough to tap; text is readable. **Pinch-zoom**
   should work.
2. **Laptop, wide window:** **You should see:** a **left side rail** instead of bottom
   tabs; content is centered (not one super-wide stretched column); rows highlight when you
   hover.
3. Slowly drag the laptop window from narrow to wide (or rotate the phone). **You should
   see:** nothing overlaps, gets cut off, or breaks at any width.
4. **Install it as an app:**
   - **Android Chrome:** menu (⋮) → **Add to Home screen / Install**.
   - **iPhone Safari:** **Share** button → **Add to Home Screen**.
   - **Laptop Chrome:** the **install icon** in the address bar (right side).
   - Open the installed icon → **You should see:** it opens full-screen (no browser bars)
     and you're still logged in.
- [ ] **PASS** / **FAIL:** ______________________________________________

## J · Security spot-check
*Laptop, with **F12 → Network** tab open.*
1. Start a **quiz or exam attempt**. In F12 → **Network**, click a few of the requests in
   the list and look at their **Response/Preview**. **You should see:** **none** of them
   contain `is_correct` or `correct_option_id` (the answers must NOT reach the browser
   before you submit).
2. Right-click the page → **View Page Source** → press **Ctrl + F** → search
   `service_role`. **You should see:** **0 results**.
3. As a **student**, type a teacher-only address in the bar: `localhost:3000/scan` (or
   `…/quizzes`) → Enter. **You should see:** you get bounced back to **Home** (students
   can't open teacher pages).
- [ ] **PASS** / **FAIL:** ______________________________________________

---

# PART 3 — REPORT BACK TO ME
For anything marked **FAIL**, send me these 4 things:
1. **Which test + step** — e.g. "**G, step 4**".
2. **Which device/browser** — laptop Chrome / Android Chrome / iPhone Safari.
3. **What you saw** vs what you expected.
4. The **red text in F12 → Console** (laptop), if there was any. A screenshot helps too.

If every box is **PASS** on laptop + phone → 🎉 the web app works correctly and you're
ready for real users.

---

# Quick command reference (cheat-sheet)
```
cd "C:\Users\kaust\OneDrive\Desktop\FyneStudyLive"   # go to the project (do this first)

# 1) make test accounts + data (run each once; re-add --reset to wipe & redo)
pnpm seed:dashboard-manual-test --reset
pnpm seed:content-manual-test
pnpm seed:quiz-manual-test --reset
pnpm seed:exam-manual-test --reset
pnpm seed:live-manual-test --reset

# 2) run the website on your laptop  → then open http://localhost:3000
pnpm --filter @fynestudy/web dev
#    (press Ctrl + C to stop it)

# if "pnpm" isn't recognised:  npm install -g pnpm
# if dev errors about missing modules (first time only):  pnpm install
```
Live site (for phone / no localhost): **https://fyne-study-web.vercel.app** · soon
**https://fynestudy.live**
