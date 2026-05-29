# FyneStudy Web — Critical Test Checklist (noob-friendly)

A **short, critical-path** manual test. Goal: confirm every important feature works,
on every device. (For the exhaustive click-by-click version, see
`Phases/phase-5-manual-tests.md`.)

## How to run it
1. Test on **3 things**: a **laptop (Chrome)**, an **Android phone (Chrome)**, and an
   **iPhone (Safari)**. Most bugs hide on phones.
2. For each test: do the steps, check the **Expected**, tick `[x] PASS` or write what
   broke next to `FAIL`.
3. Use **two accounts** open in two browsers/devices: one **student**, one **teacher**
   (so you can test live class + attendance "live" between them).
4. Where to test:
   - **Local (your laptop, before hosting):** `http://localhost:3000`
   - **Live (after Vercel):** `https://fyne-study-web.vercel.app`

> Tip: on the laptop, press **F12 → Console** tab. If something breaks, red errors
> there tell you what. Keep it open during testing.

---

## 0 · App opens
- [ ] Open the URL → you land on the **Sign in** page (FyneStudy logo, email + password).
- [ ] No blank white screen, no red console errors on load.

## 1 · Login & logout  *(test on all 3 devices)*
- [ ] **Student:** sign in with a student email/password → lands on the **Home**
      dashboard. Bottom tabs (phone) / side rail (laptop): Home · Classes · Library ·
      Attendance · Ranks · Profile (**6 tabs, no "Menu"**).
- [ ] **Wrong password** → clear red error, no crash.
- [ ] **Profile tab → Sign out** → returns to Sign in. Pressing browser Back does
      **not** get you back into the app.
- [ ] **Teacher:** sign in with a teacher account → teacher Home (tabs include Scan,
      Quizzes, Exams, Batch).
- [ ] **Forgot password:** Sign in → "Forgot password?" → enter email → "check your
      email" message. Open the email → the reset link opens the app's **Reset** page →
      set a new password → can log in with it.

## 2 · Student dashboard
- [ ] Home shows: greeting, a **next class / next exam card**, stats (attendance %,
      streak), today's schedule, weak topics, continue-watching, recent badges.
- [ ] Numbers look real (not "undefined"/blank). Tapping a section navigates correctly.
- [ ] **Profile** tab: 3 sub-tabs (Profile / Mastery / Badges). Identity rows show your
      name, email, batch (read-only). **Change password** opens and works.

## 3 · Attendance  *(needs student + teacher together)*
- [ ] **Student → Attendance:** a **QR code** shows with a countdown ("Refreshes in
      Ns"). It refreshes about every 25–30s.
- [ ] **Teacher → Scan:** press **Start camera** → allow camera → point at the
      student's QR → **green success**, student appears in the roster.
- [ ] Student's attendance % / history updates (may need a refresh).
- [ ] **Camera denied** (deny permission): you see a fallback with a **link to the
      roster** to mark manually — no crash.

## 4 · Library — video & PDF
- [ ] **Library:** drill Subject → Chapter → Topic → items. **Search** filters the list.
- [ ] **Open a video:** it plays in the YouTube player. A faint **watermark** (your
      name/phone) floats over it. Close & reopen → it offers to **Resume** where you left.
- [ ] **Open a PDF:** it renders. A **tiled diagonal watermark** covers the pages.
      **Zoom +/−** buttons work. Scroll down, leave, come back → it **resumes on the
      same page**.

## 5 · Quiz (practice)
- [ ] Start a quiz → intro → **attempt**. Answer questions, use the **number grid** to
      jump, **flag** a question. Math questions render properly (formulas, not raw `$...$`).
- [ ] **Refresh the page mid-quiz** → it resumes where you were (answers kept).
- [ ] Submit → see your **score** → **Review solutions** shows correct answers.

## 6 · Exam (graded, locked)
- [ ] Start an exam → a **countdown timer** runs. The screen is locked (no text-select /
      right-click menu).
- [ ] **Server-timer test:** change your device clock forward 10 min → the exam timer
      **does NOT** jump (server controls time). Set the clock back.
- [ ] Switch to another browser tab and back → a **"tab switch" warning** appears and a
      counter goes up.
- [ ] Submit (or let the timer hit 0 → auto-submits). For an **instant** exam you see
      the score; for a **manual-release** exam you see a "results locked" card until the
      teacher releases them.

## 7 · Live class + chat + raise hand  *(needs teacher + student; YOUR #1 priority)*
- [ ] **Teacher → Classes → Schedule a live class** (or use a seeded one) → open
      **Live control** → **Setup**: you get an **RTMP URL** + **Stream key** with
      **Copy** buttons. (For a real stream, paste them into OBS and start streaming.)
- [ ] **Student → Classes → Live:** before the teacher goes live, student sees a
      **lobby/countdown** ("waiting for teacher").
- [ ] Teacher presses **Go live** → student's screen switches to the **player**.
- [ ] **Chat:** student & teacher send messages → they appear for both. Sending **6
      messages very fast** → it's rate-limited (slows you down). 
- [ ] **Raise hand:** student taps Raise hand → teacher sees it in the queue.
- [ ] **Moderation:** teacher **deletes** a message and **bans** a student → banned
      student can no longer chat/raise hand.
- [ ] **Pin / announcement** message from teacher shows pinned at top.
- [ ] Teacher **End class** → student sees "class ended".
- [ ] **Recording:** open a past class under **Recorded** → it plays, with **speed**
      buttons and the **chat replay** alongside.

## 8 · Teacher portal (quick pass)
- [ ] **Content:** upload a **video URL** and a **PDF** (file picker → uploads → appears
      in library).
- [ ] **Quiz builder / Exam builder:** create one, **add questions from the bank**,
      **Publish**. It appears for students.
- [ ] **Exam results:** open an exam's results → roster + per-question analysis loads
      (no "answer-keys failed" error). **Release results** / **regrade** work.
- [ ] **Batch:** open a batch → heatmap, mastery bars, at-risk list load.

## 9 · Responsive & install (all devices)
- [ ] **Phone (narrow):** bottom tab bar; no content runs off the right edge; buttons
      are easily tappable; no tiny text.
- [ ] **Tablet / laptop (wide):** a **left side rail** replaces the bottom tabs; content
      is centered (not one stretched column); hovering rows highlights them.
- [ ] **Rotate the phone** / resize the laptop window 320px → 1440px: nothing overlaps or
      gets cut off.
- [ ] **Pinch-zoom works** on the phone (we unlocked it for accessibility).
- [ ] **Install as an app (PWA):**
   - Android Chrome: menu → "Add to Home screen" / install prompt.
   - iPhone Safari: Share → "Add to Home Screen".
   - Laptop Chrome: install icon in the address bar.
   - Opening the installed icon launches it full-screen and you're still logged in.

## 10 · Security spot-check (laptop, F12 open)
- [ ] During a **quiz/exam attempt**, open F12 → **Network** tab → click requests →
      **none** contain `is_correct` or `correct_option_id` (answers never reach the
      browser before you submit).
- [ ] Right-click → **View Page Source** → search for `service_role` → **0 results**.
- [ ] A logged-in student **cannot** open another student's data, the teacher screens
      (`/scan`, `/quizzes`), or the admin — they're redirected to Home.

---

## Done?
If every box is `PASS` on all 3 devices, the web app is working correctly. Record any
`FAIL` with: which step, which device, and the F12 console error — and send it to me to
fix. Exhaustive version + per-browser matrix: `Phases/phase-5-manual-tests.md`.
