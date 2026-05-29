# FyneStudy Web — Test Guide (start here, noob-friendly)

**This is THE file to test the web app.** Follow it top to bottom. It covers setup
(running it + getting test accounts/data) **and** every critical feature. No prior
knowledge needed.

*(Want the exhaustive 1029-line version with a per-browser matrix? That's
`Phases/phase-5-manual-tests.md`. You don't need it — this file is enough.)*

---

# Part 1 — Setup (do this once)

### Where will you test?
You can test in two places — both use the same backend, so test accounts/data work in
both:
- **Laptop:** `http://localhost:3000` (run it yourself, below) **or** the live site.
- **Phone:** use the **live site** → `https://fyne-study-web.vercel.app` (or
  `https://fynestudy.live` once your domain is live). *(localhost only works on the
  laptop running it — don't try localhost on the phone.)*

### Step 1 — Open a terminal in the project folder
Open the project in your terminal (the folder that has `apps/`, `docs/`, etc.).

### Step 2 — Create test accounts + sample data (the "seeds")
The backend is mostly empty, so first we add test students, a teacher, classes,
quizzes, etc. **Your keys are already set** (`apps/admin/.env.local`). Run these one at a
time (each takes a few seconds and **prints login emails + passwords at the end —
copy them into the notepad below**):

```
pnpm seed:dashboard-manual-test --reset     # teacher + 3 students + dashboard/attendance/mastery data
pnpm seed:content-manual-test               # library: videos + PDFs
pnpm seed:quiz-manual-test --reset          # a practice quiz
pnpm seed:exam-manual-test --reset          # a graded exam
pnpm seed:live-manual-test --reset          # a live class session + chat
```

> Each seed makes its **own** teacher + students and prints their logins — that's
> normal. When a test below says "use the quiz-seed login," it means the login the
> `quiz` seed printed. Keep this notepad handy:

```
DASHBOARD seed  → Teacher: ______________  PW: ______   Student "Streak Star": ______________ PW: ______
CONTENT seed    → Student: ______________  PW: ______
QUIZ seed       → Student: ______________  PW: ______
EXAM seed       → Teacher: ______________  PW: ______   Student: ______________ PW: ______
LIVE seed       → Teacher: ______________  PW: ______   Student: ______________ PW: ______
```

> ⚠️ This adds **test data to your live backend**. That's fine now (no real students
> yet). Before you onboard real students, tell me and I'll help wipe the test fixtures.
> If a seed errors, copy the red text to me.

### Step 3 — Run the app on your laptop (localhost)
In the terminal:
```
pnpm --filter @fynestudy/web dev
```
Wait for `Ready`, then open **http://localhost:3000** in **Chrome**. *(First time only:
if it errors about missing modules, run `pnpm install` once, then this command again.)*
Press `Ctrl + C` in the terminal to stop it later.

### Step 4 — Open the dev tools (helps report bugs)
On the laptop, press **F12** → click the **Console** tab. If anything breaks, red text
here tells us why. Keep it open while testing.

> **First login note:** a brand-new seeded account may ask you to **set a new password**
> on first login — do it, then continue. That's expected (and tests that flow).

---

# Part 2 — The tests

For each: do the steps, check the **Expected**, then tick **PASS** or write what broke.
Do the whole thing on a **laptop**, then repeat the key ones on a **phone** (live URL).

---

## A · Login & logout  *(use any seed's logins)*
1. Open `/login` → you see the FyneStudy logo + email/password form.
2. Sign in with a **student** login → lands on **Home**. Bottom bar (phone) / left rail
   (laptop) shows **6 tabs**: Home · Classes · Library · Attendance · Ranks · Profile
   (**no "Menu"**).
3. Type a **wrong password** → clear red error, no crash.
4. **Profile** tab → scroll down → **Sign out** → back to login. Browser **Back** does
   not re-enter the app.
5. Sign in with a **teacher** login → teacher Home (tabs include Scan, Quizzes, Exams,
   Batch).
- [ ] PASS / FAIL: __________________________

## B · Student dashboard & profile  *(dashboard seed → "Streak Star" student)*
1. On Home you see: greeting, a **next class/exam card**, stats (attendance %, **7-day
   streak**), today's schedule, weak topics, continue-watching, recent badges.
2. Numbers are real (not blank/"undefined"). Tapping a section navigates.
3. **Profile** tab → 3 sub-tabs (Profile / Mastery / Badges). Identity rows show name,
   email, batch (locked). **Change password** opens and works.
- [ ] PASS / FAIL: __________________________

## C · Attendance  *(needs the teacher + a student from the SAME seed, on 2 screens)*
> Use two browsers (or laptop + phone). Sign in as the **teacher** on one, the
> **student** on the other.
1. **Student → Attendance:** a **QR code** shows with a countdown ("Refreshes in Ns") —
   it refreshes ~every 25–30s.
2. **Teacher → Scan → Start camera** → allow camera → point at the student's QR (or hold
   the student's screen to the teacher's webcam) → **green success**; student appears in
   the roster.
3. Student's attendance % / history updates (refresh if needed).
4. **Camera denied** test: deny camera → you get a fallback **link to the roster** to
   mark manually — no crash.
- [ ] PASS / FAIL: __________________________

## D · Library — video & PDF  *(content seed login)*
1. **Library:** drill **Subject → Chapter → Topic → item**. **Search** filters the list.
2. **Open a video** → it plays in the YouTube player; a faint **watermark** (your
   name/phone) drifts over it. Close & reopen → it offers to **Resume**.
3. **Open a PDF** → it renders with a **tiled diagonal watermark**. **Zoom +/−** works.
   Scroll down, leave, come back → it **reopens on the same page**.
- [ ] PASS / FAIL: __________________________

## E · Quiz  *(quiz seed login)*
1. Start the quiz → intro → **Start Quiz** → answer questions; use the **number grid** to
   jump; **flag** a question. Math shows as proper formulas (not raw `$...$`).
2. **Refresh the page mid-quiz** → it resumes where you were (answers kept).
3. Submit → see your **score** → **Review solutions** shows correct answers.
- [ ] PASS / FAIL: __________________________

## F · Exam  *(exam seed login)*
1. Start the exam → a **countdown timer** runs; screen is locked (no text-select /
   right-click).
2. **Clock test:** change your device clock **forward 10 min** → the exam timer does
   **NOT** jump (server controls it). Set the clock back.
3. Switch to another browser tab and back → a **"tab switch" warning** appears + a
   counter goes up.
4. Submit (or let the timer hit 0 → auto-submits). Instant exam → score shows;
   manual-release exam → a **"results locked"** card until the teacher releases.
- [ ] PASS / FAIL: __________________________

## G · Live class + chat + raise hand  *(live seed; teacher + student on 2 screens — YOUR #1)*
1. **Teacher → Classes → open the live class → Live control → Setup:** you get an **RTMP
   URL** + **Stream key** with **Copy** buttons. *(For a real video, paste them into OBS
   and start streaming — optional for this test.)*
2. **Student → Classes → Live:** before the teacher goes live → a **lobby / countdown**.
3. Teacher presses **Go live** → student's screen switches to the **player**.
4. **Chat:** student & teacher each send a message → both see them. Send **6 messages
   fast** → it slows you down (rate-limit).
5. **Raise hand:** student taps it → teacher sees it in the queue.
6. **Moderate:** teacher **deletes** a message and **bans** the student → banned student
   can't chat / raise hand anymore.
7. Teacher **End class** → student sees "class ended."
8. **Recording:** open a class under **Recorded** → it plays with **speed** buttons +
   **chat replay**. *(Only if a recording exists.)*
- [ ] PASS / FAIL: __________________________

## H · Teacher portal (quick pass)  *(any teacher login)*
1. **Content** → upload a **video URL** and a **PDF** → it appears in the library.
2. **Quiz builder / Exam builder** → create one → **Add from bank** → **Publish** → it
   shows up for students.
3. **Exam results** → open an exam's results → roster + per-question analysis load (no
   "answer-keys failed" error). **Release results** / **regrade** work.
4. **Batch** → open a batch → heatmap, mastery bars, at-risk list load.
- [ ] PASS / FAIL: __________________________

## I · Works on every device  *(do on phone via the live URL + resize laptop)*
1. **Phone:** bottom tab bar; nothing runs off the right edge; buttons easy to tap; text
   readable; **pinch-zoom works**.
2. **Laptop wide:** a **left side rail** (not bottom tabs); content centered (not one
   stretched column); rows highlight on hover.
3. Resize the laptop window narrow → wide (or rotate the phone): nothing overlaps or gets
   cut off.
4. **Install as an app:** Android Chrome → "Add to Home screen"; iPhone Safari → Share →
   "Add to Home Screen"; laptop Chrome → install icon in the address bar. The installed
   icon opens full-screen and you're still logged in.
- [ ] PASS / FAIL: __________________________

## J · Security spot-check  *(laptop, F12 open)*
1. During a **quiz/exam attempt** → F12 → **Network** tab → click a few requests → **none**
   contain `is_correct` or `correct_option_id` (answers never reach the browser early).
2. Right-click → **View Page Source** → Ctrl+F `service_role` → **0 results**.
3. As a **student**, try opening a teacher page by typing `/scan` in the address bar →
   you're bounced to Home (can't access it).
- [ ] PASS / FAIL: __________________________

---

# Part 3 — Report back to me
For anything that **FAILED**, send me:
1. **Which test** (e.g. "E step 2").
2. **Which device/browser** (laptop Chrome / Android / iPhone).
3. **What you saw** vs what you expected.
4. The **red text in F12 → Console** (laptop), if any.

If every box is **PASS** on laptop + phone, the web app is working correctly and you're
ready to go live for real users. 🎉
