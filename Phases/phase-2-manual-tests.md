# Phase 2 — Manual Test Plan (`apps/web` student learning surfaces)

> **Audience:** the human running the manual tests. **Zero coding background required** — every step has the exact buttons to click, the exact URL to type, and what you should see on screen.
>
> **What you're testing:** the Phase 2 student surfaces of `apps/web` — Dashboard, Profile (3 tabs), Leaderboard, Attendance (rotating QR), Classes shell, Library (Subject → Chapter → Topic → Item drill-down), Video player (YouTube IFrame + watermark + resume), PDF viewer (react-pdf + tiled watermark + page resume), and Settings menu. Walk through every section in order. **Chrome on a laptop / desktop is required.** iOS Safari + Android Chrome rows that need HTTPS are tagged **carry-over** (do them after the Vercel deploy session — that's intentional and not a blocker).
>
> **How to record results:** every test ends with `[ ] PASS / [ ] FAIL / [ ] N/A`. Tick one box. If FAIL, write what you saw in the space below it and ping me — I'll diagnose. If N/A, write the reason.
>
> **Estimated time:** ~90 minutes on Chrome desktop if no failures. iOS + Android carry-overs are ~25 min each, done later after the Vercel deploy ships HTTPS.

---

## 🔑 Test accounts — quick reference (verified live 2026-05-28)

These are the SAME accounts you used in Phase 1. Email + password copy-paste straight from here.

| Use in section | Email | Password |
|---|---|---|
| **§A–§K all student tests** | `review.student@fynestudy.app` | `ReviewStudent#2026` |
| **§A.5 teacher-tab fallback** | `review.teacher@fynestudy.app` | `ReviewTeacher#2026` |
| Bonus extra student (Aarav, Batch A) — for §C peer card test | `test.aarav@fynestudy.app` | `TestPass#2026` |
| Bonus extra student (Diya, Batch A) — same | `test.diya@fynestudy.app` | `TestPass#2026` |

**Skipped sections (mark N/A):**
- iOS Safari + Android Chrome carry-overs (§J.3, §J.4) — needs the Vercel deploy that ships later this week.
- Multi-role student/teacher account switch — account never created.
- Suspended-during-session edge case — would require admin to suspend mid-test.

> Source of truth for credentials: `CREDENTIALS.local.md` at the repo root (git-ignored, do not paste publicly).

---

## Table of contents

- **§0 Setup** — `apps/web` dev server, env file, seed data (do this once)
- **§A Dashboard** — greeting, stats, today's schedule, weak topics, continue strip, recent badges, streak flame (7 tests)
- **§B Profile + Mastery + Badges** — 3-tab segmented control + change-password dialog (6 tests)
- **§C Leaderboard** — scope toggle + my-rank pinned + public-card dialog + calc modal (5 tests)
- **§D Attendance** — rotating QR + today's classes + history rings + realtime mark (6 tests)
- **§E Classes shell** — live/upcoming/recorded segments + exams discovery (4 tests)
- **§F Library tree** — subject → chapter → topic → item drill-down + search (5 tests)
- **§G Video player** — `react-youtube` + watermark + 10-s throttled progress + resume sheet (5 tests)
- **§H PDF viewer** — `react-pdf` + tiled watermark + page tracking (5 tests)
- **§I Settings menu + sign-out** — list rows + future-update alerts + sign-out (3 tests)
- **§J Responsive + carry-overs** — desktop ↔ mobile-web (3 tests)
- **§K Security checks** — no `is_correct`, no service-role-key, signed URLs only (4 tests)
- **§L Automated test gates** — typecheck / lint / vitest / build / Playwright (5 commands)
- **§M Acceptance sign-off** — tick boxes per section + tester name + date

---

# §0 — Setup (do this once, before any test below)

This section gets your laptop ready. Allow ~5 minutes since you already did Phase 1's setup.

### 0.1 — Confirm the repo, branch, and deps are fresh

**👉 Do this:**

1. Open **PowerShell**: `Win+R`, type `powershell`, press Enter.
2. Navigate to the repo:
   ```powershell
   cd C:\Users\kaust\OneDrive\Desktop\FyneStudyLive
   ```
3. Check the branch:
   ```powershell
   git status
   ```
4. Make sure Phase 2 deps are installed (this is cheap if already installed):
   ```powershell
   pnpm --filter @fynestudy/web install
   ```

**✅ What you should see:**

- `On branch web-phase-1`
- A list of files with `M` or `??` next to them — that's the uncommitted Phase 2 work plus the new files (everything under `apps/web/components/dashboard/`, `apps/web/features/`, `apps/web/app/(protected)/...`, etc.).
- `pnpm install` says `Done in <N>s` with no red errors. (Yellow `WARN` lines about peer deps are normal.)

**❓ If something looks different:**

- Says `On branch main` → run `git checkout web-phase-1` then re-check.
- `pnpm install` says `ELIFECYCLE` or `ENOENT` → run `pnpm install` from the repo root (not inside `apps/web`).

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### 0.2 — Confirm `apps/web/.env.local` still has the right keys

This file was set up in Phase 1. Phase 2 didn't change it — just confirm it's still right.

**👉 Do this:**

```powershell
notepad apps/web/.env.local
```

**✅ What you should see (3 lines):**

```
NEXT_PUBLIC_SUPABASE_URL=https://orqwyazvcthgxoadfxfv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ZfvA-ky5eOQ3c-e9yCiLnQ_c06ZYmz9
NEXT_PUBLIC_ADMIN_URL=https://fyne-study-app-admin.vercel.app
```

There MUST NOT be a `SUPABASE_SERVICE_ROLE_KEY` line. If there is, delete it now — the web client never gets that key.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### 0.3 — Start the dev server

**👉 Do this:**

1. In PowerShell, from `C:\Users\kaust\OneDrive\Desktop\FyneStudyLive`:
   ```powershell
   pnpm --filter @fynestudy/web dev
   ```
2. Wait ~15 seconds.

**✅ What you should see:**

- Output ends with:
  ```
   ✓ Ready in <N>s
   ○ Local:        http://localhost:3000
  ```
- The window stays open. Do NOT close it for the rest of the test plan.

**❓ If something looks different:**

- `Port 3000 already in use` → there's another Next.js running. Close it, then re-run `pnpm dev`.
- Errors mentioning `pdfjs-dist` or `react-pdf` → re-run `pnpm install` from the repo root.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### 0.4 — Open Chrome to the home page and log in

**👉 Do this:**

1. Open **Google Chrome**.
2. Go to: `http://localhost:3000`
3. You'll be redirected to `/login`.
4. Enter:
   - Email: `review.student@fynestudy.app`
   - Password: `ReviewStudent#2026`
5. Click **Sign in**.

**✅ What you should see:**

- You land on `http://localhost:3000/`.
- A heading at the top says either **"Good morning, …"** / **"Good afternoon, …"** / **"Good evening, …"** with your name's first word.
- A small flame icon + a number + "days" appears in the top-right of the page (the streak chip).

**❓ If something looks different:**

- "Invalid email or password" → typo. Re-enter the password exactly: `ReviewStudent#2026` (no trailing space).
- Stays on `/login` after click → check the dev terminal for errors; reload the page.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §A — Dashboard

The Phase 2 dashboard replaces the Phase 1 placeholder. It shows: greeting + streak flame, the **Up next** card (live class / exam / mark attendance / continue quiz), a stats strip (Attendance %, Mastery %, Rank), today's schedule, weak topics, continue learning, and recent badges. Desktop is 2 columns at `lg:` (≥1024px); mobile-web is 1 column.

### A.1 — Greeting + streak chip render

**👉 Do this:**

1. You should already be at `http://localhost:3000/`. If not, navigate there.
2. Look at the top of the page.

**✅ What you should see:**

- An H1 heading: `Good morning, …` / `Good afternoon, …` / `Good evening, …` / `Hi, …`. The time-of-day matches your current time (IST).
- To the right of the heading, a small white pill with a flame icon, a number (e.g. `3`), and the word `days`.
- If the streak number is 0 or very low, the flame is grey/orange; bigger streaks are red/yellow.

**❓ If something looks different:**

- No flame chip → may be normal if the account has never been active (streak query returned nothing yet). Open DevTools (F12) → Network → check the response of the `rpc/student_dashboard` call for a `streak` object.
- Wrong time-of-day greeting → it uses IST. If you're not in IST, the greeting may say "Afternoon" while your local clock shows morning. That's correct.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.2 — "Up next" card surfaces

**👉 Do this:**

1. On the dashboard, look for a tall blue card near the top.

**✅ What you should see:**

- A blue rounded card with an icon on the left, a label **"UP NEXT"**, a title (e.g., `Mark attendance`, `Physics`, `Mock Exam`), and a description sentence.
- A white button at the bottom of the card (e.g., `Show QR`, `Open Classes`, `Resume`).
- If the seed has no scheduled session, the card may read **"All caught up"** — still PASS.

**❓ If something looks different:**

- Card missing entirely → the `student_dashboard` RPC may have errored; reload the page.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.3 — Stats strip with 3 tiles

**👉 Do this:**

1. Right below the Up-Next card, look for a row of 3 white tiles.

**✅ What you should see:**

- Three tiles labelled **Attendance**, **Mastery**, **Rank**. Each shows a value (`75%`, `82%`, `#3`) or `—` if no data.
- Hover with the mouse: the tile gets a subtle shadow.
- Click **Attendance** → URL changes to `/attendance`. Click the browser back button to return.
- Click **Mastery** → URL changes to `/profile?tab=mastery`.
- Click **Rank** → URL changes to `/leaderboard`.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.4 — Today's schedule list renders

**👉 Do this:**

1. Scroll down to **TODAY'S SCHEDULE**.

**✅ What you should see:**

- Either a list of session rows (time on the left, subject in the middle, a status pill on the right), OR the empty-state line **"No classes scheduled today."**
- If a session is live right now, the status pill is red with a pulsing dot and says **LIVE**.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.5 — Weak topics list renders OR empty state

**👉 Do this:**

1. Below today's schedule (or in the right column on desktop), look for **WEAK TOPICS**.

**✅ What you should see (either-or):**

- A list of topic cards with an amber percentage badge on the left (e.g., `42%`) + topic name + "Practice this topic" / "Review in library" link.
- OR the green empty-state card **"All topics looking strong. Keep it up."**

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.6 — Continue learning strip (if applicable)

**👉 Do this:**

1. If you've watched any video or opened any PDF before, look for **CONTINUE LEARNING** — a horizontal strip of cards with a thin progress bar at the bottom of each card.

**✅ What you should see:**

- Each card shows a play/file icon, title, a thin blue progress bar (the % watched), and `25% watched` / `40% read` label below.
- If you haven't watched anything yet, this section is hidden — also PASS.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _If FAIL, what you saw:_

---

### A.7 — Streak modal opens with 30-day heatmap

**👉 Do this:**

1. Click the flame chip in the top-right of the dashboard.

**✅ What you should see:**

- A modal slides up (or fades in on desktop) titled **"Your streak"**.
- A big flame icon + the streak number ("5 day streak") + "Best streak: N days".
- A grid of 30 small rounded squares — emerald-green for active days, grey for inactive. Today is outlined in blue.
- A bottom card explaining "How streaks work".
- Press `Esc` (or click outside the modal) to close — the dashboard returns.

**❓ If something looks different:**

- Modal doesn't open → click directly on the flame icon (not the surrounding pill). Try again.
- Heatmap is empty → the `activity_days` query may have returned no rows for this account. PASS as long as the modal itself opens.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §B — Profile + Mastery + Badges

`/profile` has a 3-tab segmented control (Profile / Mastery / Badges) + a Change Password dialog. Identity fields are READ-ONLY (D-016).

### B.1 — Navigate to Profile and confirm the 3-tab segmented control

**👉 Do this:**

1. Click your profile picture / avatar in the side rail (or bottom tabs on mobile-web).
2. Choose **My Profile**, OR type `http://localhost:3000/profile` directly.

**✅ What you should see:**

- A header card with your initials in a blue square, your full name, and your email.
- Below: a 3-segment control with **Profile** / **Mastery** / **Badges**. **Profile** is selected (white background, blue text).

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### B.2 — Identity fields are READ-ONLY (D-016)

**👉 Do this:**

1. On the **Profile** tab, scroll through Email, Phone, DOB, Batch, Course.
2. Try clicking the value text or pressing Tab to focus into them.

**✅ What you should see:**

- Each field has a small grey lock icon on the right side.
- The values are plain text — there are no `<input>` boxes you can type into.
- Below the list: an info card explaining "Identity details are managed by your institute admin."
- Two buttons at the bottom: **Change password** (blue) and **Contact admin** (outlined).

**❓ If something looks different:**

- If any identity field appears as an editable input → that's a **D-016 violation**; mark FAIL.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### B.3 — Change password dialog opens and validates

**👉 Do this:**

1. On the Profile tab, click **Change password**.
2. The dialog opens. Enter `weak` in the New password field.
3. Re-enter `weak` in the Confirm field.
4. Click **Change password** in the dialog.

**✅ What you should see:**

- An inline error appears under the password field: **"Use at least 10 characters"**.
- The dialog stays open.

**👉 Then do:**

5. Type a strong password in both fields (e.g., `Test12345Long`) — but DO NOT submit yet.
6. Change the Confirm field to a different string.
7. Click **Change password**.

**✅ What you should see:**

- An inline error under the Confirm field: **"Passwords do not match."**

**👉 Final:**

8. Click **Cancel** to close the dialog. **Do NOT** actually change the password (you'd lock yourself out of the test account).

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### B.4 — Mastery tab renders (or shows empty state)

**👉 Do this:**

1. Click the **Mastery** tab.

**✅ What you should see (either-or):**

- A list of topic cards. Each shows the topic name on the left, a percentage on the right (red if `<50`, amber if `50-74`, emerald if `75+`), a progress bar matching the colour, and a footer line like "Avg of last 5 attempts · practiced Today".
- OR a friendly empty state: **"Finish a quiz or exam and your per-topic mastery shows up here."**

**❓ If something looks different:**

- Permanent spinner → the mastery query errored. Open DevTools → Network → check the `mastery?...` request.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### B.5 — Badges tab renders the grid + earned count

**👉 Do this:**

1. Click the **Badges** tab.

**✅ What you should see:**

- A summary row at the top: `N earned · M to go` (the numbers depend on your seed).
- A grid of badge tiles (3 columns on mobile-web, 4 on desktop). Earned badges look bright; locked ones are greyed out with a small lock overlay.
- Click any earned badge → a detail card appears below showing the badge name + earned date.

**❓ If something looks different:**

- Badge icons missing (just outlines) → the `badge-icon-sign` edge fn may have errored; reload the page.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### B.6 — Direct deep-link to a tab via `?tab=`

**👉 Do this:**

1. In Chrome's address bar, navigate to `http://localhost:3000/profile?tab=mastery`.

**✅ What you should see:**

- The Profile page loads with the **Mastery** tab pre-selected.
- Repeat for `?tab=badges` — the Badges tab is pre-selected.
- `?tab=profile` (or no `?tab=`) — Profile tab is pre-selected.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §C — Leaderboard

`/leaderboard` shows your batch ranking with a Weekly / All-time scope toggle, your rank pinned at the top, and a public-card dialog when you click a peer.

### C.1 — Navigate to Leaderboard and confirm the layout

**👉 Do this:**

1. Click **Leaderboard** in the side rail (or bottom tabs).

**✅ What you should see:**

- A trophy icon on the left of the header, **"Leaderboard"** as the title, and your batch name (e.g., `Batch A`) as the subtitle.
- A blue info button (the `i` icon) on the far right of the header.
- Below: a 2-segment control **Weekly** / **All-time**, with Weekly selected.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### C.2 — My-rank card surfaces (or empty state)

**👉 Do this:**

1. Look just below the segmented control.

**✅ What you should see (either-or):**

- A dark blue card labelled **"YOUR RANK"** with a big number `#N / total` on the left and your composite score (e.g., `0.62`) on the right.
- OR (if your seed has no leaderboard data yet) — an empty state with a trophy icon: **"No rankings yet"**.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### C.3 — Scope toggle swaps the list

**👉 Do this:**

1. Click the **All-time** segment.

**✅ What you should see:**

- The list re-fetches (briefly may show skeletons).
- The numbers may shift (your weekly rank can differ from your all-time rank).
- Click back to **Weekly** — the original list returns.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### C.4 — Tap a peer → public-card dialog

**👉 Do this:**

1. Click any row in the list (you can click your own row too).

**✅ What you should see:**

- A dialog opens showing the student's full name (or "You"), their batch name, a small streak pill (flame + N day streak), and a grid of their earned badges.
- If the RPC returns null (e.g., the peer left your batch) → the dialog shows **"Card unavailable — This student may have left your batch."** (instead of crashing). PASS either way.
- Press `Esc` to close.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### C.5 — "How rank is calculated" modal explains the composite

**👉 Do this:**

1. Click the blue `i` info button in the header.

**✅ What you should see:**

- A modal opens titled **"How rank is calculated"**.
- Three rows: **60%** Quiz & exam scores (blue), **25%** Activity (green), **15%** Streak (orange). Each row has a short description.
- Press `Esc` to close.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §D — Attendance

`/attendance` shows a rotating QR (refreshes every ~25 s, expires every 30 s), today's classes, and a 30-day history with two attendance rings.

### D.1 — Heading + QR card appear (or empty-state)

**👉 Do this:**

1. Click **Attendance** in the side rail.

**✅ What you should see (either-or):**

- A heading "Attendance" + "Show your QR to the teacher to mark yourself present."
- A large white rounded card with a QR code in the middle, a label **QR FOR** + the class name, and a small line "Refreshes in NN s".
- OR — if no class window is open right now — a card with a calendar icon: **"No class window open — QR will appear when a class starts."**

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### D.2 — QR rotates every ~25 seconds

**👉 Do this:**

1. If a QR is showing, **watch the small "Refreshes in NN s" line below the QR code**.
2. Wait ~30 seconds.

**✅ What you should see:**

- The countdown ticks down each second.
- When it reaches `0`, the displayed QR briefly changes (a fresh token from `attendance-qr-sign`).
- The countdown resets to ~25 s.

**❓ If something looks different:**

- Countdown stuck → reload the page. If still stuck, check DevTools → Network → the `attendance-qr-sign` POST should fire every ~25 s.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A (no open class) — _If FAIL, what you saw:_

---

### D.3 — Today's classes list renders below the QR

**👉 Do this:**

1. Scroll down to **TODAY'S CLASSES**.

**✅ What you should see (either-or):**

- A list of classes scheduled today, each with a clock icon, subject name, start–end time, and a status pill (Open / Soon / Closed / Present / Late / Absent).
- OR the line **"No classes scheduled today."**

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### D.4 — History rings + recent attendance list

**👉 Do this:**

1. Scroll down to **MY HISTORY**.

**✅ What you should see:**

- Two blue circles side-by-side: **This week** and **Last 30 days**, each showing a percentage and `N / M classes`.
- Below them: a list of recent attendance rows (status icon + subject + day + time + status label + method).
- If no history yet, the list says **"No attendance records yet."** — still PASS.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### D.5 — Realtime: teacher scan → row flips to Present (simulated)

**👉 Do this:**

This needs a teacher to actually scan your QR, which isn't possible in Phase 2 (teacher scan UI ships in Phase 4). To simulate the realtime path:

1. Open a second tab in Chrome.
2. In the second tab, log in as the seed admin (`owner@fynestudy.example.com` / `FyneOwner#2026`) at `https://fyne-study-app-admin.vercel.app`.
3. In the admin panel, find the student `review.student@fynestudy.app`, open today's session, and **mark them present manually**.
4. Switch back to the first tab (the student attendance screen). Within 2-3 seconds, the realtime channel should update.

**✅ What you should see:**

- The status pill for that session changes from **Open** to **Present** without a page reload.
- The "Today's classes" row updates.
- The "My history" rings increase by one.

**❓ If something looks different:**

- No realtime update → reload the page; if it now shows Present, the realtime channel didn't fire. This is a soft-fail (functional but slow). Note it and continue.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A (no admin access) — _If FAIL, what you saw:_

---

### D.6 — Realtime channel cleanup on navigation

**👉 Do this:**

1. While on `/attendance`, open DevTools → **Console**.
2. Navigate away (click any other tab).
3. Back to `/attendance`.
4. Watch the Console for any errors mentioning `channel`, `postgres_changes`, or `cannot add ... after subscribe()`.

**✅ What you should see:**

- No errors related to channels in the Console. (Some Next.js dev warnings about Fast Refresh are fine.)

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §E — Classes shell

`/classes` shows three segments (Live / Upcoming / Recorded) and an Exams discovery section below. Live + Recorded are placeholders pointing to Phase 4; Upcoming is fully wired.

### E.1 — Navigate to Classes and confirm the 3-segment control

**👉 Do this:**

1. Click **Classes** in the side rail.

**✅ What you should see:**

- A video icon + **"My Classes"** heading + "Live, upcoming and recorded sessions plus exams." subtitle.
- A 3-segment control: **Live** / **Upcoming** / **Recorded**, each with a count badge if non-zero.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### E.2 — Upcoming segment wires real data

**👉 Do this:**

1. Click the **Upcoming** segment.

**✅ What you should see (either-or):**

- A list of upcoming sessions with subject name + day + start time. (Hovering a row shows a subtle border.)
- OR an empty state: **"No upcoming sessions — Your schedule for the next 14 days is clear."**

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### E.3 — Live segment is a Phase-4 placeholder

**👉 Do this:**

1. Click the **Live** segment.

**✅ What you should see:**

- If no class is live: empty state **"No live class right now — When a class starts, it will appear here. Live playback ships in Phase 4."**
- If a class IS marked live by an admin: a red-bordered row with **LIVE** pill — and below the list, a note **"Live class playback lands in Phase 4 — for now, this list shows the session as live."**

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### E.4 — Exams discovery section + Phase-3 note

**👉 Do this:**

1. Scroll past the Live/Upcoming/Recorded list to **EXAMINATIONS**.

**✅ What you should see (either-or):**

- A list of exams with title, day + time + duration, and a status pill (Scheduled / Live now / Results pending / Results out / Ended).
- A footer line **"Exam attempts (taking the exam) ship in Phase 3."**
- OR (if no exams in seed) — an empty state line.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §F — Library

`/library` is a Subject → Chapter → Topic → Item drill-down. Drill state lives in the URL (`?subject=...&chapter=...&topic=...`) so the browser back button works. A debounced search filters across all levels.

### F.1 — Subjects view renders + search box

**👉 Do this:**

1. Click **Library** in the side rail.

**✅ What you should see:**

- A blue books icon + **"Library"** + "Subjects → Chapters → Topics → Items".
- A search input with a magnifying glass icon — placeholder **"Search content…"**.
- A 2-column grid (1 column on mobile) of subject cards. Each card has an icon, the subject name, and an item count.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### F.2 — Drill-down through Subject → Chapter → Topic → Item

**👉 Do this:**

1. Click any subject card.
2. The header changes to that subject's name + "Chapters". A back arrow appears on the left of the header.
3. Click any chapter row.
4. Now showing the topics list.
5. Click any topic row.
6. Now showing the items list (videos, PDFs, notes).

**✅ What you should see at each step:**

- The URL updates with `?subject=...`, `?subject=...&chapter=...`, `?subject=...&chapter=...&topic=...`.
- The browser's back button returns to the previous level (and the URL strips one param).
- The custom back arrow in the header does the same.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### F.3 — Search filters across the tree

**👉 Do this:**

1. Go back to the top-level Subjects view.
2. In the search box, type `kinematics` (or any topic name from your seed).

**✅ What you should see:**

- After a brief delay (~300ms), the URL updates with `?q=kinematics`.
- The subjects list filters down — subjects with no matching items disappear.
- Click into the remaining subject — only chapters with matches show.

**❓ If something looks different:**

- URL doesn't update → DevTools Console may show a Next.js navigation error; reload.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### F.4 — Items list shows kind + duration + click-through

**👉 Do this:**

1. Drill into any topic.
2. Look at the items list.

**✅ What you should see:**

- Each row has an icon (play circle for video, file for PDF, sticky note for note), title, kind label, and duration where applicable.
- A click on a video row navigates to `/video/<contentId>`.
- A click on a PDF row navigates to `/pdf/<contentId>`.
- Note rows are visually dimmed and not clickable ("Note · coming soon").

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### F.5 — "Practice quizzes" footer surfaces (if quizzes exist for the topic)

**👉 Do this:**

1. Pick a topic with at least one practice quiz in your seed (e.g., a topic in Physics→Mechanics).

**✅ What you should see:**

- Below the items list, an amber-tinted card titled **PRACTICE QUIZZES** with a list of quiz titles.
- Each quiz row has a small grey **Phase 3** badge on the right.
- (Quizzes themselves don't launch — Phase 3 builds the attempt screen.)

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A (no quizzes in seed) — _If FAIL, what you saw:_

---

# §G — Video player

`/video/[contentId]` mounts a `react-youtube` player, overlays a CSS-animated watermark, throttles progress writes to once per 10s, and shows a "Resume from M:SS?" sheet when you re-open a partly-watched video.

### G.1 — Open a video → player loads with watermark

**👉 Do this:**

1. From the Library, click a video item.

**✅ What you should see:**

- The page goes mostly black with a small back arrow + the video title at the top.
- A YouTube IFrame loads in the middle (it shows the YouTube play button — D-173 forbids hiding it).
- A small white text overlay appears in one corner of the video area showing something like **"YourFirstName • ••1234"** — this is the watermark.
- DevTools → Elements: the IFrame has `youtube.com` in its `src` attribute. The watermark `<span>` is `position: absolute` on top.

**❓ If something looks different:**

- Video shows "Could not load video" → the `yt-playback-sign` edge fn returned 409 (no YT video bound yet) or the seed lacks the YT video ID. Try a different video.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### G.2 — Watermark rotates corners over time

**👉 Do this:**

1. Watch the watermark for ~60 seconds.

**✅ What you should see:**

- Every 12 seconds (60s ÷ 5 positions), the watermark jumps to a different corner / position (top-left → top-right → bottom-left → bottom-right → bottom-centre → repeat). This is a CSS-only animation — no React re-renders.

**❓ If something looks different:**

- Watermark is in the same spot the whole time → the CSS animation didn't load. Reload the page.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### G.3 — D-173: YouTube play button is visible (controls are NOT hidden)

**👉 Do this:**

1. Look at the YouTube IFrame.

**✅ What you should see:**

- The standard YouTube play button is visible in the centre when paused.
- The bottom timeline / play / pause / volume / settings controls show on hover. (D-173: never set `controls=0`.)
- The YouTube branding "watermark" + "title overlay" do NOT appear because we set `modestbranding=1` + `iv_load_policy=3` + `rel=0`.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### G.4 — Progress saves at most every 10 seconds (network tab)

**👉 Do this:**

1. Open DevTools → **Network** → filter by **Fetch/XHR**.
2. Press the YouTube play button. Watch for ~25 seconds.

**✅ What you should see:**

- Roughly every 10 seconds, a POST to `video_progress?...` (an upsert) fires.
- Between those calls, the progress polling tick (in the YouTube IFrame) fires more often, but the network call is throttled.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### G.5 — Resume sheet appears on re-open

**👉 Do this:**

1. Play the video for ~20 seconds.
2. Click the back arrow (top-left). You return to the library.
3. Click the same video item again to re-enter.

**✅ What you should see:**

- A bottom sheet (mobile) or centred modal (desktop) appears: **"Resume from 0:NN?"** with two buttons **Start over** + **Resume**.
- Click **Resume** → the player seeks back to your last position. The sheet dismisses.
- (If you clicked **Start over**, the player loads from 0. PASS either way.)

**❓ If something looks different:**

- Sheet doesn't appear → the progress wasn't saved (try playing for 15+ seconds before navigating away — the 10s throttle means a single brief play may not write).

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §H — PDF viewer

`/pdf/[contentId]` mounts `react-pdf` with a bundled `pdfjs` worker, overlays a tiled diagonal watermark, and saves the current page to `pdf_progress` every 5 seconds.

### H.1 — Open a PDF → viewer loads with header + signed URL

**👉 Do this:**

1. From the Library, click a PDF item.

**✅ What you should see:**

- Dark slate background. Header at the top with a back arrow + the PDF title.
- A page indicator like **"Page 1 / 12"**.
- Below: the first page renders as a centred canvas with a subtle shadow.
- DevTools → Network → the response of a `content-pdf-sign` request returns a JSON body with `signed_url`, `expires_at`, `file_path`.

**❓ If something looks different:**

- "Could not load PDF" → the `content-pdf-sign` edge fn errored. Check DevTools → Network for the status code.
- Blank canvas → pdf.js worker failed. Check DevTools → Console for a worker error.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### H.2 — Diagonal watermark grid overlays the canvas

**👉 Do this:**

1. Look at the PDF rendering area.

**✅ What you should see:**

- A grid of `YourName • ••1234` watermarks tiled diagonally across the viewport at ~-30° rotation, semi-transparent, white-on-shadow.
- The watermark stays visible as you scroll (it's `position: fixed inset:0`).

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### H.3 — Page indicator updates as you scroll

**👉 Do this:**

1. Scroll down through the PDF.

**✅ What you should see:**

- The "Page 1 / N" header updates to "Page 2 / N", "Page 3 / N", etc., as new pages cross the 50% viewport threshold.
- (Each page change re-saves to `pdf_progress` via a 5s throttle.)

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### H.4 — Page resume on re-open

**👉 Do this:**

1. Scroll the PDF to a specific page (e.g., page 5).
2. Wait 6 seconds (so the 5s throttle has saved).
3. Click the back arrow → return to library.
4. Re-open the same PDF.

**✅ What you should see:**

- The viewer loads at (or near) page 5 — not page 1.
- Some browsers may render starting at page 1 then jump to page 5 once mounted — also PASS as long as it settles near where you left off.

**❓ If something looks different:**

- Always starts at page 1 → the `pdf_progress` upsert may not be firing (check DevTools → Network).

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### H.5 — Native browser pinch-zoom works on the canvas

**👉 Do this:**

1. On a laptop with a trackpad: pinch-out on the canvas.
2. On Chrome desktop: hold `Ctrl` + scroll up.

**✅ What you should see:**

- The page canvas grows / shrinks smoothly.
- The watermark grid scales independently (it's a fixed overlay).
- D-174 doesn't apply on web — browsers handle pinch-zoom natively.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §I — Settings menu + sign-out

`/menu` is a list of placeholder rows (most show an alert), with a sign-out row at the bottom.

### I.1 — Open Settings and scan the row groups

**👉 Do this:**

1. Click **Settings** (gear icon) in the side rail.

**✅ What you should see:**

- Heading **"Settings"**.
- Three groups: **GENERAL** (Account information, Notifications, Language, Display theme), **SECURITY** (Privacy settings, Connected devices), **ABOUT** (Help & support, Terms & policies).
- A red **Sign out** row at the bottom.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### I.2 — Future-update alerts fire

**👉 Do this:**

1. Click **Notifications**.

**✅ What you should see:**

- A browser alert pops up: **"This setting will be available in a future update."**
- Click OK to dismiss.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### I.3 — Sign-out works and back-button cannot re-enter

**👉 Do this:**

1. Click **Sign out** (red row at the bottom).

**✅ What you should see:**

- You land on `/login` with the sign-in form.

**👉 Then:**

2. Press the browser back button.

**✅ What you should see:**

- You stay on `/login` (the middleware re-checks the auth cookie; without a session, all protected paths bounce here).

**👉 Finally:**

3. Sign back in (`review.student@fynestudy.app` / `ReviewStudent#2026`) — you need to be logged in for the rest of the test plan.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §J — Responsive + carry-overs

### J.1 — Resize from 1440px → 360px

**👉 Do this:**

1. Open the dashboard at `http://localhost:3000/`.
2. Open DevTools (F12), enable **Device Toolbar** (mobile icon at the top).
3. Switch to a custom width and drag the width handle from 1440 down to 360.

**✅ What you should see:**

- Above ~1024px: dashboard is 2 columns (NextCard + StatsStrip + TodaySchedule on the left, WeakTopics + RecentBadges on the right).
- Below ~1024px: dashboard becomes a single column. Side rail disappears, bottom tabs appear at 360px.
- No horizontal scrollbars, no text overflow.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### J.2 — Bottom tabs render at mobile widths

**👉 Do this:**

1. In Device Toolbar, set width to 375 (iPhone 14 Pro size).

**✅ What you should see:**

- A bottom tab bar appears at the bottom of the viewport with the student tabs (Home, Classes, Library, Attendance, Leaderboard, Profile, Menu).
- The top side rail is hidden.
- The currently selected tab is highlighted (active tint).

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### J.3 — iOS Safari + PWA install (carry-over after Vercel deploy)

**👉 Do this:**

This requires HTTPS, which `http://localhost:3000` doesn't provide. Defer until the Vercel deploy lands.

`Result:` [ ] N/A — carry-over (needs HTTPS)

---

### J.4 — Android Chrome + PWA install (carry-over after Vercel deploy)

Same as J.3.

`Result:` [ ] N/A — carry-over (needs HTTPS)

---

# §K — Security checks

These are defence-in-depth. Phase 2 doesn't render quiz/exam attempts (Phase 3), but the discovery API still must NOT leak any solution data.

### K.1 — No `is_correct` / `answer_key` in network responses

**👉 Do this:**

1. Open DevTools → **Network** → filter for `XHR`.
2. Navigate `/` → `/classes` → `/library` in sequence.
3. For each network response (Supabase REST + edge fn calls), click it → **Response** tab → search (Ctrl+F) for: `is_correct`, `correct_option_id`, `answer_key`, `solution_text`, `service_role`.

**✅ What you should see:**

- ZERO matches across all responses.

**❓ If something looks different:**

- If ANY of those strings appear → mark FAIL and flag immediately. This is a hard-rule violation (CLAUDE.md).

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, where it appeared:_

---

### K.2 — Service-role key is NOT in the JS bundle

**👉 Do this:**

1. From PowerShell, in the repo root:
   ```powershell
   pnpm --filter @fynestudy/web build
   ```
2. Wait for the build to finish (~30 s).
3. Search the production bundle for the banned string:
   ```powershell
   Get-ChildItem apps/web/.next/static -Recurse -Include *.js |
       Select-String -Pattern "SUPABASE_SERVICE_ROLE|service_role" -List
   ```

**✅ What you should see:**

- Zero matches. (Empty output.)

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### K.3 — All Storage URLs are signed (PDF + badge icons)

**👉 Do this:**

1. Open DevTools → **Network**.
2. On the dashboard, expand the network log; look for any image / PDF requests to `https://*.supabase.co/storage/...`.
3. Click each → look at the URL.

**✅ What you should see:**

- Every Storage URL contains a `token=...` query parameter. These are signed URLs from `content-pdf-sign`, `badge-icon-sign`, or the YouTube wrapper. There are NO unsigned bucket reads.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### K.4 — Realtime channel grep (no ghost subscriptions)

**👉 Do this:**

1. From PowerShell, in the repo root:
   ```powershell
   Select-String -Path "apps/web/features/**/*.ts","apps/web/components/**/*.tsx" -Pattern "supabase\.channel\("
   ```
2. Then:
   ```powershell
   Select-String -Path "apps/web/features/**/*.ts","apps/web/components/**/*.tsx" -Pattern "removeChannel\("
   ```

**✅ What you should see:**

- Both greps return ONE match each — both in `features/attendance/useAttendanceRealtime.ts`. They match: the file subscribes once and removes once on cleanup.
- (If Phase 2 had multiple realtime hooks, both greps would return matching counts — never more `channel(` than `removeChannel(`.)

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §L — Automated test gates

Run all four commands in PowerShell from the repo root. Each MUST exit with code 0.

### L.1 — Typecheck

```powershell
pnpm --filter @fynestudy/web typecheck
```

**✅ What you should see:** the command completes with no error output and returns to the prompt with exit code 0.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, error excerpt:_

---

### L.2 — Lint

```powershell
pnpm --filter @fynestudy/web lint
```

**✅ What you should see:** `> @fynestudy/web@0.0.0 lint > eslint` followed by no output and exit code 0.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, error excerpt:_

---

### L.3 — Vitest unit tests

```powershell
pnpm --filter @fynestudy/web test
```

**✅ What you should see:**

- `Test Files  8 passed (8)` (or higher — Phase 2 added 6 new test files on top of Phase 1's 2).
- `Tests       41 passed (41)` (or higher).

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, counts:_

---

### L.4 — Next.js build

```powershell
pnpm --filter @fynestudy/web build
```

**✅ What you should see:**

- `Route (app)` table at the end with at least these new dynamic routes: `/`, `/attendance`, `/classes`, `/leaderboard`, `/library`, `/menu`, `/pdf/[contentId]`, `/profile`, `/video/[contentId]`.
- `(serwist) Bundling the service worker script with the URL '/sw.js'...` succeeds.
- No `Attempted import error: ...` warnings.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, error excerpt:_

---

### L.5 — Playwright E2E (Chrome only, on the running dev server)

```powershell
pnpm --filter @fynestudy/web e2e -- --project=chromium-desktop
```

**✅ What you should see:**

- All tests pass. Multi-role + suspended cases are auto-skipped (you can confirm with `N skipped` in the summary).
- New Phase 2 specs that run: `dashboard.spec.ts`, `profile.spec.ts`, `leaderboard.spec.ts`, `attendance.spec.ts`, `library.spec.ts`, `security.spec.ts`.

**❓ If something looks different:**

- `webServer timed out starting` → the dev server (port 3000) isn't running. Start it in another terminal first.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, counts:_

---

# §M — Acceptance sign-off

Tick each section you've signed off. If any FAIL, list the test ID next to it.

- [ ] §0 Setup
- [ ] §A Dashboard
- [ ] §B Profile + Mastery + Badges
- [ ] §C Leaderboard
- [ ] §D Attendance
- [ ] §E Classes shell
- [ ] §F Library
- [ ] §G Video player
- [ ] §H PDF viewer
- [ ] §I Settings + sign-out
- [ ] §J Responsive + carry-overs (J.3 + J.4 = N/A)
- [ ] §K Security checks
- [ ] §L Automated gates

**Failures (test IDs + 1-line note):**

```
(leave blank if no failures)
```

**Carry-overs to Phase 5 (Hardening / Launch):**

- iOS Safari + Android Chrome PWA install (needs HTTPS / Vercel deploy)
- Multi-role + suspended account flows (accounts never created in Phase 1)
- Live class playback + recording playback (Phase 4)
- Quiz / exam attempts (Phase 3)
- Note rendering (Phase 3+ with KaTeX for math)

**Tester name:** ________________

**Date:** ________________

**Notes:**

```
(optional — anything you want to flag for the next phase)
```

---

# Troubleshooting cheat-sheet

| Symptom | Likely cause | Fix |
|---|---|---|
| `pnpm --filter @fynestudy/web dev` errors `ENOENT pdfjs-dist` | New Phase 2 deps not installed | `pnpm install` from repo root, then re-run `dev` |
| `/video/<id>` shows "Could not load video" | `yt-playback-sign` returned 409 (no YT video for that content row) | Try a different video. If all videos fail, check `apps/functions/yt-playback-sign/index.ts` logs in Supabase |
| `/pdf/<id>` shows a blank dark page | `pdfjs-dist` worker URL not resolved | DevTools → Console → look for a pdf.worker error. Rebuild: `pnpm --filter @fynestudy/web build` |
| Watermark missing or static | CSS animation didn't load | Reload the page (Ctrl+F5). Reproduce in DevTools → Elements → search the page for `wmCycle` |
| QR countdown stuck at NN | `attendance-qr-sign` request failing | DevTools → Network → check the POST response. Likely cause: no class window is open (status 400) |
| Realtime channel error in Console | A channel was reused with the same name | Phase 2 uses a random suffix; if you see this, ping me with the exact error text |
| `pnpm test` errors `Cannot find module '@/lib/ist'` | Vitest path alias broken | Check `vitest.config.ts` has `alias: { "@": "." }`. Re-run after `pnpm install` |
| Lint complains `Unsafe assignment` on `useStudentExams.ts` | Newer TS-strict | The hook intentionally coerces from `unknown`; we run with `noUncheckedIndexedAccess: true`. If lint is mad, paste the rule code and I'll patch |

---

_Phase 2 manual test plan — generated 2026-05-28. Mirrors the format of `phase-1-manual-tests.md`. Sign off in §M when every box is ticked or marked N/A._
