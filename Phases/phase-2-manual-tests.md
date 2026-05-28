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
| **§0.4 + §A–§L all student tests** | `review.student@fynestudy.app` | `ReviewStudent#2026` |
| **§A.99 teacher-tab fallback (optional)** | `review.teacher@fynestudy.app` | `ReviewTeacher#2026` |
| Bonus extra student (Aarav, Batch A) — for §C peer-card test | `test.aarav@fynestudy.app` | `TestPass#2026` |
| Bonus extra student (Diya, Batch A) — same | `test.diya@fynestudy.app` | `TestPass#2026` |

**Skipped sections (mark N/A):**
- iOS Safari + Android Chrome carry-overs (§J.3, §J.4) — needs the Vercel deploy that ships later this week.
- Multi-role student/teacher account switch — account never created in Phase 1.
- Suspended-during-session edge case — would require an admin to suspend mid-test.

> Source of truth for credentials: `CREDENTIALS.local.md` at the repo root (git-ignored, do not paste publicly).

---

## Table of contents

- **§0 Setup** — refresh deps, env, dev server, DevTools (6 sub-tasks)
- **§A Dashboard** — greeting, Up-next, stats, today's schedule, weak topics, continue, recent badges, streak modal (8 tests)
- **§B Profile + Mastery + Badges** — 3-tab segmented + identity read-only (D-016) + change-password dialog (D-153) (7 tests)
- **§C Leaderboard** — scope toggle + my-rank pinned + public-card dialog + calc modal (6 tests)
- **§D Attendance** — rotating QR + today's classes + history rings + realtime mark + channel cleanup (7 tests)
- **§E Classes shell** — Live / Upcoming / Recorded segments + exams discovery (5 tests)
- **§F Library tree** — subject → chapter → topic → item drill-down + URL state + search + practice-quiz footer (7 tests)
- **§G Video player** — `react-youtube` + watermark + 10-s throttled progress + Resume / Start-over sheet (6 tests)
- **§H PDF viewer** — `react-pdf` + tiled watermark + page tracking + 5-s throttle + resume (6 tests)
- **§I Settings menu + sign-out** — list rows + future-update alerts + sign-out + back-button (4 tests)
- **§J Responsive + carry-overs** — desktop ↔ mobile-web at 320 → 1440 px (4 tests, 2 carry-over)
- **§K Security checks** — no `is_correct`, no service-role-key, signed URLs only, realtime cleanup grep (5 tests)
- **§L Automated test gates** — typecheck / lint / vitest / build / Playwright (5 commands)
- **§M Acceptance sign-off** — tick boxes per section + tester name + date

---

# §0 — Setup (do this once, before any test below)

This section gets your laptop ready. Allow ~10 minutes the first time, ~3 minutes after.

### 0.1 — Confirm the repo + branch + working directory

**👉 Do this:**

1. Open **PowerShell** on Windows: press `Win+R`, type `powershell`, press Enter.
2. Navigate to the repo:
   ```powershell
   cd C:\Users\kaust\OneDrive\Desktop\FyneStudyLive
   ```
3. Check the branch:
   ```powershell
   git status
   ```

**✅ What you should see:**

- The first line says: `On branch web-phase-1`. This branch is shared by Phase 1, Phase 2 (you're here), Phase 3, Phase 4, and Phase 5 — one long-lived web track branch.
- Below: a list of files marked `M` (modified) or `??` (untracked). Phase 2's files were committed in `bd7b0c9`, so untracked items should now mostly be `store-assets/`, `START-HERE.md`, etc. **There may also be `M` rows for files unrelated to Phase 2 (`docs/`, `apps/mobile/`)** — those are pre-existing edits from prior phases, leave them alone.
- Then run `git log --oneline -3` — the top commit should be **`feat(web-phase-2): student learning surfaces`** (`bd7b0c9` or similar).

**❓ If something looks different:**

- Says `On branch main` or `On branch phase-4` → wrong branch. Run `git checkout web-phase-1` and re-check.
- Says `fatal: not a git repository` → you're in the wrong folder. Re-run the `cd` command exactly as shown.
- The top commit is NOT `feat(web-phase-2)…` → the Phase 2 commit landed somewhere else; ping me before proceeding.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### 0.2 — Confirm `apps/web/.env.local` still has the right keys

This file was set up in Phase 1. Phase 2 didn't change it — just confirm it's still present and correct.

**👉 Do this:**

1. In PowerShell:
   ```powershell
   notepad apps/web/.env.local
   ```
2. Notepad opens with the file.

**✅ What you should see (3 lines, in any order):**

```
NEXT_PUBLIC_SUPABASE_URL=https://orqwyazvcthgxoadfxfv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ZfvA-ky5eOQ3c-e9yCiLnQ_c06ZYmz9
NEXT_PUBLIC_ADMIN_URL=https://fyne-study-app-admin.vercel.app
```

There MUST NOT be a `SUPABASE_SERVICE_ROLE_KEY` line, a `SENTRY` line, or any other secret. If there is, delete it now — the web client never gets the service-role key.

**❓ If something looks different:**

- "Cannot find the path …" → the file is missing. Create it at `C:\Users\kaust\OneDrive\Desktop\FyneStudyLive\apps\web\.env.local` with the 3 lines above. In Notepad's Save dialog, set **Save as type: All Files** so it doesn't add `.txt`.
- A line says `SUPABASE_SERVICE_ROLE_KEY=...` → delete that line and save. Critical security check.

Close Notepad after confirming.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### 0.3 — Refresh dependencies (Phase 2 added new deps)

Phase 2 added 5 new npm packages (`react-pdf`, `pdfjs-dist`, `react-youtube`, `use-debounce`, `canvas-confetti`). If you haven't run install since the Phase 2 commit, do it now.

**👉 Do this:**

1. In PowerShell, from the repo root:
   ```powershell
   pnpm install
   ```
2. Wait ~30 seconds.

**✅ What you should see:**

- Output ends with something like:
  ```
  Done in 18.8s using pnpm v10.33.0
  ```
- Yellow `WARN` lines about peer deps or `Ignored build scripts: canvas, esbuild, sharp, ...` are normal.

**❓ If something looks different:**

- `ELIFECYCLE` or `ENOENT` red error → run `pnpm install` from the repo root specifically (not `apps/web/`). If still failing, delete `node_modules` and `pnpm-lock.yaml` and re-run.
- "Cannot find module 'react-pdf'" or similar at later runtime — confirms this step was skipped; re-run `pnpm install`.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### 0.4 — Start the dev server

**👉 Do this:**

1. From the repo root in PowerShell:
   ```powershell
   pnpm --filter @fynestudy/web dev
   ```
2. Wait ~15 seconds.

**✅ What you should see (in the terminal):**

```
> @fynestudy/web@0.0.0 dev …
> next dev

   ▲ Next.js 15.5.18
   - Local:        http://localhost:3000
   - Network:      http://192.168.x.x:3000
   - Environments: .env.local

 ✓ Starting...
 ○ (serwist) Serwist is disabled.
 ✓ Ready in 3.4s
```

The terminal stays running — that's the dev server. **Do NOT close it** for the rest of the test plan. When you're done, you'll stop it with `Ctrl+C` twice → `Y`.

**❓ If something looks different:**

- "Port 3000 already in use" → another Next.js is already running. Open a NEW PowerShell window and run `taskkill /F /IM node.exe` to kill all Node processes, then re-run the dev command.
- "Cannot find module 'react-pdf'" → you skipped §0.3. Stop the dev server, run `pnpm install`, re-run.
- "Missing env: NEXT_PUBLIC_SUPABASE_URL" → you skipped §0.2. Re-create `.env.local`.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### 0.5 — Open the browser DevTools (refresher from Phase 1)

You'll use DevTools several times below. Skip this step if you're comfortable with F12.

**👉 Do this:**

1. Open **Google Chrome**.
2. Go to: `http://localhost:3000` — you'll be redirected to `/login`.
3. Press **F12** (or right-click → **Inspect**). The DevTools panel opens.

**✅ What you should see:**

- A panel attached to the bottom or right of the browser with tabs at the top: `Elements`, `Console`, `Sources`, `Network`, `Performance`, `Memory`, `Application`, `Security`, `Lighthouse`.
- You can dock it to a separate window by clicking the three-dot menu in DevTools (top-right of the panel) → **Dock side** → undocked icon.

**❓ If you can't find DevTools:** it may have opened in a separate window — check your taskbar for a second Chrome window. Or close Chrome, reopen, and press F12 again.

`Result:` [ ] PASS — DevTools opens.

---

### 0.6 — Log in as the seed student

**👉 Do this:**

1. Still at `http://localhost:3000/login`. If you're not, navigate there.
2. Enter:
   - **Email:** `review.student@fynestudy.app`
   - **Password:** `ReviewStudent#2026`
3. Click **Sign in**.

**✅ What you should see:**

- The button briefly says **"Signing in…"**.
- URL changes to `http://localhost:3000/` (the root).
- An H1 heading appears: **`Good morning, …`** / **`Good afternoon, …`** / **`Good evening, …`** / **`Hi, …`** with your first name appended. (The greeting word matches IST time of day: 5–12 morning, 12–17 afternoon, 17–22 evening, otherwise "Hi".)
- To the right of the heading, a small white pill with a **flame icon** + a number + the word **`days`**.
- On the left, the side-rail with FyneStudy logo + 7 student nav items: **Home** (highlighted blue), **Classes**, **Library**, **Attendance**, **Ranks**, **Profile**, **Menu**.

**❓ If something looks different:**

- "Invalid email or password" → typo. Re-enter exactly: `ReviewStudent#2026` (case-sensitive, no trailing space).
- Goes to `/force-password-change` → the seed flag flipped somehow. Set any valid new password (≥10 chars, upper+lower+digit), then continue.
- Stays on `/login` after click → check the dev terminal for errors; reload the page.
- Greeting heading missing → may be normal for a new account with no data; check the network tab for the `rpc/student_dashboard` call. If it 500s, ping me.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §A — Dashboard

The Phase 2 dashboard replaces the Phase 1 placeholder welcome card. It shows: greeting + streak chip, the **Up next** card (live class / exam / mark attendance / continue quiz), a stats strip (Attendance %, Mastery %, Rank), today's schedule, weak topics, continue learning, and recent badges. Desktop is 2 columns at `lg:` (≥1024px); mobile-web is 1 column.

---

### A.1 — Greeting H1 + streak chip render

**👉 Do this:**

1. You should already be at `http://localhost:3000/`. If not, navigate there.
2. Look at the very top of the main content area.

**✅ What you should see:**

- An H1 heading whose first words are one of: `Good morning, ` / `Good afternoon, ` / `Good evening, ` / `Hi, `. The word matches the current IST hour (see §0.6's table — 5–12 morning, 12–17 afternoon, 17–22 evening, else "Hi").
- The heading ends with your first name (e.g. **"Good morning, Review"** for `Review Student`).
- To the right of the heading, a small white pill containing: a **flame icon**, a number (e.g. `3`), and the word **`days`** (singular `day` if the number is 1).
- The flame icon colour reflects the streak tier:
  - `0` → grey (`#94a3b8`)
  - `1–6` → orange (`#f97316`)
  - `7–29` → darker orange (`#ea580c`)
  - `30–89` → red (`#dc2626`)
  - `90+` → golden yellow (`#eab308`)

**❓ If something looks different:**

- No flame chip visible → the `student_dashboard` RPC may have returned no streak data. Open DevTools → **Network** → filter for `student_dashboard`. The response body should contain a `streak: { current_days, best_days }` object.
- Wrong greeting (says "morning" at 8 PM your local time) → it uses **IST**, not your local timezone. If you're in IST and still wrong, take a screenshot and ping me.
- Heading appears but no streak chip after 5 seconds → the streak query likely 404'd. Ping me with the network panel screenshot.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.2 — "Up next" card surfaces above the fold

**👉 Do this:**

1. Look just below the greeting heading for a tall **blue rounded card**.

**✅ What you should see:**

- A blue rounded card (`bg-primary`, ~`rounded-[28px]`).
- An icon on the left of the card (one of: clock/calendar/trophy/QR code/play-circle/graduation-cap — depending on what's next for you).
- A label **`UP NEXT`** in small caps + a title (e.g. `Physics`, `Mock Exam #1`, `Mark attendance`).
- A description sentence ("Starts in 20 min" / "A live class is happening now…" / "Class window is open. Show your QR to the teacher." / "Nothing scheduled right now…").
- A **white button at the bottom** of the card with a CTA: `Open Classes`, `Show QR`, `Resume`, `See schedule`, or `Open library`.
- If your seed has zero scheduled sessions/exams/quizzes, the card reads **"All caught up — Nothing scheduled right now. Check the library."** with CTA `Open library` — still PASS.

**❓ If something looks different:**

- Card missing entirely → the dashboard RPC returned no `next_card`. Reload the page (Ctrl+F5). If still missing, check the Network tab's `student_dashboard` response.
- Card present but the button does nothing → click should navigate to the route shown in the description; tell me if it doesn't.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.3 — Stats strip — 3 white tiles render and navigate

**👉 Do this:**

1. Just below the Up-next card, look for a row of 3 white tiles.
2. Hover over each tile with the mouse.

**✅ What you should see:**

- Three tiles in a row labelled **Attendance**, **Mastery**, **Rank**. Each shows a numeric value (e.g. `75%`, `82%`, `#3`) OR an em-dash `—` if no data yet.
- On hover, the tile gets a subtle shadow.
- The tiles are equal-width (flex 1 each) on mobile-web; on desktop they form a 3-column row.

**👉 Click each tile in order:**

3. Click the **Attendance** tile → URL becomes `/attendance`. Browser-back to return.
4. Click the **Mastery** tile → URL becomes `/profile?tab=mastery`. Browser-back to return.
5. Click the **Rank** tile → URL becomes `/leaderboard`. Browser-back to return.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.4 — TODAY'S SCHEDULE list renders (or empty state)

**👉 Do this:**

1. Scroll down to the section labelled **`TODAY'S SCHEDULE`** (small caps, slate-500 colour).

**✅ What you should see (either-or):**

- A list of session rows. Each row has:
  - Two times on the left (start over end, both in 12-hour format with AM/PM in IST).
  - The subject name in bold in the middle.
  - A coloured status pill on the right.
- Status pill colours follow this map:
  - **Scheduled** → blue (`bg-blue-50 text-blue-700`)
  - **LIVE** → red (`bg-red-50 text-red-700`) with a tiny pulsing red dot
  - **Ended** → grey (`bg-slate-100 text-slate-600`)
  - **Present** → emerald (`bg-emerald-50 text-emerald-700`)
  - **Late** → amber (`bg-amber-50 text-amber-700`)
  - **Absent** → red
- Click any row → navigates to `/attendance`.
- OR if you have no classes today → a centred grey card with **"No classes scheduled today."**.

**❓ If something looks different:**

- A session that you KNOW is today is missing → check the dashboard RPC response in the Network tab; the `today` array should include it.
- Status pill says "Live" but no red dot → the `bg.dot` flag isn't computing; cosmetic only.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.5 — WEAK TOPICS list renders (or "all strong" empty state)

**👉 Do this:**

1. Below today's schedule (left column on desktop, below on mobile), look for the section labelled **`WEAK TOPICS`**.

**✅ What you should see (either-or):**

- A list of topic cards. Each card has:
  - An **amber percentage badge** on the left (e.g. `42%` in amber-700 inside an amber-50 rounded square).
  - The topic name in bold.
  - A small blue link below the name: **"Practice this topic"** (if a quiz exists for that topic) or **"Review in library"** (otherwise).
  - A small chevron arrow `›` on the right.
- Click any topic card → navigates to `/library` (Phase 3 will route to the quiz instead).
- OR an empty state — a green-tinted card with **"All topics looking strong. Keep it up."** in emerald-700.

**❓ If something looks different:**

- Cards show but the percentages all read 0 → the `mastery_pct` field is empty in the RPC payload; check the Network tab.
- All cards say "Review in library" — that's fine; means no quizzes have been built for those topics yet.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.6 — CONTINUE LEARNING strip (if you have any progress)

**👉 Do this:**

1. If you've played any video or opened any PDF on a previous visit, look for the section labelled **`CONTINUE LEARNING`** — a horizontal scrollable strip of cards.

**✅ What you should see:**

- Each card is ~`w-56` and includes:
  - A play-circle icon (for video) or a document icon (for PDF) on the top-left.
  - The title (line-clamped to 2 lines).
  - A thin blue progress bar at the bottom showing the % watched/read.
  - A small line below: `42% watched` (or `42% read` for PDFs).
- Cards are scrollable horizontally with the mouse-wheel or trackpad.
- If you haven't watched anything, this section is **hidden** — also PASS.

**❓ If something looks different:**

- Cards present but progress bar empty → the `watched_pct` field is missing; check the RPC payload.
- Scroll bar visible — fine; the section is `overflow-x-auto`.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A (no progress yet) — _If FAIL, what you saw:_

---

### A.7 — Streak modal opens with 30-day heatmap

**👉 Do this:**

1. Click the **flame chip** in the top-right of the dashboard (the one from §A.1).

**✅ What you should see:**

- A modal opens (mobile-web slides up, desktop fades in centred).
- Modal title: **"Your streak"** in slate-900 bold.
- A big flame icon centred (colour matches the streak tier from §A.1).
- A large number below the flame (e.g. `5`) + the line `day streak`.
- A smaller line below: `Best streak: N days`.
- Section label: **`LAST 30 DAYS`** (small caps, slate-500).
- A 10-column × 3-row grid of small rounded squares (`size-7` each):
  - Emerald-green for days you were active.
  - Slate-200 for days you weren't.
  - **Today** is outlined with a thin blue ring (`ring-2 ring-blue-500`).
- A bottom card titled **"How streaks work"** in slate-700, with an explainer paragraph in slate-500.
- Press **Escape** → the modal closes.

**❓ If something looks different:**

- Heatmap is all grey (no green squares) → may be normal for a new account that just signed up; PASS.
- Modal won't open → click directly on the flame icon (not the surrounding pill border). Reload and try again.
- Heatmap squares overflow horizontally → window may be too narrow; this is a visual bug to log.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.8 — RECENT BADGES strip renders (or empty state)

**👉 Do this:**

1. Scroll to the section labelled **`RECENT BADGES`** (right column on desktop, below on mobile).

**✅ What you should see (either-or):**

- Three colour-coded badge tiles in a row. Each tile:
  - A coloured square (size 11) holding an award icon. The colour depends on the badge code (e.g. emerald for `first_quiz`, orange for `streak_7`, red for `streak_30`, gold for `streak_90`, violet for `quiz_100`, etc.).
  - The badge name (line-clamped to 2 lines) below the icon.
- OR if you have no recent badges → a centred grey card with **"Earn badges by attending sessions, hitting streaks, and topping quizzes."**.

**❓ If something looks different:**

- Badges show but tile colours are all the same default purple → the `BADGE_COLOR` map isn't picking up the badge code; the badge code field in the RPC payload may be wrong. Ping me.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §B — Profile + Mastery + Badges

`/profile` has a 3-tab segmented control (Profile / Mastery / Badges) + a Change Password dialog. Identity fields are READ-ONLY per **D-016**; password change routes through the `auth-change-own-password` edge fn per **D-153** — NEVER through `supabase.auth.updateUser`.

---

### B.1 — Navigate to Profile + confirm the header card

**👉 Do this:**

1. From the dashboard, click **Profile** in the left side-rail (or bottom tabs).

**✅ What you should see:**

- URL becomes `/profile`.
- A header card at the top of the page with:
  - A 16×16 rounded blue square containing your initials in extrabold primary-blue text (e.g. `RS` for "Review Student").
  - To the right of the avatar: your full name in extrabold slate-900 (line-clamped 1 line).
  - Below the name: your email in regular slate-500.

**❓ If something looks different:**

- Initials are missing → the `fullName` split logic may have failed; the avatar should show `S` (Student default).
- Card is unusually wide on small viewports → may be a missing responsive class; minor.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### B.2 — Tab segmented control switches cleanly

**👉 Do this:**

1. Below the header card, find the 3-segment control with **Profile** / **Mastery** / **Badges**.
2. Click each segment in order: Profile (already selected) → Mastery → Badges → Profile.

**✅ What you should see:**

- The selected segment has a white background with primary-blue text + shadow.
- Inactive segments have slate-600 text on a slate-200/70 background.
- Clicking each one switches the visible content below within ~100ms (no full-page reload).
- The URL does NOT change when you switch tabs by clicking (only the `?tab=` deep-link from §B.7 sets it).

**❓ If something looks different:**

- Segment doesn't visually switch on click → my Fyne `Segmented` primitive isn't wired; reload the page.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### B.3 — D-016: identity fields are READ-ONLY

**👉 Do this:**

1. On the Profile tab, look at the white card with 5 rows: **Email**, **Phone**, **Date of birth**, **Batch**, **Course**.
2. Try to click the value text or press Tab to focus into any of them.
3. Right-click on any value.

**✅ What you should see:**

- Each row has an icon on the left (mail/phone/cake/cap), a label above the value, the value below, and a **small grey lock icon on the right side**.
- No row has an `<input>` element you can type into. (Hover over any value → no text cursor.)
- Below the list: a slate-50 info card with **"Identity details are managed by your institute admin. Contact them for any updates."**
- Two action buttons below the info card:
  - **Change password** (blue, primary)
  - **Contact admin** (outlined, opens `mailto:admin@fynestudy.example.com`)

**❓ If something looks different:**

- An identity field shows an editable `<input>` → **D-016 violation. Mark FAIL and ping me immediately.**
- Lock icon missing on any row → cosmetic; still PASS but note it.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### B.4 — Change-password dialog opens, validates inline, and rejects mismatches

**👉 Do this:**

1. On the Profile tab, click **Change password**.
2. The dialog opens. In the **New password** field, type `weak`.
3. In **Confirm new password**, type `weak`.
4. Click the **Change password** button in the dialog (lower-right).

**✅ What you should see:**

- A red error appears under the password field: **"Use at least 10 characters"**.
- The dialog stays open. No network request fires.

**👉 Then:**

5. Clear the New password field. Type `Test12345Long`.
6. In Confirm, type something DIFFERENT (e.g. `Test12345Diff`).
7. Click **Change password**.

**✅ What you should see:**

- A red error under the Confirm field: **"Passwords do not match."**

**👉 Final — DO NOT actually change the password** (you'd lock yourself out of the test account):

8. Click **Cancel** (or press Escape) to close the dialog.

**❓ If something looks different:**

- Clicking **Change password** with `weak` fires a network request (DevTools → Network) → validation is broken; ping me. Network must NOT fire until the form passes zod validation.
- Submitting with valid + matching passwords actually goes through (locks you out!) → STOP, this is a test you should avoid. Cancel out.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### B.5 — D-153: change-password uses the edge fn, NOT `supabase.auth.updateUser`

This is a security check. The change-password dialog MUST call the `auth-change-own-password` edge function — never the standard Supabase auth API.

**👉 Do this (source audit — safer than triggering a real password change):**

1. From PowerShell at the repo root:
   ```powershell
   Select-String -Path "apps/web/features/profile/*" -Pattern "auth-change-own-password"
   ```

**✅ What you should see:**

- Exactly one match in `apps/web/features/profile/useChangePassword.ts`, around line 18: `invokeEdgeFn<ChangePasswordResponse>("auth-change-own-password", { new_password: newPassword })`.

**👉 Then:**

2. From the same PowerShell:
   ```powershell
   Select-String -Path "apps/web/features/profile/*","apps/web/components/profile/*" -Pattern "supabase\.auth\.updateUser"
   ```

**✅ What you should see:**

- **Zero matches.** The string `supabase.auth.updateUser` MUST NOT appear in either `features/profile/` or `components/profile/`.

**❓ If something looks different:**

- Match in the second grep → **D-153 violation. Mark FAIL and ping me immediately.**

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### B.6 — Mastery tab renders (or shows empty state)

**👉 Do this:**

1. Click the **Mastery** tab.

**✅ What you should see (either-or):**

- A list of mastery cards, **sorted weakest first** (lowest mastery % at the top). Each card:
  - Topic name on the left (line-clamped 1 line).
  - Percentage on the right, colour-coded:
    - `<50%` → red (`#ef4444`)
    - `50–74%` → amber (`#f59e0b`)
    - `75–100%` → emerald (`#10b981`)
  - A horizontal progress bar below, filled to the same percentage, same colour.
  - A footer line in slate-400: `Avg of last N attempts · practiced <day>` (where `<day>` is "Today" / "Yesterday" / "DD Mon").
- OR (if you have no quiz/exam attempts) a friendly empty state: **"Finish a quiz or exam and your per-topic mastery shows up here."**

**❓ If something looks different:**

- All cards show the same colour → the `masteryColor()` function isn't being applied; ping me.
- Permanent spinner → the `mastery` query errored. Check DevTools → Network → look for the `mastery?...` request status.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### B.7 — Badges tab + `?tab=` deep-link works

**👉 Do this:**

1. Click the **Badges** tab.

**✅ What you should see:**

- Summary row at the top: **`N earned · M to go`** in slate-700 inside a slate-50 pill (e.g. `3 earned · 8 to go`).
- A 3-column grid (4 on tablet/desktop) of badge tiles. Each tile:
  - The badge icon at size 72, fetched from the signed URL via `badge-icon-sign`.
  - Earned badges look bright; **locked badges are at opacity 30** with a small **lock overlay** at the bottom-right corner.
  - The badge name below the icon (line-clamped 2 lines).
- Click any earned badge → a detail card appears below the grid showing the badge icon, name, and **"Earned <day>"** (where `<day>` is the IST day label).
- Click any locked badge → the detail card shows the badge name and the description (how to earn it).

**👉 Then verify the deep-link:**

2. In the address bar, type `http://localhost:3000/profile?tab=mastery` and press Enter.
3. The page loads with **Mastery** tab pre-selected.
4. Repeat for `?tab=badges` → Badges tab pre-selected.
5. Repeat for `?tab=profile` (or no `?tab=`) → Profile tab pre-selected.

**❓ If something looks different:**

- Badge icons are missing (just an Award icon outline) → the `badge-icon-sign` edge fn likely errored. Check DevTools → Network. The fallback is fine but flag the URL.
- Deep-link doesn't switch tabs → the searchParams aren't being parsed; ping me.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §C — Leaderboard

`/leaderboard` shows your batch ranking with a Weekly / All-time scope toggle (Segmented), your rank pinned at the top, and a public-card dialog when you click a peer. Crash-guarded for peers who left the batch (D-202).

---

### C.1 — Navigate to Leaderboard + confirm the header layout

**👉 Do this:**

1. Click **Ranks** in the side-rail.

**✅ What you should see:**

- URL becomes `/leaderboard`.
- A header row with:
  - A 12×12 rounded amber square containing a **trophy icon** (amber-600) on the left.
  - To the right of the trophy: **"Leaderboard"** as an H1 in slate-900 extrabold; your batch name below it in slate-500 (e.g. `Batch A`).
  - On the far right: a small 9×9 round button with an **info `i` icon** (slate-600 on slate-100 background).

**❓ If something looks different:**

- Batch name missing → the `useMyBatch` hook may have errored; check Network for the `students?...` query.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### C.2 — Scope segmented control toggles Weekly ↔ All-time

**👉 Do this:**

1. Below the header, find the 2-segment control **Weekly** / **All-time**.
2. Click **All-time**.

**✅ What you should see:**

- The list re-fetches (you may see skeleton placeholders for a moment).
- The numbers in the list may change (your weekly rank can differ from your all-time rank).
- The All-time segment is now the active one (white background, primary-blue text).

**👉 Click back to Weekly.**

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### C.3 — My-rank pinned card surfaces (or empty state)

**👉 Do this:**

1. Look just below the Segmented control for a **dark blue card** (`bg-blue-900 text-white`).

**✅ What you should see (either-or):**

- A dark blue card with:
  - Tiny uppercase label **`YOUR RANK`** in blue-200.
  - A big number `#N` on the left (e.g. `#3`) + smaller text `/ total` (e.g. `/ 18`).
  - On the right: your composite score with 2 decimals (e.g. `0.62`).
- OR (if no leaderboard data yet) a centred grey card with a trophy icon, **"No rankings yet"** in slate-700 + **"Earn points by attending classes and topping quizzes."** in slate-500. Skip §C.4 — there's nobody to click.

**❓ If something looks different:**

- Card present but rank is missing (just shows `/ total`) → the `is_me` flag isn't being set; check the RPC payload.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A (no leaderboard data) — _If FAIL, what you saw:_

---

### C.4 — Tap a peer → public-card dialog opens (D-202 crash-guard)

**👉 Do this:**

1. Click any row in the rankings list (you can also click your own row).
2. A dialog opens.

**✅ What you should see:**

- A dialog with:
  - A 12×12 rounded blue square holding the peer's first initial in extrabold primary blue.
  - To the right: the full name in extrabold slate-900; the batch name below in slate-500.
  - An amber-50 pill below containing a flame icon + **`N day streak`**.
  - A section labelled **`BADGES EARNED`** (small caps, slate-500):
    - If they have badges: a 3-column grid of badge cards (slate-50 background) with an award icon + badge name.
    - If they have no badges: a centred grey card with **"No badges yet."**.
- **D-202 crash guard:** if the RPC returns `null` (peer left your batch since the leaderboard was loaded), the dialog shows **"Card unavailable — This student may have left your batch."** with no crash.

**👉 Press Escape (or click outside the dialog) to close.**

**❓ If something looks different:**

- Dialog opens then crashes the page → **D-202 violation. Mark FAIL and ping me immediately.**
- Dialog stuck at "Loading card…" → the `student_public_card` RPC didn't return; check Network.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _If FAIL, what you saw:_

---

### C.5 — "How rank is calculated" modal explains the composite

**👉 Do this:**

1. Click the small **info `i`** button in the top-right of the Leaderboard header.

**✅ What you should see:**

- A modal opens titled **"How rank is calculated"** in blue-900 extrabold.
- A short explainer line in slate-500: **"Your composite score blends three things, each scored from 0 to 1."**
- Three weight rows, each with a coloured percentage square on the left + title + body:
  - **60%** (primary-blue) — **"Quiz & exam scores"** — "Your average score across quizzes and exams in the period."
  - **25%** (emerald) — **"Activity"** — "How many days you were active out of the days you could be."
  - **15%** (orange) — **"Streak"** — "Your current daily streak — full credit at a 30-day streak."

**👉 Press Escape to close.**

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### C.6 — Self-row is visually distinct + tap opens own card

**👉 Do this:**

1. Find your own row in the rankings (look for `You` in place of a name, OR the row outlined in blue).
2. Click your own row.

**✅ What you should see:**

- Your row has a **blue background** (`bg-blue-50`) with a **blue border** (`border-blue-200`), instead of the default white-on-slate.
- The name reads **"You"** (not your full name).
- Clicking opens the public card with YOUR name + batch + streak + badges.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §D — Attendance

`/attendance` shows a rotating QR (refreshes every ~25s, expires every 30s), today's classes with status pills, a 30-day history with two attendance rings, and listens to Supabase Realtime for live mark updates.

---

### D.1 — Heading + QR card render (or "no class window" empty state)

**👉 Do this:**

1. Click **Attendance** in the side-rail.

**✅ What you should see (either-or):**

- An H1 **"Attendance"** centred at the top with the subtitle **"Show your QR to the teacher to mark yourself present."**
- Below: a large white rounded card containing a **QR code SVG** (180×180), a small `QR FOR` label, and the class name. Below the QR: a thin line **"Refreshes in NN s"** (countdown).
- OR (if no class is in its scan window right now) a centred white card with a **calendar icon** + **"No class window open"** + sub-text **"QR will appear when a class starts."**.

**❓ If something looks different:**

- Card shows "Loading…" forever → the `attendance-qr-sign` edge fn may have errored. Check Network → the request status.
- QR is just a black square → `qrcode.react` failed to render; reload.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### D.2 — QR countdown ticks every second + token rotates every ~25s

**👉 Do this:**

1. If a QR is showing, watch the **"Refreshes in NN s"** line below the QR for ~60 seconds. Eyes glued.

**✅ What you should see:**

- The number `NN` decrements each second: `25, 24, 23, …, 1, 0`.
- When it reaches `0` (or `≤2`), the page silently calls `attendance-qr-sign` again, and the countdown resets to ~`25`.
- The displayed QR PIXEL pattern visibly changes (the `payload_b64` underneath is a fresh token).
- A second cycle should complete within 50 seconds of you starting.

**❓ If something looks different:**

- Countdown stuck → the `setInterval` died. Open DevTools → Network → confirm a new `attendance-qr-sign` POST fires every ~25 s.
- Countdown skips (e.g. `25 → 22 → 19`) → some renders dropped; reload.
- Token never rotates (QR pixels look identical) → the `refetchInterval` isn't firing; ping me.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A (no open class) — _If FAIL, what you saw:_

---

### D.3 — Today's classes list with status pills

**👉 Do this:**

1. Scroll down to the section **`TODAY'S CLASSES`** (small caps, slate-500).

**✅ What you should see (either-or):**

- A list of classes scheduled today (IST day boundaries). Each row:
  - A small clock icon on the left.
  - Subject name in bold slate-900.
  - Start → end times in slate-500 (12-hour AM/PM IST).
  - A status pill on the right with one of these labels + colours:
    - **Open** (blue) — class window is open NOW
    - **Soon** (default slate) — class is in the future, window not open yet
    - **Closed** (slate) — class window has ended
    - **Present** (emerald) — you've been marked present
    - **Late** (amber)
    - **Absent** (red)
- OR a centred grey line **"No classes scheduled today."**

**❓ If something looks different:**

- A class you KNOW is today is missing → check Network for `sessions?...` — the IST day-boundary calculation may have an issue. Ping me with the time of day you're testing.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### D.4 — Attendance history: 2 rings + 30-day recent list

**👉 Do this:**

1. Scroll down to the section **`MY HISTORY`** (small caps, slate-500).

**✅ What you should see:**

- Two blue circles side-by-side at the top of the section:
  - **This week** — a circle showing your weekly attendance % + `N / M classes` below
  - **Last 30 days** — same but for the rolling 30 days
- Below the rings: a list of past attendance records. Each row:
  - A status icon on the left (CheckCircle green for `present`, Clock amber for `late`, XCircle red for `absent`).
  - Subject name in semibold slate-900.
  - Day + time in slate-500 (e.g. **"Yesterday · 10:00 AM"** or **"23 May · 2:30 PM"**).
  - On the right: the status label colour-coded + the method (`QR` / `manual` / `bulk`) in uppercase.
- If no attendance records yet → **"No attendance records yet."** in a grey card.

**❓ If something looks different:**

- Ring shows 0% but rows below show `Present` → the aggregation is broken; ping me with a screenshot.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### D.5 — Pill selector for multiple eligible sessions

**👉 Do this:**

1. If you happen to be in a moment with MULTIPLE classes whose scan window is open right now (rare), look below the QR card for a row of **pill buttons** — one per eligible session.
2. Click between them.

**✅ What you should see:**

- The active session pill is filled blue (`bg-primary text-white`); inactive pills are white with slate border.
- Clicking a different session swaps the QR to that session's token.
- If you only have ONE open session, no pills appear — that's expected. Mark N/A.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A (only one open session) — _If FAIL, what you saw:_

---

### D.6 — Realtime: simulate a teacher scan (admin-mark) → row flips live

This needs an admin to mark you present without you reloading. Teacher scan UI ships in Phase 4, so we use the admin panel to simulate it.

**👉 Do this:**

1. Keep the `/attendance` tab open and visible in Chrome.
2. Open a NEW Chrome window/tab. Go to `https://fyne-study-app-admin.vercel.app` and sign in as the owner (you'll need your TOTP code).
3. In the admin sidebar, navigate to **Sessions** (or **Attendance** depending on the admin tab layout).
4. Find a session for today's date that's currently `Open` for you. Click it.
5. Find `review.student@fynestudy.app` in that session's roster.
6. **Mark the student present** (button or toggle).
7. Switch back to the student `/attendance` tab.

**✅ What you should see (within 2–3 seconds, no reload):**

- The status pill for that session in the **TODAY'S CLASSES** list flips from `Open` to **`Present`** (emerald).
- The **This week** ring's `N / M` increases by 1.
- The **MY HISTORY** list gains a new row at the top with today's date and `Present`.

**❓ If something looks different:**

- No realtime update → check DevTools → Network → switch to the **WS (WebSocket)** filter. There should be an active connection to `wss://*.supabase.co/realtime/v1/websocket`. If absent, the channel didn't subscribe. Reload `/attendance` and try again.
- Update arrives after you reload (not live) → the realtime channel cleaned up but didn't re-subscribe. Note it.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A (no admin access today) — _If FAIL, what you saw:_

---

### D.7 — Realtime channel cleanup on navigation (no ghost subscriptions)

**👉 Do this:**

1. While on `/attendance`, open DevTools → **Console** tab.
2. Clear the console (trash icon).
3. Click **Home** in the side-rail to leave.
4. Click **Attendance** to come back.
5. Watch the Console for any red errors mentioning `channel`, `postgres_changes`, or **"cannot add postgres_changes callbacks ... after subscribe()"**.

**✅ What you should see:**

- Zero red errors mentioning channels in the Console.
- A few yellow info logs from Supabase's WS channel are fine (they show subscribe + unsubscribe lifecycle).

**❓ If something looks different:**

- See **"cannot add postgres_changes callbacks after subscribe"** → the channel name collided. My implementation uses a random suffix (`student-attendance-{id}-{rand}`) to avoid this; ping me with the full error.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §E — Classes shell

`/classes` shows 3 segments (Live / Upcoming / Recorded) and an Exams discovery section below. **Upcoming is fully wired**; Live + Recorded are placeholders pointing to Phase 4. Exam attempts ship in Phase 3 — the discovery list shows titles + status only.

---

### E.1 — Navigate to Classes + confirm the header

**👉 Do this:**

1. Click **Classes** in the side-rail.

**✅ What you should see:**

- URL becomes `/classes`.
- Header row: a 12×12 rounded blue square with a **video icon** + **"My Classes"** H1 + subtitle **"Live, upcoming and recorded sessions plus exams."**
- Below header: a 3-segment control **Live** / **Upcoming** / **Recorded**. Each segment label may include a count badge (e.g. `Upcoming (4)`) if non-zero.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### E.2 — Live segment behaviour (placeholder until Phase 4)

**👉 Do this:**

1. Click the **Live** segment.

**✅ What you should see (either-or):**

- (If no class is live right now) An empty-state card titled **"No live class right now"** + sub-text **"When a class starts, it will appear here. Live playback ships in Phase 4."**
- (If a session has `status='live'` in the DB) A red-bordered row (`bg-red-50 border-red-200`) with the subject name + **"Live now · HH:MM AM/PM"** + a red **LIVE** pill on the right. Below the list, a grey explainer: **"Live class playback lands in Phase 4 — for now, this list shows the session as live."** No click-through.

**❓ If something looks different:**

- Live row click navigates somewhere → it shouldn't (Phase 4 builds the playback screen). Note it.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### E.3 — Upcoming segment wires real data

**👉 Do this:**

1. Click the **Upcoming** segment.

**✅ What you should see (either-or):**

- A list of upcoming sessions (next 14 days). Each row:
  - A clock icon on the left.
  - Subject name in bold slate-900.
  - Day label + time below in slate-500 (e.g. **"Tomorrow · 10:00 AM"** / **"5 Jun · 4:00 PM"**).
- OR an empty state **"No upcoming sessions — Your schedule for the next 14 days is clear."**.

**❓ If something looks different:**

- Real sessions you scheduled aren't appearing → the `useStudentSchedule` query's batch_id may be wrong. Network → check the `sessions?...` request.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### E.4 — Recorded segment behaviour (placeholder until Phase 4)

**👉 Do this:**

1. Click the **Recorded** segment.

**✅ What you should see (either-or):**

- A list of past live sessions that have a YouTube recording. Each row:
  - A muted video icon (opacity 70).
  - Subject name + **"DD Mon · recording available"** below.
  - A small grey **Phase 4** pill on the right (no click-through).
- OR the empty state **"No recordings yet — When a live class ends and the recording is ready, it'll appear here. Playback ships in Phase 4."**.

**❓ If something looks different:**

- Recorded row click navigates somewhere → it shouldn't (no Phase 4 yet).

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### E.5 — Exams discovery section + Phase-3 note

**👉 Do this:**

1. Scroll past the Live/Upcoming/Recorded list to the section labelled **`EXAMINATIONS`** (small caps, slate-500).

**✅ What you should see (either-or):**

- A list of exams the student is enrolled in. Each row:
  - A calendar icon on the left.
  - Title in bold slate-900.
  - Day · time · duration in slate-500 (e.g. **"5 Jun · 10:00 AM · 60 min"**).
  - A status pill on the right with one of: `Live now` (red) / `Scheduled` (amber) / `Results pending` (primary) / `Results out` (emerald) / `Ended` (slate).
- Below the list, a centred grey footer: **"Exam attempts (taking the exam) ship in Phase 3."**
- OR an empty state card with **"No examinations scheduled."**

**❓ If something looks different:**

- Status pills are all `Scheduled` even for ended exams → the `computeStatus` helper may be off; ping me.
- A row's title shows `is_correct` or `correct_option_id` content in the bold area → **CRITICAL SECURITY ISSUE**. Mark FAIL and ping me immediately; these fields must never reach the client.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §F — Library (Subject → Chapter → Topic → Item)

`/library` is a URL-state drill-down. The URL params (`?subject=...&chapter=...&topic=...`) are the source of truth — the **browser back button moves up the tree**, and you can share a deep link to a topic. Search debounces to `?q=`.

---

### F.1 — Subjects view + search input render

**👉 Do this:**

1. Click **Library** in the side-rail.

**✅ What you should see:**

- URL becomes `/library` (no params).
- Header: a 12×12 rounded blue square with a **book-open icon** + **"Library"** H1 + subtitle **"Subjects → Chapters → Topics → Items"**.
- Below header: a search input with a left-aligned magnifying-glass icon + placeholder **"Search content…"**.
- Below search: a 2-column grid (1 column on mobile) of subject cards. Each card:
  - A book icon on the left in a rounded blue square (size 12).
  - Subject name in bold slate-900.
  - Item count below in slate-500 (e.g. `12 items` / `1 item`).
  - A right chevron arrow on the far right.

**❓ If something looks different:**

- The grid is one giant column on a wide window → the `sm:grid-cols-2` class isn't applying; check Tailwind.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### F.2 — Drill-down updates URL + browser back unwinds

**👉 Do this:**

1. From the Subjects view, click any subject (e.g. Physics).

**✅ What you should see:**

- URL becomes `/library?subject=<uuid>` (the actual subject id).
- The header shows the subject name as the H1, with a **back arrow** (chevron-left in a 9×9 round button) replacing the book icon.
- The subtitle changes to **"Chapters"**.
- The list now shows chapters for that subject.

**👉 Then:**

2. Click any chapter.

**✅ What you should see:**

- URL becomes `/library?subject=<uuid>&chapter=<uuid>`.
- Header H1 = chapter name; subtitle = **"Topics"**.
- The list shows topics for that chapter.

**👉 Then:**

3. Click any topic that has items (non-disabled).

**✅ What you should see:**

- URL becomes `/library?subject=<uuid>&chapter=<uuid>&topic=<uuid>`.
- Header H1 = topic name; subtitle = **"Content"**.
- The list shows content items (video / pdf / note).

**👉 NOW test browser back:**

4. Press the browser's back button.

**✅ What you should see:**

- URL drops the `&topic=...` param → you're back on the Topics view.
- Press back again → drops `&chapter=...`, back on Chapters.
- Press back again → drops `&subject=...`, back on Subjects (the top level).
- Press back again → leaves `/library` to wherever you came from.

**❓ If something looks different:**

- Browser back exits the library immediately (without unwinding) → **regression on the `router.push` flow**. The whole drill-down was one history entry. Ping me; this is the bug I fixed in the last commit.
- URL updates but the visible view doesn't change → `useSearchParams` isn't being read in the client component. Reload.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### F.3 — Custom back-arrow button works (in addition to browser back)

**👉 Do this:**

1. Drill down to a topic's items view (Subject → Chapter → Topic).
2. Click the **back-arrow button** in the header (the 9×9 round button on the left).

**✅ What you should see:**

- URL drops the `&topic=` param → you're now back at the Topics view.
- Click back-arrow again → Chapters.
- Click back-arrow again → Subjects (the back-arrow is replaced by the book icon).
- The back-arrow uses the SAME `router.push` mechanism, so browser back ALSO works to unwind further.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### F.4 — Search debounces to `?q=` and filters across the tree

**👉 Do this:**

1. Back at the top-level Subjects view.
2. In the search input, type slowly: `k-i-n-e-m-a-t-i-c-s` (or any topic name from your seed).

**✅ What you should see:**

- After ~300 ms of inactivity, the URL updates to `/library?q=kinematics` (uses `router.replace`, NOT push — so search keystrokes don't pollute history).
- The subject grid filters down: subjects with no matching items disappear; the visible subjects show only the matching items in their counts.
- Drill into a remaining subject → only chapters with matching items appear.
- Drill into a chapter → only the matching topic appears.

**👉 Then:**

3. Clear the search box.

**✅ What you should see:**

- After ~300 ms, the `?q=` param is removed.
- All subjects re-appear.

**❓ If something looks different:**

- Search updates the URL on EVERY keystroke (no debounce) → check that `use-debounce` is loaded. Network tab will show many extra requests.
- URL stays empty after typing → the debounce callback didn't fire; reload.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### F.5 — Item rows show kind + duration + click-through

**👉 Do this:**

1. Drill into any topic that has items (non-disabled).
2. Look at the items list.

**✅ What you should see:**

- Each row has:
  - An icon on the left in a coloured rounded square:
    - **Video** → blue play-circle (`text-primary`)
    - **PDF** → red file-text (`text-red-500`)
    - **Note** → slate sticky-note (greyed out, no click)
  - Title in bold slate-900.
  - Below the title: kind label (capitalised: `Video` / `Pdf` / `Note`) + duration in minutes if present (e.g. `Video · 12 min`).
  - A chevron-right on the far right.

**👉 Click a Video row → URL becomes `/video/<itemId>` (the player page; tested in §G).
👉 Click a PDF row → URL becomes `/pdf/<itemId>` (the viewer page; tested in §H).
👉 Click a Note row (greyed out at opacity 70) → nothing happens; the row says `Note · coming soon`.**

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### F.6 — Practice quizzes footer surfaces (Phase-3 placeholder)

**👉 Do this:**

1. Drill into a topic that has at least one practice quiz in your seed (Physics→Mechanics→Kinematics typically).

**✅ What you should see:**

- Below the items list, an **amber-bordered card** (`bg-amber-50 border-amber-100`).
- Inside, a label **`PRACTICE QUIZZES`** in amber-700 caps + a graduation-cap icon.
- A list of quiz titles. Each row has the title on the left and a small **Phase 3** pill on the right (`text-slate-400 font-bold`).
- Clicking a quiz row does NOT navigate (the attempt screen lands in Phase 3).

**❓ If something looks different:**

- The card is missing on a topic that DOES have quizzes → the `useStudentQuizDiscovery` hook's `byTopic` map may be wrong. Check Network.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A (no quizzes in seed) — _If FAIL, what you saw:_

---

### F.7 — Deep-link to a specific topic via URL

**👉 Do this:**

1. Copy the URL of a topic items page you visited in §F.2 (something like `/library?subject=<uuid>&chapter=<uuid>&topic=<uuid>`).
2. Paste it into a NEW Chrome tab (still signed in).

**✅ What you should see:**

- The page loads directly at the items view for that topic, skipping the subjects/chapters/topics steps.
- The back arrow correctly returns to the topics view, then chapters, then subjects.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §G — Video player (`/video/[contentId]`)

`react-youtube` is dynamic-imported `ssr:false`. A CSS-animated 5-position watermark overlays the player. Progress is throttled to once per 10s. Resume vs Start-Over sheet appears when prior position > 10s.

---

### G.1 — Open a video → player loads with title + watermark overlay

**👉 Do this:**

1. From the library, drill into a topic that has at least one video item.
2. Click the video row.

**✅ What you should see:**

- URL becomes `/video/<contentId>`. Most of the chrome (side-rail, top bar) is hidden — the player takes near full-screen.
- A black background fills the view.
- A header bar at the top with a **chevron-left round button** (back) + the video title (line-clamped 1 line, slate text on black).
- The YouTube IFrame loads in the middle of the page (aspect-video, ratio 16:9).
- A small white **watermark text overlay** sits in one corner showing **`<YourFirstName> • ••<LAST4DIGITS-OF-PHONE>`** (e.g. `Review • ••0000` if no phone). The text has a black shadow for visibility on any video background.

**❓ If something looks different:**

- Error card "Could not load video" → the `yt-playback-sign` edge fn returned 409 (no YT video bound for that content row). Try a different video; flag if ALL videos fail.
- Watermark missing → the `<Watermark>` component didn't render. DevTools → Elements → search the page for `wmCycle` (the CSS animation name) and confirm the `<span>` element exists.
- Blank black page where the IFrame should be → check the **Console** for a CSP error mentioning `frame-src` or `youtube.com`; if so, the CSP in `next.config.ts` isn't picking up.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### G.2 — Watermark cycles between 5 positions every 12 s

**👉 Do this:**

1. Watch the watermark position closely for ~70 seconds (5 positions × ~12 s = 60 s + buffer).

**✅ What you should see:**

- The watermark moves between these 5 positions in order:
  1. Top-left corner
  2. Top-right corner
  3. Bottom-left corner
  4. Bottom-right corner
  5. Bottom-centre (~40% from the left)
- Then loops back to top-left.
- No React re-renders involved — it's a pure CSS keyframe animation (the `wmCycle` keyframes).

**❓ If something looks different:**

- Watermark stays in the same place → the CSS keyframes didn't load. Reload Ctrl+F5 and re-check.
- Watermark moves but smoothly (not stepped) → the animation has `steps(5, end)` so it should jump, not slide.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### G.3 — D-173: YouTube controls visible (NEVER controls=0)

**👉 Do this:**

1. Look at the YouTube IFrame on the video page.
2. Hover over the IFrame (or click once).

**✅ What you should see:**

- The standard YouTube play button is visible in the centre when paused.
- The bottom timeline + play / pause / volume / settings / full-screen controls show on hover.
- Related-video thumbnails do NOT appear (`rel=0`).
- YouTube branding "watermark" + title overlay do NOT appear (`modestbranding=1` + `iv_load_policy=3`).
- D-173 is honoured — we did NOT set `controls=0`.

**❓ If something looks different:**

- Play button missing / controls hidden → check `apps/web/components/player/WrappedYtPlayer.tsx`. The `controls` field must NOT be 0 (or absent — default is 1).

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### G.4 — Progress writes throttled to once per 10 seconds

**👉 Do this:**

1. Open DevTools → **Network** tab.
2. Filter for **Fetch/XHR**.
3. Clear the network log (⊘ icon).
4. Click the YouTube play button to start playback.
5. Watch the network log for ~25 seconds.

**✅ What you should see:**

- Approximately every 10 seconds, a **POST request to `video_progress?...`** appears (a Supabase REST upsert).
- The post body (click the request → Payload tab) contains `student_id`, `content_id`, `position_sec`, `watched_pct`, `last_watched_at`.
- The internal 2-second ticker inside `WrappedYtPlayer.tsx` fires more often, but the upsert call is throttled.

**❓ If something looks different:**

- Many upserts (more than 1 per 5 s) → the throttle isn't applied; check `apps/web/features/library/useVideoProgress.ts` line 24 (`THROTTLE_MS = 10_000`).
- Zero upserts after 25 s → the `onProgress` callback isn't being called. Reload.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### G.5 — Resume sheet on re-open + "Resume" picks up

**👉 Do this:**

1. Press the YouTube play button. Watch for at least 20 seconds (so the 10-s throttled write fires twice).
2. Click the **back arrow** in the top-left of the player page. You return to the library items list.
3. Click the same video item again.

**✅ What you should see:**

- A bottom sheet (mobile) / centred modal (desktop) appears with:
  - Title **"Resume from 0:NN?"** where NN is roughly where you left off.
  - Sub-line **"You watched part of this video before."**
  - Two buttons: **Start over** (ghost variant) and **Resume** (filled primary).
- Click **Resume**.

**✅ Then you should see:**

- The sheet closes.
- The YouTube player mounts (the IFrame appears).
- After a short load, the player seeks to your prior position.

**❓ If something looks different:**

- Sheet doesn't appear → either you didn't watch long enough (need ≥10 s + a throttled write), OR the page navigated away too fast. Try again.
- Resume picks the wrong position → check `progress.initial?.position_sec` in DevTools → React Query Devtools.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### G.6 — Start-Over actually starts from 0 (regression check)

**👉 Do this:**

1. Same flow as G.5 — leave the player at 20+ seconds, navigate back, re-enter.
2. The sheet appears.
3. Click **Start over** (the ghost button on the left).

**✅ What you should see:**

- The sheet closes.
- The player mounts and starts from **0:00** (not from your prior position).
- (This was a bug in the first Phase 2 cut where Start Over still seeked. It's now fixed — see commit replacing `resumeApplied: boolean` with `resumeChoice: "pending" | "resume" | "restart"`.)

**❓ If something looks different:**

- Player still seeks to the prior position when you click Start over → the bug is back. Mark FAIL and ping me — this is the exact regression we just fixed.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §H — PDF viewer (`/pdf/[contentId]`)

`react-pdf` is dynamic-imported `ssr:false`. The `pdfjs` worker is bundled locally via `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`. A 3×4 tiled diagonal watermark sits `position:fixed inset:0` over the canvas. Page tracking uses IntersectionObserver; writes throttle to 5s.

---

### H.1 — Open a PDF → header + page indicator + canvas render

**👉 Do this:**

1. From the library, drill into a topic that has at least one PDF item.
2. Click the PDF row.

**✅ What you should see:**

- URL becomes `/pdf/<contentId>`. Player chrome takes near full-screen, side-rail hidden.
- Dark slate background.
- A header bar at the top: a **chevron-left round button** (back) on the left + the PDF title (line-clamped).
- A sticky sub-header below: **`Page 1 / N`** in semibold slate-200 on a slate-900 background. The N updates once the document loads.
- Below: the first page of the PDF renders as a centred canvas with a subtle shadow, max width 900px.
- DevTools → Network → confirm a `content-pdf-sign` edge fn POST returns a JSON body with a `signed_url`. The PDF body itself is loaded from `*.supabase.co/storage/v1/object/sign/...?token=...` — note the `?token=` query param (signed URL, not public).

**❓ If something looks different:**

- Error card "Could not load PDF" → the `content-pdf-sign` edge fn errored. Network tab → check the response status.
- Blank dark page (no canvas) → the pdf.js worker failed to load. Check **Console** for a worker error. If you see `Failed to fetch worker` → the worker URL via `new URL(...)` didn't resolve; ping me.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### H.2 — Diagonal tiled watermark overlays the canvas

**👉 Do this:**

1. Look at the PDF rendering area.
2. Inspect the watermark.

**✅ What you should see:**

- A grid of **`<YourFirstName> • ••<LAST4DIGITS>`** watermarks tiled diagonally at **-30°** rotation, semi-transparent (~35% opacity), white text with a dark text-shadow.
- 3 columns × 4 rows = 12 watermark tiles spread across the viewport.
- The watermark layer is `position: fixed inset: 0` — it stays in place as you scroll the PDF underneath.

**❓ If something looks different:**

- Watermark moves with the scroll (not fixed) → CSS positioning is wrong; check `apps/web/components/player/PdfWatermark.tsx`.
- Watermark is solid (not transparent) → the opacity rule didn't apply.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### H.3 — Page indicator tracks the most-visible page as you scroll

**👉 Do this:**

1. Scroll down through the PDF (mouse wheel or trackpad).

**✅ What you should see:**

- The **`Page X / N`** header updates as you scroll.
- The X corresponds to whichever page has crossed the 50% viewport visibility threshold (an IntersectionObserver tracks each `<Page>` and reports when ≥50% is visible).
- Scrolling up reverses the count.

**❓ If something looks different:**

- Page counter stuck on 1 even when you scroll past it → the IntersectionObserver isn't attached. Check the **Console** for errors.
- Page counter flickers between values rapidly → the threshold of 0.5 may be too tight; cosmetic only, still PASS.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### H.4 — Page progress writes throttled to once per 5 seconds

**👉 Do this:**

1. Open DevTools → **Network** → filter for `XHR`.
2. Clear the log.
3. Scroll through several pages SLOWLY (give each page 6+ seconds of view time).

**✅ What you should see:**

- A POST to `pdf_progress?...` (Supabase REST upsert) fires when you settle on a new page.
- The throttle limits writes to once per 5 seconds for the SAME page; if you stay on page 3 for 30 s, only ONE upsert fires.
- Payload contains `student_id`, `content_id`, `last_page`, `total_pages`, `updated_at`.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### H.5 — Page resume on re-open

**👉 Do this:**

1. Scroll to a specific page (e.g. page 5). Wait 6+ seconds so the 5-s throttle has written.
2. Click the back-arrow → return to the library.
3. Re-open the same PDF.

**✅ What you should see:**

- The viewer loads at (or close to) page 5 — not page 1.
- Some browsers may briefly render starting at page 1 then jump — also PASS as long as it settles near where you left off.

**❓ If something looks different:**

- Always starts at page 1 → the `pdf_progress` upsert may not be firing (Network tab check). Or the `usePdfProgress.initial.last_page` is null.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### H.6 — Native browser pinch-zoom + Ctrl-scroll work

**👉 Do this:**

1. On Chrome desktop: hold `Ctrl` (or `Cmd` on Mac) and scroll up with the mouse-wheel. (On a Mac trackpad: pinch out.)

**✅ What you should see:**

- The page canvas zooms in (the browser's native zoom — NOT a custom pinch implementation).
- The watermark grid stays the same size (it's fixed overlay, not part of the canvas).
- D-174 is N/A on web — the browser handles pinch-zoom natively, unlike mobile's WebView.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §I — Settings menu + sign-out

`/menu` is a list of placeholder rows (most show an alert), with a sign-out row at the bottom that actually works.

---

### I.1 — Settings page renders 3 groups + sign-out

**👉 Do this:**

1. Click **Menu** (gear icon) in the side-rail.

**✅ What you should see:**

- H1 **"Settings"** at the top.
- 3 grouped sections, each with a small caps label and a white rounded card containing list rows:
  - **GENERAL** — Account information, Notifications, Language (`English`), Display theme (`System`).
  - **SECURITY** — Privacy settings, Connected devices.
  - **ABOUT** — Help & support, Terms & policies.
- Below the groups: a separate white card with a red **Sign out** row.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### I.2 — Future-update alert fires on placeholder rows

**👉 Do this:**

1. Click **Notifications**.

**✅ What you should see:**

- A browser `alert()` dialog appears with the text **"This setting will be available in a future update."**.
- Click **OK** to dismiss.

**👉 Repeat for:** Language, Display theme, Privacy settings, Connected devices, Help & support.

**👉 Verify the working rows:**

2. Click **Account information** → URL navigates to `/profile`.
3. Browser-back to `/menu`.
4. Click **Terms & policies** → URL navigates to `/privacy`.
5. Browser-back to `/menu`.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### I.3 — Sign out works and routes to `/login`

**👉 Do this:**

1. Click the red **Sign out** row at the bottom of `/menu`.

**✅ What you should see:**

- The label briefly changes to **"Signing out…"**.
- URL becomes `/login`. The sign-in form is visible.
- The session cookie is cleared (DevTools → Application → Cookies → no `sb-orqwyazvcthgxoadfxfv-auth-token` rows).

**❓ If something looks different:**

- URL stays on `/menu` → the `signOut()` call errored or the page redirect didn't happen. Check Console.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### I.4 — Browser back-button after sign-out cannot re-enter

**👉 Do this:**

1. Right after I.3 (you're on `/login`), press the browser's back button.

**✅ What you should see:**

- URL bounces back to `/login` (or briefly tries `/menu` then bounces).
- The Settings page does NOT render — the middleware re-checks the auth cookie, sees none, and re-redirects.

**👉 Then sign in again as the student to continue:**

2. Email: `review.student@fynestudy.app`, password: `ReviewStudent#2026`, click Sign in.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §J — Responsive + carry-overs

The web app supports widths from 320 px (small iPhone SE) to 1440+ px (desktop). Below 1024 px, the side-rail collapses to bottom tabs + a top bar.

---

### J.1 — Desktop layout (≥ 1024 px width)

**👉 Do this:**

1. With Chrome at a normal desktop window size (>1024 px wide), navigate to `/`.

**✅ What you should see:**

- A vertical **side-rail** 256 px wide on the LEFT with the FyneStudy logo + 7 nav items + your profile menu at the bottom.
- **No bottom tab bar.**
- **No top bar with a logo + avatar.**
- The dashboard content uses 2 columns at `lg:` (NextCard + StatsStrip + TodaySchedule on the left, WeakTopics + RecentBadges on the right).

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### J.2 — Mobile-web layout (< 1024 px width)

**👉 Do this:**

1. Open DevTools (F12).
2. Click the **device-emulation icon** (top-left of DevTools, looks like a tablet + phone outline). Or press `Ctrl+Shift+M`.
3. In the device dropdown at the top of the viewport, pick **"iPhone 14 Pro"** (or set width manually to **390** + height **844**).

**✅ What you should see:**

- The side-rail is gone.
- A **TopBar** at the top with the FyneStudy logo on the left + a compact avatar on the right.
- A **BottomTabs** bar fixed at the bottom of the viewport: 7 student tabs (Home, Classes, Library, Attendance, Ranks, Profile, Menu) with icons + tiny labels.
- The currently-selected tab is highlighted in the primary blue.
- Dashboard content collapses to 1 column.

**👉 Click each bottom tab in order** → each navigates correctly. ✅

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### J.3 — Layout resizes cleanly between 320 → 1440 px

**👉 Do this:**

1. Still in DevTools device-emulation mode, drag the right-edge handle of the viewport (or change the width number directly) through these widths in order: 320, 500, 768, 1023, 1024, 1280, 1440.

**✅ What you should see:**

- **No horizontal scrollbar** appears at any width.
- The breakpoint between mobile-web layout (TopBar + BottomTabs) and desktop layout (SideRail) is crisp at 1024 px (Tailwind's `lg:` breakpoint). At 1023 you see mobile-web; at 1024 you see desktop.
- Dashboard content adapts: 1 column below `lg`, 2 columns at `lg+`.

**👉 Then close device-emulation** (`Ctrl+Shift+M` again).

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### J.4 — iOS Safari + Android Chrome PWA install (carry-over)

`http://localhost:3000` is plain HTTP, not HTTPS — iOS Safari and Android Chrome won't show the "Add to home screen" / "Install app" prompts. Defer until after the Vercel deploy.

`Result:` [ ] N/A — carry-over (needs HTTPS / Vercel deploy)

---

# §K — Security checks

These are defence-in-depth verifications. Phase 2 doesn't render quiz / exam attempts (Phase 3), but the discovery surfaces (classes shell, library) still must NOT leak any solution data.

---

### K.1 — No `is_correct` / `answer_key` / `service_role` in any client-bound response

**👉 Do this:**

1. Open DevTools → **Network** tab.
2. Filter for **Fetch/XHR**.
3. Clear the network log (⊘ icon).
4. Navigate `/` → `/classes` → `/library` in sequence (use the side-rail).
5. For EACH of those navigations, look at every response in the Network panel.
6. For each response, click it → **Response** tab → press `Ctrl+F` and search for each of: `is_correct`, `correct_option_id`, `answer_key`, `solution_text`, `solution_image_url`, `service_role`.

**✅ What you should see:**

- ZERO matches across all responses. The Find dialog says "No results".

**❓ If ANY of those strings appear:**

- **Mark FAIL and ping me immediately.** This is a hard-rule violation (CLAUDE.md: "Never send `is_correct` to the client").

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what string appeared in which URL:_

---

### K.2 — Service-role key is NOT in the production JS bundle

**👉 Do this:**

1. In PowerShell from the repo root:
   ```powershell
   pnpm --filter @fynestudy/web build
   ```
2. Wait for the build to finish (~30 s). It outputs a route table at the end.
3. Search the production bundle for the banned strings:
   ```powershell
   Get-ChildItem apps/web/.next/static -Recurse -Include *.js |
       Select-String -Pattern "SUPABASE_SERVICE_ROLE|service_role" -List
   ```

**✅ What you should see:**

- ZERO matches. (Empty output, command exits silently.)
- This confirms the anon-key-only rule: no service-role-key ever in any file the browser downloads.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, paste the output below:_

---

### K.3 — Storage URLs are all signed (PDF + badge icons)

**👉 Do this:**

1. Open DevTools → **Network** tab → filter for `Img` and `Doc`.
2. Navigate `/profile?tab=badges` → look at the badge icon image requests.

**✅ What you should see:**

- Every badge icon request goes to `https://*.supabase.co/storage/v1/object/sign/badge-assets/...?token=<signed>` — note the `?token=...` query param.
- There are NO unsigned bucket reads to `/storage/v1/object/public/...`.

**👉 Then navigate to a PDF page (`/pdf/<id>`):**

3. Look at the PDF body request.

**✅ What you should see:**

- The PDF document URL also contains `?token=<signed>` — signed via `content-pdf-sign`.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### K.4 — Realtime channel grep (1 subscribe = 1 cleanup)

**👉 Do this:**

1. In PowerShell from the repo root:
   ```powershell
   Select-String -Path "apps/web/features/**/*.ts","apps/web/components/**/*.tsx" -Pattern "supabase\.channel\("
   ```
2. Then:
   ```powershell
   Select-String -Path "apps/web/features/**/*.ts","apps/web/components/**/*.tsx" -Pattern "removeChannel\("
   ```

**✅ What you should see:**

- BOTH greps return **exactly one match each** — both in `apps/web/features/attendance/useAttendanceRealtime.ts`.
- The matching lines are roughly:
  - `const channel = supabase.channel(...)` (one place)
  - `supabase.removeChannel(channel)` (cleanup, same file)
- Phase 2 has exactly one realtime hook (attendance). Phase 3+4 will add more — the rule is: every `channel(` must have a corresponding `removeChannel(` in the same hook's cleanup.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, paste the counts:_

---

### K.5 — No `supabase.auth.updateUser` outside `app/reset/`

**👉 Do this:**

1. In PowerShell from the repo root:
   ```powershell
   Select-String -Path "apps/web/features/**/*.ts","apps/web/components/**/*.tsx","apps/web/app/(protected)/**/*.tsx" -Pattern "supabase\.auth\.updateUser"
   ```

**✅ What you should see:**

- **Zero matches.** Outside the Phase 1 recovery-link reset flow (`app/reset/reset-form.tsx`), no client-side code may call `supabase.auth.updateUser` (D-153). All password rotations route through `auth-change-own-password`.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what file:_

---

# §L — Automated test gates

Run all five commands in PowerShell from the repo root. Each MUST exit with code 0.

### L.1 — Typecheck

```powershell
pnpm --filter @fynestudy/web typecheck
```

**✅ Expected:** the command completes with no error output and returns to the prompt with exit code 0. The intermediate output is just `> tsc --noEmit`.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, error excerpt:_

---

### L.2 — Lint

```powershell
pnpm --filter @fynestudy/web lint
```

**✅ Expected:** `> @fynestudy/web@0.0.0 lint > eslint` followed by no output (no errors, no warnings) and exit code 0.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, error excerpt:_

---

### L.3 — Vitest unit tests

```powershell
pnpm --filter @fynestudy/web test
```

**✅ Expected (last 2 lines):**

```
 Test Files  8 passed (8)
      Tests  41 passed (41)
```

Test files: `role-helpers`, `edge-fn`, `ist`, `watermark`, `masteryColor`, `computeStatus`, `scanWindow`, `useLibraryTree`.

**❓ If you see lower counts:**

- `Test Files 2 passed` → you're running on a pre-Phase-2 commit. Re-check `git status`.
- Test fails with a real assertion → paste the failing test name below.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, counts:_

---

### L.4 — Next.js production build

```powershell
pnpm --filter @fynestudy/web build
```

**✅ Expected:**

- A route table with at least these dynamic (ƒ) routes: `/`, `/attendance`, `/classes`, `/leaderboard`, `/library`, `/menu`, `/pdf/[contentId]`, `/profile`, `/video/[contentId]`.
- A static (○) row for `/privacy`, `/terms`, `/_styleguide`, `/manifest.webmanifest`.
- A `(serwist) Bundling the service worker script with the URL '/sw.js'` line that succeeds.
- **No `Attempted import error: ...` warnings** (we explicitly fixed the `pdf.worker.min.mjs?url` warning in the second build).

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, error excerpt:_

---

### L.5 — Playwright E2E (Chrome only, requires dev server running)

```powershell
# In a separate PowerShell, leave the dev server running first:
pnpm --filter @fynestudy/web dev

# Then in the SECOND PowerShell, from the repo root:
cd C:\Users\kaust\OneDrive\Desktop\FyneStudyLive\apps\web
pnpm exec playwright test --project=chromium-desktop --reporter=list
```

If you've never run Playwright before, install the browsers first:
```powershell
pnpm exec playwright install --with-deps chromium
```

**✅ Expected:**

- New Phase 2 specs run: `dashboard.spec.ts`, `profile.spec.ts`, `leaderboard.spec.ts`, `attendance.spec.ts`, `library.spec.ts`, `security.spec.ts` — plus the updated `auth.spec.ts`.
- All implemented tests pass. Multi-role + suspended cases auto-skip (you'll see `N skipped`).
- **0 failed.**

**❓ If something looks different:**

- `webServer timed out starting` → the dev server (port 3000) isn't running. Start it in the FIRST PowerShell window before running tests.
- `Cannot find playwright browsers` → run the `playwright install` line above.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, counts:_

---

# §M — Acceptance sign-off

Tick each section once all its rows are PASS or N/A with reason.

- [ ] **§0** Setup (0.1–0.6)
- [ ] **§A** Dashboard (A.1–A.8)
- [ ] **§B** Profile + Mastery + Badges (B.1–B.7)
- [ ] **§C** Leaderboard (C.1–C.6)
- [ ] **§D** Attendance (D.1–D.7)
- [ ] **§E** Classes shell (E.1–E.5)
- [ ] **§F** Library (F.1–F.7)
- [ ] **§G** Video player (G.1–G.6)
- [ ] **§H** PDF viewer (H.1–H.6)
- [ ] **§I** Settings menu + sign-out (I.1–I.4)
- [ ] **§J** Responsive (J.1–J.3, J.4 = N/A)
- [ ] **§K** Security checks (K.1–K.5)
- [ ] **§L** Automated gates (L.1–L.5)

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
- Webcam QR scanner for teachers (Phase 4)
- Sentry + PostHog wiring (deferred at user direction)

**Tester name:** ________________

**Date:** ________________

**Notes:**

```
(optional — anything you want to flag for the next phase)
```

Once these boxes are ticked, paste the result back to me. I will then:

1. Append the manual-QA sign-off line to `Phases/phase-2-student-learning-surfaces.md §J`.
2. Update `CLAUDE.md`'s "Web App Conversion track" with `Phase 2 ✅ — signed off <today's date>` + a one-line summary.
3. Update `project_web-phase-2-status.md` in the project memory to mark manual QA done.
4. Commit the sign-off update on `web-phase-1`.
5. **Stop.** Phase 3 starts in a fresh new conversation.

---

# Troubleshooting cheat-sheet

| Symptom | Likely cause | Fix |
|---|---|---|
| `pnpm dev` errors `ENOENT pdfjs-dist` | New Phase 2 deps not installed | `pnpm install` from repo root, then re-run `pnpm --filter @fynestudy/web dev` |
| `/video/<id>` shows "Could not load video" | `yt-playback-sign` returned 409 (no YT video bound for that content row) | Try a different video. If all videos fail, check `apps/functions/yt-playback-sign/index.ts` logs in Supabase dashboard |
| `/pdf/<id>` shows a blank dark page (no canvas) | `pdfjs-dist` worker URL didn't resolve | DevTools → Console → look for a worker error. Rebuild: `pnpm --filter @fynestudy/web build`. The build must NOT show `Attempted import error: pdf.worker.min.mjs?url` |
| Watermark missing or static | CSS animation didn't load | Reload the page (Ctrl+F5). Reproduce in DevTools → Elements → search the page for `wmCycle` |
| QR countdown stuck at NN | `attendance-qr-sign` request failing | DevTools → Network → check the POST response. Likely cause: no class window is open (status 400) or rate-limited (status 429) |
| Realtime channel error in Console | A channel was reused with the same name | Phase 2 uses a random suffix (`student-attendance-{id}-{rand}`); if you see this, ping me with the exact error text |
| `pnpm test` errors `Cannot find module '@/lib/ist'` | Vitest path alias broken | Check `vitest.config.ts` has `alias: { "@": "." }`. Re-run after `pnpm install` |
| Browser back exits the library instead of unwinding | LibraryClient regression (was on `router.replace`) | Check `apps/web/app/(protected)/library/_components/LibraryClient.tsx` — `setNav` MUST call `router.push`, not `replace` |
| Video player resumes when you clicked "Start over" | `VideoClient` resume state regression | Check `apps/web/app/video/[contentId]/_components/VideoClient.tsx` — `resumeChoice` must be `"restart"` (not `"resume"`) when you click Start over |
| `BadgeEarnedModal` confetti only fires on the first badge | The modal key isn't re-mounting per badge | The `<DialogContent key={badge.earning_id}>` line in `BadgeEarnedModal.tsx` is required — confirm it's there |

---

_Phase 2 manual test plan — last updated 2026-05-28. Mirrors the format of `phase-1-manual-tests.md`. Sign off in §M when every box is ticked or marked N/A._
