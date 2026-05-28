# Phase 4 — Manual Test Plan (`apps/web` — Live Classes + Teacher Portal)

> **Audience:** the human running the manual tests. **Zero coding background required** — every step has the exact buttons to click, the exact URL to type, and what you should see on screen.
>
> **What you're testing:** the Phase 4 surfaces of `apps/web` — the **student** Live class screen (lobby → wrapped YouTube + realtime chat + raise-hand + pinned + end-of-class) at `/live/[sessionId]`, the **student** Recording screen (player + speed buttons + time-synced chat replay) at `/recording/[sessionId]`, and (in Track 4B) the **teacher** portal (home, scan webcam QR, classes, library upload, quiz/exam builders, results, offline scores, batch analytics, roster, live-control). Walk through every section in order. **Chrome on a laptop/desktop is required.** iOS Safari + Android Chrome rows tagged **carry-over** need HTTPS — do them after the Vercel deploy session (intentional, not a blocker).
>
> **How to record results:** every test ends with `[ ] PASS / [ ] FAIL / [ ] N/A`. Tick one box. If FAIL, write what you saw in the space below it and ping me — I'll diagnose. If N/A, write the reason.
>
> **Estimated time:** ~3 hours on Chrome desktop for the full Track 4A + 4B sweep, plus ~30 minutes for the §G OBS real-stream dry-run on a second device.
>
> **🟢 Phase 4 is code-complete (Track 4A + 4B both built).** Every section §0–§P below is LIVE. iOS Safari + Android Chrome rows in §N.3 + §N.4 remain `N/A — Phase 5` (need HTTPS).

---

## 🔑 Test accounts — quick reference (verified live 2026-05-28)

Same accounts as Phase 1/2/3.

| Use in section | Email | Password |
|---|---|---|
| **§A + §B all student tests** | `review.student@fynestudy.app` | `ReviewStudent#2026` |
| **§A.4 + Track 4B teacher portal** | `review.teacher@fynestudy.app` | `ReviewTeacher#2026` |
| **Track 4B owner-only admin checks** | `owner@fynestudy.example.com` | `FyneOwner#2026` |
| Extra student (Aarav) | `test.aarav@fynestudy.app` | `TestPass#2026` |
| Extra student (Diya) | `test.diya@fynestudy.app` | `TestPass#2026` |

**Skipped sections (mark N/A unless instructed otherwise):**
- iOS Safari + Android Chrome carry-overs (§N.3, §N.4) — needs the Vercel deploy.
- Multi-role student/teacher account switch — account never created in Phase 1.

> Source of truth for credentials: `CREDENTIALS.local.md` at the repo root (git-ignored, do not paste publicly).

---

## Table of contents

- **§0 Setup** — branch, env, dependencies, seed, dev server, DevTools (7 sub-tasks)
- **§A Student live class** — lobby countdown → player → chat → raise-hand → pinned → end-of-class (10 tests) ✅ Track 4A
- **§B Student recording** — playback → speed buttons → chat replay sync (7 tests) ✅ Track 4A
- **§C Teacher home dashboard** — quick actions + Pending list (4 tests) ✅ Track 4B
- **§D Teacher scan (webcam QR)** — start-on-gesture + decode + dedup + fallback (7 tests) ✅ Track 4B
- **§E Teacher classes** — Today/Upcoming/Past + Schedule-Live + Ad-hoc FABs (4 tests) ✅ Track 4B
- **§F Teacher content upload** — curriculum picker + Video URL + PDF presign+PUT+finalize (3 tests) ✅ Track 4B
- **§G Teacher live control + REAL OBS DRY-RUN** — Setup → OBS → Go Live → moderate → end (7 tests) ✅ Track 4B
- **§H Teacher quiz builder** — list + builder + bank + publish (4 tests) ✅ Track 4B
- **§I Teacher exam builder + results + regrade** — atomic replace + release + 3-mode regrade (4 tests) ✅ Track 4B
- **§J Teacher offline scores** — pre-fill + validation + save → student profile (3 tests) ✅ Track 4B
- **§K Teacher batch analytics** — Risk / Mastery / Attendance tabs (4 tests) ✅ Track 4B
- **§L Roster corrections** — pill marks + D-164 toggle + CorrectionDialog + bulk + realtime (5 tests) ✅ Track 4B
- **§M Security + cleanup** — realtime cleanup grep, no service-role-key, no `is_correct` leak (Phase-3 invariant guard) (4 tests) ✅ Track 4A
- **§N Responsive + carry-overs** — desktop ↔ mobile-web at 320 → 1440 px (4 tests, 2 carry-over) ✅ Track 4A
- **§O Automated test gates** — typecheck / lint / vitest / build / Playwright (5 commands) ✅ Track 4A
- **§P Acceptance sign-off** — tick boxes + tester name + date

---

# §0 — Setup (do this once, before any test below)

Allow ~10 minutes the first time, ~3 minutes after.

### 0.1 — Confirm the repo + branch + working directory

**👉 Do this:**

1. Open **PowerShell** on Windows: `Win+R`, type `powershell`, press Enter.
2. Navigate to the repo:
   ```powershell
   cd C:\Users\kaust\OneDrive\Desktop\FyneStudyLive
   ```
3. Check the branch:
   ```powershell
   git status
   ```

**✅ What you should see:**

- First line says: `On branch web-phase-1`. (Shared by all five web-conversion phases.)
- Then:
   ```powershell
   git log --oneline -4
   ```
   The top commit should be `feat(web-phase-4): live classes + recordings` (Track 4A commit), followed by the two Phase 3 commits and `feat(web-phase-2): student learning surfaces`.
- `git status` will also list **unstaged** modifications under `apps/mobile/`, `docs/phases/`, `apps/functions/`, `README.md`, `.gitignore`, `pnpm-lock.yaml` (some), `scripts/seed-exam-manual-test.ts`, and the `store-assets/` untracked folder. These are pre-existing edits from prior phases — leave them alone.

**❓ If something looks different:**

- `On branch main` → run `git checkout web-phase-1`.
- Top commit is NOT `feat(web-phase-4)` → the Track 4A commit was skipped. Re-read the assistant's last message; ping me before continuing.
- `fatal: not a git repository` → wrong folder. Re-run `cd`.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### 0.2 — Confirm `apps/web/.env.local` still has the right keys

Phase 4 Track 4A didn't add any new env vars.

**👉 Do this:**

1. In PowerShell:
   ```powershell
   notepad apps/web/.env.local
   ```

**✅ What you should see (3 lines, in any order):**

```
NEXT_PUBLIC_SUPABASE_URL=https://orqwyazvcthgxoadfxfv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ZfvA-ky5eOQ3c-e9yCiLnQ_c06ZYmz9
NEXT_PUBLIC_ADMIN_URL=https://fyne-study-app-admin.vercel.app
```

There MUST NOT be a `SUPABASE_SERVICE_ROLE_KEY` line. If there is, **delete it now** and save.

**❓ If something looks different:**

- "Cannot find the path …" → file missing. Create it (Notepad → File → Save As → set **Save as type: All Files**).
- `SUPABASE_SERVICE_ROLE_KEY=...` present → delete that line and save. Critical.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### 0.3 — Refresh dependencies (no new deps in Track 4A)

Track 4A reuses existing deps (`react-youtube`, `@supabase/ssr`, `@tanstack/react-query`). Re-running `pnpm install` is still a good idea to make sure your `node_modules/` is in sync with the lockfile.

**👉 Do this:**

1. From the repo root:
   ```powershell
   pnpm install
   ```
2. Wait ~20 seconds.

**✅ What you should see:**

- Output ends with `Done in …`.
- No `+N -M` for `apps/web` (no new packages this track).
- Yellow `WARN` lines about peer deps are harmless.

**❓ If something looks different:**

- `ELIFECYCLE` → run from the repo root, not `apps/web/`. If still failing, delete `node_modules` and `pnpm-lock.yaml` and re-run.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### 0.4 — Refresh the live-class fixtures

Track 4A needs at least one **live** session, one **upcoming** session, and one **recording** (ended session with a `yt_video_id`). The mobile seed script does this end-to-end.

**👉 Do this:**

1. From the repo root:
   ```powershell
   pnpm seed:live-manual-test --reset
   ```
2. Wait ~10 seconds.

**✅ What you should see:**

```
> ts-node scripts/seed-live-manual-test.ts --reset
✓ Reset done
✓ Seed complete
   Live session id:      <uuid>  status=live, yt_video_id=jfKfPfyJRdk, started 5 min ago
   Upcoming session id:  <uuid>  scheduled +20 min
   Recording session id: <uuid>  status=ended, yt_video_id=jfKfPfyJRdk, ended 30 min ago
```

**Write the IDs down** — useful for direct URL navigation in §A.6 and §B.2.

**❓ If something looks different:**

- "Cannot connect to Supabase" → DNS / network. Re-run.
- "Missing service-role key" → the seed script needs the SERVICE_ROLE key. Check that `apps/mobile/.env.local` or `apps/functions/.env.local` has `SUPABASE_SERVICE_ROLE_KEY=...`.
- Seed succeeds but `(student) /classes` shows no live session in §A.1 → check the printed `batch_id` matches the seed student's batch (Batch A).

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### 0.5 — Start the dev server (leave it running for the whole session)

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

**Do NOT close this terminal.** Stop with `Ctrl+C` twice → `Y` when done.

**❓ If something looks different:**

- "Port 3000 already in use" → kill stale node: `taskkill /F /IM node.exe`, retry.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### 0.6 — Open Chrome DevTools

**👉 Do this:**

1. Open **Google Chrome**.
2. Go to `http://localhost:3000` → you'll be redirected to `/login`.
3. Press **F12**.

**✅ What you should see:** the DevTools panel with `Elements`, `Console`, `Network`, `Application`, … tabs.

`Result:` [ ] PASS — DevTools opens.

---

### 0.7 — Log in as the seed student

**👉 Do this:**

1. At `http://localhost:3000/login`.
2. Enter:
   - **Email:** `review.student@fynestudy.app`
   - **Password:** `ReviewStudent#2026`
3. Click **Sign in**.

**✅ What you should see:**

- URL changes to `http://localhost:3000/`.
- An H1 heading: `Good morning, …` / `Good afternoon, …` / `Good evening, …` / `Hi, …` with the student's first name.
- Side-rail with FyneStudy logo + 7 student nav items (Home highlighted blue, then Classes, Library, Attendance, Ranks, Profile, Menu).
- Console: no red errors.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §A — Student live class

The live screen lives at `/live/[sessionId]` (**outside** the `(protected)` group → no side-rail or bottom-tabs). 3 sub-states render in sequence based on the session row: **loading lobby** (briefly) → **lobby countdown / waiting** (status = `scheduled`) → **live** (status = `live` + `yt-playback-sign` returned a video_id) → **ended** (status = `ended` or a `kind='system'` chat message arrived).

---

### A.1 — Find the live session in Classes → Live segment

**👉 Do this:**

1. From the dashboard, click **Classes** in the side-rail.
2. The page opens at `/classes` showing **My Classes** with a segmented control: **Live (1)**, **Upcoming**, **Recorded**.
3. The **Live** segment should be pre-selected (it's the default when there's a live class). If not, click **Live (1)**.

**✅ What you should see:**

- A red-tinted card with the subject name (e.g. "Mathematics" or "Physics"), the text "Live now · 10:32 AM" (the seeded session's start time in IST), a red `LIVE` pill, and a `>` chevron.
- The whole card is a link (cursor pointer on hover).
- DevTools Console: no red errors.

**❓ If something looks different:**

- No live card visible → re-run `pnpm seed:live-manual-test --reset` and check the printed live session matches Batch A.
- Live segment shows "No live class right now" but the seed printed a live session id → check the session's `batch_id`; if it's not the student's batch (Batch A), the RLS filter excludes it.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.2 — Click the live card → land on `/live/[sessionId]`

**👉 Do this:**

1. Click the red live card.

**✅ What you should see:**

- URL changes to `http://localhost:3000/live/<uuid>` (the seeded live session's id).
- **No side-rail and no bottom-tabs render** — the layout is full-width "focus mode" (matches the mobile decision D-169 / web W-23). The top header is just a back-arrow + the subject title + a red **LIVE** pill.
- The page then renders ONE of:
  - The wrapped YouTube player taking the left two-thirds, with a chat pane on the right (desktop ≥ lg / ~1024px), OR
  - The wrapped player as a 16:9 hero block stacked above a chat pane (mobile / narrow window).
- Inside the player there's an absolutely-positioned watermark text overlay near the top-left or center reading something like `Review • ••2026` (your first name + last 4 of phone — or "0000" if phone isn't set).
- The watermark moves to 5 different corner/center positions over 60 seconds (a slow CSS animation — you can watch a position change every ~12 seconds).
- The chat pane shows either the "No messages yet. Say hello!" empty state, or any pre-seeded chat messages.
- A **Raise hand** button (blue) appears just above the chat composer.
- The chat composer (text input + send button) at the bottom of the chat pane is **enabled** (input is editable).
- DevTools Console: no red errors.
- DevTools Network: you should see a successful POST to `…/functions/v1/yt-playback-sign` returning `200` with a JSON body containing `video_id`. (NEVER `controls=0` in the YouTube iframe URL — per D-173 we keep YouTube's native play button visible as the autoplay gesture proxy.)

**❓ If something looks different:**

- The page shows the dark "Loading…" lobby and never advances → check Network for `yt-playback-sign` errors. A `409` means "not yet live / not ready" and the page will retry every 5s — wait up to a minute. Any other status code is unexpected; expand the response body in DevTools.
- "This class has ended" renders → the session row's `status` is `ended` or the chat received a `kind='system'` message. Re-run the seed script.
- Chat composer is **disabled** with the message "Chat opens when the class goes live" → `yt-playback-sign` hasn't returned a video_id yet. Wait a few seconds; the auto-retry will catch up.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.3 — Post a chat message

**👉 Do this:**

1. Click the chat composer text input.
2. Type `Hello from Phase 4 manual test`.
3. Press **Enter** (or click the round blue send button on the right).

**✅ What you should see:**

- The composer clears.
- Within ~1 second, your message appears at the bottom of the chat pane:
  - A blue circle with your initials (e.g. `RS` for Review Student) on the left.
  - Your full name in **bold dark text** + `(you)` next to it.
  - Time in HH:MM IST format on the right (e.g. `10:34 PM`).
  - The body `Hello from Phase 4 manual test` below the name.
- The chat scrolls to keep your message in view.
- DevTools Network: an **INSERT** call to `chat_messages` (look for a `POST` to `…/rest/v1/chat_messages` returning `201`). The Realtime CDC then echoes the row back over the websocket, which is how it appears in the pane.
- Console: no red errors.

**❓ If something looks different:**

- An inline red error appears: "new row violates row-level security policy" → the student is not in the session's batch. Re-seed.
- Error: "Couldn't send" with no detail → check the dev-server terminal for a Realtime / Postgres error. Most likely a missing trigger; ping me.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.4 — Rate-limit kicks in at the 6th message in 30 seconds

The DB has a SECURITY DEFINER trigger that enforces a 5-messages-per-30-seconds-per-user rate limit on `chat_messages` inserts.

**👉 Do this:**

1. Still in the live chat. Send 5 quick messages: `1`, `2`, `3`, `4`, `5` — each followed by Enter. (Keep your hand on Enter; the composer clears between each.)
2. Immediately type `6` and press Enter — within a few seconds of the others.

**✅ What you should see:**

- Messages 1–5 appear in the pane within ~1s each.
- Message 6 does NOT appear. Instead, an inline **red** error text appears just above the composer, similar to: `Too many messages — please wait a few seconds before sending another.` (or the literal Postgres error message — both forms are acceptable; the key is that the message does NOT make it into the pane).
- DevTools Network: a POST to `…/rest/v1/chat_messages` returning **4xx** (commonly 403 or 429) with a JSON body containing the rate-limit error.
- Console: no red unhandled rejections (the error is caught + surfaced inline).
- Wait ~30 seconds, try `6` again — it now goes through.

**❓ If something looks different:**

- Message 6 went through immediately → either the trigger was bypassed (you may have logged in as an admin) or the rate-limit window has changed. Verify in `supabase/migrations/*chat*` or ping me.
- A modal / page-level error appears → the error wasn't caught locally. Inspect the `chat-composer` element for an inline alert vs. a global toast.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.5 — Raise hand → lower hand

**👉 Do this:**

1. Find the **Raise hand** button (blue, just above the chat composer). Click it.
2. Observe the change.
3. Click it again.

**✅ What you should see:**

- After the first click the button flips to **amber** and reads **Lower hand**. To the right, the text `Hand raised ✋` (amber, semibold) appears.
- DevTools Network: an INSERT to `raise_hand_events` (POST → 201).
- After the second click the button goes back to **blue / Raise hand** and the `Hand raised ✋` indicator disappears.
- DevTools Network: an UPDATE to `raise_hand_events` (PATCH → 204) setting `resolved_at`.

**❓ If something looks different:**

- Button stays disabled / clicks do nothing → the live session isn't fully ready (the button disables until both `status='live'` and the playback sign succeeded). Wait, retry.
- The "Hand raised ✋" indicator doesn't appear → the realtime channel `hands-{id}` may not be subscribed. DevTools → Application → WS frames should show a subscription confirmation. Reload the page.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.6 — Direct URL navigation works (deep-link)

This protects against a regression where the page only renders correctly when you arrived via the Classes link.

**👉 Do this:**

1. Copy the URL from §A.2 (`http://localhost:3000/live/<uuid>`).
2. Open a **new tab** (Ctrl+T).
3. Paste the URL → Enter.

**✅ What you should see:**

- The page renders identically to §A.2 (no side-rail, player, chat).
- You are still logged in (the cookie session carries over).
- The chat pane shows the previous messages (history is fetched on mount).
- Refresh the page (F5) — same result, no flash of "Loading…" because the lobby loading state is short-lived.

**❓ If something looks different:**

- New tab redirects to `/login` → the session cookie isn't being read on the new tab. This is a Supabase SSR / middleware bug; ping me.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.7 — Realtime: another student's message lands without refresh

This is the test that proves the realtime subscription is live.

**👉 Do this:**

1. Open a **second Chrome window** (not just a tab) — File → New Window. (Two separate windows so each window has its own session cookie scope.)
2. In the second window, go to `http://localhost:3000/login` and sign in as **Aarav** (`test.aarav@fynestudy.app` / `TestPass#2026`).
3. Navigate to the same live session in the second window (Classes → Live → click the live card).
4. In the second window's chat composer, send: `Hi from Aarav`.

**✅ What you should see:**

- In the **first** window (Review Student), Aarav's message appears in the chat pane within ~1 second — no page refresh needed.
- The message has the same format as your own messages (blue circle with `AS` initials, full name, time, body) but **without** the `(you)` suffix (since it's not your own message).

**❓ If something looks different:**

- The message doesn't appear → check DevTools → Network → WS in the first window. There should be a frame containing `chat-{session-id}` with `"event":"INSERT","table":"chat_messages"`. If absent, the channel subscription failed.
- Aarav's window can't see the live class card → his batch may not match the seeded session's batch. Re-seed.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.8 — Reconnect-reload: turn the network off and on

This guards against the Phase-9 fix carried over: on realtime reconnect, history is reloaded so no messages are missed.

**👉 Do this:**

1. In the first window (Review Student), open DevTools → **Network** tab → in the throttling dropdown choose **Offline**.
2. Wait ~5 seconds.
3. In the second window (Aarav, ONLINE), send 2 messages: `offline test 1` and `offline test 2`. They appear immediately in Aarav's window.
4. Switch the first window back to **No throttling** (Online).

**✅ What you should see:**

- In the first window, within ~10 seconds of going back online, BOTH `offline test 1` AND `offline test 2` appear in the chat pane in correct chronological order.
- This is the reconnect-reload: when the websocket re-subscribes, the `useChatChannel` hook re-fetches history once because Realtime does NOT replay missed INSERTs.

**❓ If something looks different:**

- Only the last message appears (or none) → the reconnect-reload pathway is broken. Verify the `subscribedBefore` ref behavior in `apps/web/features/chat/useChatChannel.ts`.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A.9 — Pinned announcement renders specially (carry-over from Track 4B)

Pinned announcements arrive as `chat_messages` rows with `kind='announcement'`. The student client renders the latest as a sticky `PinnedBanner` above the chat pane.

**👉 Do this:**

This test depends on a teacher pin action which lands in Track 4B (live-control). For Track 4A you can simulate it with a direct SQL insert (advanced) OR mark this `N/A` and revisit after Track 4B is merged.

**If you want to simulate now (skip otherwise):**

1. In a third terminal, open the Supabase Studio (the cloud one): https://supabase.com/dashboard/project/orqwyazvcthgxoadfxfv/sql/new
2. Run:
   ```sql
   INSERT INTO public.chat_messages (session_id, author_id, body, kind)
   VALUES (
     '<your live session uuid>',
     (SELECT id FROM public.app_users WHERE email = 'review.teacher@fynestudy.app' LIMIT 1),
     'Class starting in 2 minutes — please mute your mics',
     'announcement'
   );
   ```
3. Switch back to the first Chrome window.

**✅ What you should see:**

- A blue-tinted banner with a pin icon, the text "PINNED BY <teacher name>" (uppercase, tracked), and the announcement body, appears directly above the chat pane within ~1 second.

**❓ If something looks different:**

- The pinned banner doesn't appear → the chat hook isn't picking up `kind='announcement'`. Inspect `chat.messages.filter(m => m.kind === 'announcement')` in DevTools → React tab.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — pending Track 4B teacher-side pin action

---

### A.10 — End-of-class signal flips the screen

When a teacher ends the class (Track 4B live-control), an `END_CLASS` signal is broadcast as a `chat_messages` row with `kind='system'`. The student client detects this and pivots to the "This class has ended" view.

**👉 Do this:**

Same as A.9 — depends on Track 4B teacher action. To simulate now:

1. In Supabase Studio SQL editor, run:
   ```sql
   INSERT INTO public.chat_messages (session_id, author_id, body, kind)
   VALUES (
     '<your live session uuid>',
     (SELECT id FROM public.app_users WHERE email = 'review.teacher@fynestudy.app' LIMIT 1),
     'END',
     'system'
   );
   ```
2. Switch back to the first Chrome window.

**✅ What you should see:**

- Within ~2 seconds the player + chat are replaced by a centered "This class has ended" panel.
- If the session has a `yt_video_id`, a **Watch recording** button appears (blue, large) — clicking routes to `/recording/<id>`.
- The session-row poll also re-fires, eventually flipping `status` to `ended` server-side.

**❓ If something looks different:**

- The page doesn't pivot → the `endedSignal` memo isn't reading `kind='system'`. Inspect `LiveClient.tsx`.
- The Watch recording button doesn't appear → the `yt_video_id` column is empty. Re-seed (the recording session has it; the live session may or may not depending on the seed).

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — pending Track 4B teacher-side end-class action

---

# §B — Student recording

The recording screen lives at `/recording/[sessionId]` (also outside `(protected)`). It shows the wrapped YouTube player with native YouTube controls + custom Speed (1× / 1.5× / 2×) buttons + a chat replay column that reveals messages timed by `offset = posted_at - started_at`.

---

### B.1 — Find the recording in Classes → Recorded segment

**👉 Do this:**

1. Click **Classes** in the side-rail.
2. Click the **Recorded** segment.

**✅ What you should see:**

- The Recorded segment shows at least one card (the seeded recording session) with the subject name, the day (e.g. "Today" / "Yesterday" / date), the text "recording available", and a neutral grey `Recording` pill.
- The card is clickable (hover state visible).

**❓ If something looks different:**

- "No recordings yet" → re-run the seed. Verify the seeded session has `status='ended'` AND `yt_video_id IS NOT NULL` AND `is_live_class=true`.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### B.2 — Click a recording card → land on `/recording/[sessionId]`

**👉 Do this:**

1. Click the recording card.

**✅ What you should see:**

- URL changes to `http://localhost:3000/recording/<uuid>`.
- The wrapped YouTube player loads on the left (desktop) / top (mobile). YouTube's **native** play controls (play button, scrubber, volume, settings gear, fullscreen, native YouTube playback-speed in the gear menu) are all visible.
- A watermark text overlay sits absolutely positioned over the player — same animation as live.
- On the right (desktop) / below (mobile), a column titled "CHAT REPLAY" with either the empty-state hint or some replayed messages.
- Below the player, a thin grey bar with: `Speed` label + three pill buttons `1×` (selected, blue), `1.5×`, `2×`.
- The video starts paused (D-173 — autoplay disabled). You have to press play.

**❓ If something looks different:**

- The page shows "This recording is still being processed by YouTube. Check back shortly." → the `yt-playback-sign` returned `409`. Wait a few minutes, or use a different seeded recording.
- A red error message + "Go back" link → the session id isn't valid or RLS blocks it. Re-seed.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### B.3 — Play the video

**👉 Do this:**

1. Click YouTube's native play button (center of the player).
2. Watch for ~15 seconds.

**✅ What you should see:**

- Audio + video play.
- The position scrubber moves.
- If the recording's `started_at` is far enough in the past AND there are chat messages whose `offset = posted_at - started_at` is ≤ current player time, those messages reveal one-by-one in the **CHAT REPLAY** column. Each appears with the same MessageBubble UI as live chat (avatar + name + role badge + time + body).
- The replay column auto-scrolls to the latest revealed message.
- Watermark cycles position over time.
- DevTools Console: no red errors.

**❓ If something looks different:**

- Player plays but the replay column stays empty → either no messages exist in `chat_messages` for this session, OR `started_at` is `NULL` (the page falls back to `scheduled_start`). Confirm via SQL: `SELECT id, started_at, scheduled_start FROM sessions WHERE id = '<uuid>';`.
- The player doesn't load → the YouTube iframe failed to embed. Check the iframe `src` in the Elements tab; it should be `https://www.youtube.com/embed/<video_id>?…` with NO `controls=0`. If `controls=0` is present, we regressed D-173 — ping me.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### B.4 — Speed buttons (1× / 1.5× / 2×)

**👉 Do this:**

1. With the video playing, click the **1.5×** pill below the player.
2. Listen / watch for ~5 seconds.
3. Click **2×**.
4. Watch for ~5 seconds.
5. Click **1×** to return to normal.

**✅ What you should see:**

- After 1.5×: the audio pitches faster (~1.5×); the position scrubber moves visibly faster; the active pill is now **blue** while 1× and 2× are grey.
- After 2×: even faster playback; 2× is blue.
- After 1×: normal speed; 1× is blue.
- **Replay reveals more quickly at higher speeds** — the `ChatReplay` math keys off the player's *actual* current time, so a 2× speed reveals messages in half the wall-clock time. Watch the replay column tick faster.
- DevTools Console: no warnings about `setPlaybackRate`.

**❓ If something looks different:**

- Clicking a pill doesn't change the speed → the `playbackRate` prop isn't propagating to the wrapped player. Inspect `WrappedYtPlayer.tsx` — the `useEffect` that calls `playerRef.current?.setPlaybackRate(playbackRate)` should fire.
- The replay reveals at the same rate at 2× as at 1× → the position tick (`onPosition` callback) isn't firing at the higher rate. Confirm `onPosition` is being passed into `<WrappedYtPlayer …>` and that the 1s `posTickRef` interval is alive (no clearInterval after play).

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### B.5 — Scrubbing also reveals replay

**👉 Do this:**

1. Use the YouTube native scrubber to drag the playhead to ~60% of the way through.

**✅ What you should see:**

- The position jumps.
- The **ChatReplay** column updates: it filters to messages whose offset ≤ the new position, and shows them all (even ones that were "behind" the old position).
- The replay auto-scrolls to the latest revealed message.

**❓ If something looks different:**

- The replay doesn't update on a scrub → the player isn't reporting position to `onPosition` after a seek. Check DevTools → React: the recording client's `posSec` state should change after the seek.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### B.6 — Direct URL deep-link works

**👉 Do this:**

1. Copy the recording URL (`http://localhost:3000/recording/<uuid>`).
2. Open a new tab → paste → Enter.

**✅ What you should see:**

- Same page as B.2, no broken state.
- Refresh works.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### B.7 — Back navigation returns to /classes (not /)

**👉 Do this:**

1. From the recording page, click the back-arrow (top-left).

**✅ What you should see:**

- You land at `/classes` with the side-rail back, on the **Recorded** segment (browser-back honors history, but the back-arrow href is `/classes` always — predictable).

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §C — Teacher home dashboard

> Sign in with `review.teacher@fynestudy.app` (`ReviewTeacher#2026`) before §C. Stay signed in for §D–§L.

### C.1 — Teacher branch renders on `/`

**👉 Do this:**

1. Sign in (form at `http://localhost:3000/login`).
2. After redirect to `/`, look at the top of the main column.

**✅ What you should see:**

- Page header reads `Good morning, <FirstName>` (or evening/afternoon based on IST).
- A row of three "Quick actions" tiles labelled **Scan QR**, **New exam**, **Upload** on the right side (or below the main column on a narrow window).
- On the left, either a blue "Next" card (subject + batch + start time) or — if no future class today — only the "Pending" section.
- The Pending section either says "You're all caught up — nothing pending." OR shows one row per exam awaiting release + one row "Review N raised hand(s)" if hands are queued.
- The "My batches" section in the right column lists every batch with a course code + name + student count + next-session label.

**❓ If something looks different:**

- "Phase 4 placeholder" copy appears → the teacher dashboard didn't replace the empty state in `app/(protected)/page.tsx`. Re-confirm `web-phase-1` is checked out + the build is fresh.
- "Loading…" never resolves on Pending → the `teacher_dashboard` RPC threw. Open DevTools → Console; copy the supabase error.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### C.2 — "Take attendance" CTA opens `/scan`

**👉 Do this:**

1. From the Next card click **Take Attendance**.

**✅ What you should see:**

- URL changes to `/scan`.
- The page header reads "Scan".
- Side rail / bottom-tabs still visible (we're inside `(protected)`).

**❓ If something looks different:**

- Stays on `/` → the `<Link>` href is wrong. Check `app/(protected)/_components/TeacherDashboard.tsx`.
- 403 redirect to `/` → middleware blocked the teacher; re-check `active_role` cookie.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### C.3 — Pending list deep-links to `/exam-results/[id]`

**👉 Do this:**

1. Back on `/`. If any "Release results: X" rows show, click the first.

**✅ What you should see:**

- URL becomes `/exam-results/<uuid>`.
- The page renders with the exam title at top + a release banner.

**❓ If something looks different:**

- Page 404s → the exam id in `pending.exams_awaiting_release` is stale. Refresh `/` and retry.
- Empty page → `useExamResultsBoard` errored. Check Console.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### C.4 — Window-focus refresh

**👉 Do this:**

1. Open `/` in one tab. Open the Supabase dashboard in another tab.
2. In Supabase Studio insert a `raise_hand_events` row for one of the teacher's sessions (you can also just open a student tab and tap Raise hand).
3. Click back to the `/` tab.

**✅ What you should see:**

- Within ~1 second the Pending card updates to show the new raised hand count.

**❓ If something looks different:**

- Pending stale → the focus listener in `useTeacherDashboard` didn't fire. Check Console for errors; reload.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

# §D — Teacher scan (webcam QR)

### D.1 — Camera is OFF on mount (iOS Safari gesture safety)

**👉 Do this:**

1. Navigate to `/scan`.
2. Observe the camera viewport (the 3:4 black box).

**✅ What you should see:**

- A dark box with a camera icon + **Start camera** button + helper text.
- The browser has NOT yet shown a camera permission prompt.
- DevTools → Elements: no `<video>` tag inside the camera frame.

**❓ If something looks different:**

- Permission prompt appears immediately → the WebcamScanner mounted on first render. Check `active` gating in `components/teacher/WebcamScanner.tsx`.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### D.2 — Start camera prompts for permission, then renders the live feed

**👉 Do this:**

1. Click **Start camera**.
2. When the browser asks "Allow camera?", click **Allow**.

**✅ What you should see:**

- Within ~1 second the dark box swaps to your live webcam feed.
- The corner-bracket viewfinder overlay shows around the centre.
- The hint reads "Point at the student's QR" if a class is auto-picked, or "Pick a class first" otherwise.
- Top-right "Reset camera" and "Stop" buttons appear.

**❓ If something looks different:**

- "Camera blocked" amber card appears instead → permission was denied. Click the address-bar camera icon → Allow → reload.
- Feed shows but mirrored → the scanner mounted the front camera. We requested `facingMode: 'environment'`; on a laptop this falls back to the only built-in cam, which is fine. Move on.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### D.3 — Session picker lists today + upcoming, NOT past

**👉 Do this:**

1. Click the picker bar above the camera (the row that says "Scanning for · …").

**✅ What you should see:**

- A drop-down lists every session in your assigned batches that is `today` or `upcoming` — never `past`.
- Each row shows subject · time · "Today" or "Upcoming" tag.

**❓ If something looks different:**

- "No upcoming or live classes in your batches" → you have no future sessions. Run `pnpm seed:live-manual-test --reset` to materialise one.
- Past sessions show → `useTeacherSessions` filter changed. Check `bucket !== 'past'`.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### D.4 — Decode + success toast (real two-device test)

**👉 Do this:**

1. On a second device (phone) sign in as `review.student@fynestudy.app` and open `/attendance`. The rotating QR appears.
2. Hold the phone in front of the laptop's webcam (or use Chrome DevTools → "Sensors" → upload an image with the QR).

**✅ What you should see:**

- Within ~1 second a green toast appears at the top of the camera frame: `✔ <student name>` + "Marked present".
- The viewfinder briefly tints green, then back to neutral.

**❓ If something looks different:**

- Red toast "QR expired" → the QR is older than the verify window. Refresh `/attendance` on the phone; rotate-token is every 30 s.
- Red toast "Wrong class" → the QR belongs to a different batch. Switch the picker to the right class.
- No toast at all → the decode didn't fire. Open Console; if you see `BarcodeDetector` errors, try a different browser (Chrome desktop fully supports it).

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### D.5 — 500ms debounce + same-token dedup (no double-marks)

**👉 Do this:**

1. While the QR is in view, watch the network tab in DevTools.

**✅ What you should see:**

- Multiple decode frames per second, but only ONE `POST /functions/v1/attendance-qr-verify` per QR token AND per ~500ms window.
- Subsequent identical tokens are silently dropped until the QR rotates (every 30s).

**❓ If something looks different:**

- Rapid duplicate POSTs → the `lastCallAt`/`lastPayload` refs aren't working. Inspect `features/teacher/useScanVerify.ts`.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### D.6 — Permission-denied fallback to manual roster

**👉 Do this:**

1. Click "Stop", then in the address bar click the camera icon → Block → reload.
2. Click **Start camera**.

**✅ What you should see:**

- The amber "Camera permission was blocked" card appears below the camera.
- A "Open roster instead" link routes to `/roster/<active session>`.

**❓ If something looks different:**

- No fallback card → the `onError` mapping in `ScanClient` didn't see the `NotAllowedError`. Open Console for the raw error message; you may need to add a substring to the recogniser.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### D.7 — Reset camera button re-mounts the scanner

**👉 Do this:**

1. Re-allow camera → start.
2. Click **Reset camera**.

**✅ What you should see:**

- The feed momentarily flickers to the loading state, then re-mounts. `resetKey` increments which forces React to drop + re-create the lazy Scanner.

**❓ If something looks different:**

- Nothing happens → the `key={"scanner-" + resetKey}` isn't wired. Inspect `WebcamScanner.tsx`.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

# §E — Teacher classes

### E.1 — Today / Upcoming / Past segmented + per-row actions

**👉 Do this:**

1. Open `/classes`.

**✅ What you should see:**

- Three segmented tabs `Today · Upcoming · Past` with counts.
- Each row in the current bucket shows subject, batch + course code, schedule, status pill (Live / Scheduled / Ended / Cancelled).
- Live-class rows have a **Go live / Live control** button (red); other rows have **Scan** (blue). Both have a **Roster** chip.

**❓ If something looks different:**

- "Coming in Phase 4" placeholder still shows → the page didn't switch on `active_role === 'teacher'`. Re-check `app/(protected)/classes/page.tsx`.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### E.2 — Schedule live FAB → SessionCreateSheet → routes to live-control

**👉 Do this:**

1. Click the floating red **Radio** FAB (bottom-right).
2. Pick a batch (defaults to your first assigned), keep 60 min, click **Set up live class**.

**✅ What you should see:**

- A new session is created server-side via `session-create-ad-hoc` with `is_live_class: true`.
- The page redirects to `/live-control/<new session id>`.

**❓ If something looks different:**

- Sheet doesn't close → the mutation errored. Check the inline red text; if "403" you're not assigned to that batch (pick another).
- Routes to `/roster/...` instead → the `onCreated` wiring went to the wrong place. Inspect `TeacherClasses.tsx`.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### E.3 — Ad-hoc FAB → SessionCreateSheet → routes to roster

**👉 Do this:**

1. Back on `/classes`, click the blue **Plus** FAB.
2. Confirm a non-live session.

**✅ What you should see:**

- New session created with `is_live_class: false`. Route is `/roster/<id>`.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### E.4 — Roster + Scan chips on rows

**👉 Do this:**

1. Pick any row → click **Roster**.

**✅ What you should see:**

- URL is `/roster/<session id>` (FocusLayout — no side-rail). Back button works.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

# §F — Teacher content upload

### F.1 — Cascading topic picker

**👉 Do this:**

1. Open `/content`.
2. Click each select in order: (Course if >1) → Subject → Chapter → Topic.

**✅ What you should see:**

- Each picker is `disabled` until the prior one is chosen.
- After picking a Topic, the Batch selector below becomes enabled.

**❓ If something looks different:**

- Pickers don't enable → `useTeacherCurriculum` didn't load. Check the Console + the `useAssignedBatches` query.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### F.2 — Video URL flow

**👉 Do this:**

1. Pick Kind = **Video**.
2. Pick Topic + Batch.
3. Paste any unlisted YouTube URL in the YouTube field (e.g. `https://youtu.be/dQw4w9WgXcQ`).
4. Title: "Test video upload".
5. Click **Upload**.

**✅ What you should see:**

- Within ~3 seconds a green pill appears: "Video linked successfully." or "Linked. (YT verification is currently disabled — admin will review.)"
- Form resets (Title clears, URL clears).
- Student `/library` now lists this title under the same Topic.

**❓ If something looks different:**

- Red pill with 503 / "YouTube isn't configured" → the Vault keys aren't loaded. This is expected on a fresh project; check `apps/functions/_shared/yt-api.ts`.
- Red pill with 403 → the teacher isn't assigned to that batch.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### F.3 — PDF presign → PUT → finalize with progress bar

**👉 Do this:**

1. Pick Kind = **PDF**.
2. Click "Pick a PDF" and select any PDF ≤ 5 MB.
3. Click **Upload**.

**✅ What you should see:**

- The file label updates to your PDF's name + size in MB.
- A blue progress bar appears under the picker, animating 0 → 100% while the bytes upload to the signed URL.
- A green pill appears: "Uploaded — content added to library."
- Student `/library` now lists this PDF.

**❓ If something looks different:**

- 413 → the file is too big (>50 MB). Pick a smaller one.
- 403 on presign → batch RLS rejected. Pick a different batch.
- Progress bar never moves → XHR isn't firing onprogress; check Console.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

# §G — Teacher live control + REAL OBS DRY-RUN

> ⚠ This is the most important section. The mobile manual plan ran a real OBS dry-run on the dev's "NOvA FX" YouTube channel; replicate that here.

### G.1 — Setup phase renders RTMP + key

**👉 Do this:**

1. From `/classes` schedule a new live session (or open an existing scheduled one) → land on `/live-control/<id>`.

**✅ What you should see:**

- A "Preparing broadcast…" spinner for ~2 seconds.
- The page then shows: a card with **Server (RTMP URL)** + **Stream key** + Copy buttons + a "Copy Server + Key" combined button + a red **Go Live** button at the bottom.
- The stream key is masked (looks like a long alphanumeric); copying it to your clipboard works (try pasting in Notepad).

**❓ If something looks different:**

- Inline red error card "YouTube isn't configured yet" / 503 → Vault secrets missing. Add `YT_CLIENT_ID/SECRET/REFRESH_TOKEN` to Supabase Vault. The Retry button keeps your form state.
- Error other than 503 → tap **Retry**; it re-fires `yt-broadcast-create` (state is preserved).

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### G.2 — Copy buttons hit `navigator.clipboard.writeText`

**👉 Do this:**

1. Click **Copy** next to the server URL. Then **Copy** next to the stream key.

**✅ What you should see:**

- Each button briefly swaps to a green ✓ "Copied" label for ~1.6s, then back.
- Paste both into a Notepad / text editor; verify they look like an RTMP URL (`rtmp://a.rtmp.youtube.com/live2`) and a UUID-style key.

**❓ If something looks different:**

- Nothing copied → the browser blocked clipboard on an insecure context. localhost is fine; on http://lan-ip it's blocked. Use https://localhost or the Vercel deploy.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### G.3 — OBS handoff (real-streaming dry-run)

**👉 Do this:**

1. Open **OBS Studio** on a second computer (or same machine if the camera is free).
2. Settings → Stream → Service: **Custom…**
3. **Server**: paste the RTMP URL from the Copy button.
4. **Stream Key**: paste the stream key.
5. Apply, close.
6. Click **Start Streaming** in OBS.
7. Wait ~10 seconds. Then in the web app click **Go Live**.

**✅ What you should see (web app):**

- A loading spinner on Go Live; ~3 seconds later the page swaps to the LIVE view: a player preview at the top, two tabs (Stream · Moderate).
- The header reads "● Live now" with a viewer count chip.

**✅ What you should see (a second tab signed in as the student):**

- `/classes` shows the session under the **Live** segment with a red LIVE pill.
- Clicking it opens `/live/<id>` and the YouTube player begins streaming OBS's feed within ~5 seconds.

**❓ If something looks different:**

- Go Live errors with 503 → broadcast not bound to a stream; OBS hasn't connected yet. Wait + retry.
- Student sees "Loading…" forever → `yt-playback-sign` returns 409. Check the live broadcast's status in YouTube Studio.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### G.4 — Moderate tab: delete + ban

**👉 Do this:**

1. From the student tab, post 2-3 chat messages.
2. In the teacher live-control tab, switch to the **Moderate** tab.
3. Hover one of the student's messages → click the ⋯ kebab → **Delete message**.
4. Hover another → kebab → **Mute … for this class**.

**✅ What you should see:**

- Deleted message immediately strikes through + reads "(message deleted)" in both tabs.
- The student tab disables the chat composer + raise-hand button live (`useSessionState` channel pushes the ban).
- Back in moderation, the muted user's row shows "· muted".

**❓ If something looks different:**

- Kebab not visible → the moderation menu only renders on hover for non-own messages; tap the message first.
- Composer stays enabled on student tab → the `ban-{sessionId}-{userId}` channel didn't fire. Reload the student tab.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### G.5 — Pin announcement

**👉 Do this:**

1. Moderate tab → tap **Pin an announcement**.
2. Type "Quiz at 8 PM" → Pin.

**✅ What you should see:**

- The Stream tab shows a blue **Pinned by …** banner with your message.
- Student tabs show the same banner above the chat.

**❓ If something looks different:**

- No banner → the `chat-{id}` channel didn't replay. Reload.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### G.6 — Raise-hand queue + Resolve

**👉 Do this:**

1. From the student tab tap **Raise hand**.
2. Switch to teacher Moderate tab.

**✅ What you should see:**

- The raise-hand queue lists the student in slot 1.
- Tap **Resolve** — the row vanishes.
- The student's "Raise hand" button toggles back to its default state within ~1 second.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### G.7 — End class

**👉 Do this:**

1. Tap **End class** (top-right red button).
2. Confirm in the dialog "End class for everyone?".

**✅ What you should see:**

- yt-broadcast-stop fires → `sessions.status='ended'` → a `kind='system'` chat row is inserted.
- The teacher returns to `/classes`.
- The student tab pivots from the live player to "This class has ended" → tap to view recording (recording will become available after YouTube finishes processing — usually 5-15 minutes).

**❓ If something looks different:**

- Dialog doesn't appear → ConfirmDialog mounted but not opened; inspect `confirmEnd` state.
- Student stays on the live screen → the system message didn't arrive; the chat channel may have dropped. Reload the student tab.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

# §H — Teacher quiz builder

### H.1 — List + "New quiz" routes to FocusLayout builder

**👉 Do this:**

1. Open `/quizzes`. If empty, click **New quiz**.

**✅ What you should see:**

- URL becomes `/quiz-builder/new`.
- FocusLayout (no side-rail) — only a back arrow + title.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### H.2 — Scope picker + topic gating

**👉 Do this:**

1. Pick Subject → Chapter → Topic. Leave Batch as "Course-wide (no batch)".

**✅ What you should see:**

- Each select enables only after its parent is picked.
- The save buttons become enabled once Title + Topic + Duration are valid.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### H.3 — Add from bank, reorder, remove

**👉 Do this:**

1. Click **From bank** → tick 2-3 questions → **Add**.
2. Use the up/down arrows to reorder.
3. Click the trash to remove one.

**✅ What you should see:**

- Each interaction updates the list immediately. The arrows are disabled at the top/bottom edges.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### H.4 — Save draft + publish

**👉 Do this:**

1. Type a title.
2. Click **Save draft**. Confirm green toast.
3. Re-open the saved quiz from `/quizzes`.
4. Click **Publish**.

**✅ What you should see:**

- After Save draft: redirect to `/quizzes`; new row shows with status "Draft".
- After Publish: status flips to "Published"; student `/library` / dashboard surfaces the quiz.

**❓ If something looks different:**

- Save errors with `quizzes_teacher_insert` policy → confirm `created_by` matches the teacher's `app_users.id`.
- Atomic question replace: if the publish hangs mid-way, the old questions stay (no empty published quiz).

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

# §I — Teacher exam builder + results + regrade

### I.1 — `/exam-builder/new` FocusLayout

**👉 Do this:**

1. Open `/exams` → **New exam**.

**✅ What you should see:**

- FocusLayout. Title input + Batch select + datetime-local picker + duration select + release radios (Manual / Instant) + Marking grid + Questions empty state.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### I.2 — Atomic question replace (Phase-7 carry-over)

**👉 Do this:**

1. Add 3 bank questions, set duration 30 min, batch, future start.
2. Publish.
3. Re-open the exam and remove 1 question + add 1 different one + reorder; Publish again.

**✅ What you should see:**

- The first publish writes `exam_questions` rows.
- The second publish UPSERTs the kept rows (updates sort_order), THEN deletes the removed one. Never empty mid-save.
- Verify in Supabase Studio: `SELECT * FROM exam_questions WHERE exam_id = '<id>' ORDER BY sort_order;` — exactly the questions you saved.

**❓ If something looks different:**

- Empty `exam_questions` rows mid-save → the upsert-then-delete order was reversed. Check `builder-question-replace.ts` is honoured.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### I.3 — Results board release

**👉 Do this:**

1. From `/exams` open a published manual-release exam with ≥1 submitted attempt.
2. Open `/exam-results/<id>` (via the "Results · Locked" link).
3. Click **Release results to students**.
4. Confirm in the dialog.

**✅ What you should see:**

- The release banner flips green + shows the IST timestamp.
- A student tab on the same exam — refresh /exam/<id> — now shows the score + per-question breakdown (D-181 re-open routing).

**❓ If something looks different:**

- 403 on release → the teacher doesn't own the exam AND isn't admin. Confirm `exams.created_by` or use the owner account.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### I.4 — Regrade: change correct + mark all correct

**👉 Do this:**

1. In the question analysis section click **Regrade** on Q1.
2. Mode = "Change correct option" → pick a different option → write a reason ≥ 3 chars → Apply regrade.
3. Re-open Regrade on Q2 → "Mark all correct" → reason → Apply.

**✅ What you should see:**

- Each regrade pops a confirmation "N attempt(s) recomputed." Pct on the analysis bar updates after the page refetches.
- `audit_log` shows two rows with `entity='exam_question'` (one per regrade).

**❓ If something looks different:**

- The pct doesn't update → `useExamResultsBoard.refetch()` wasn't called. Reload the page.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

# §J — Teacher offline scores

### J.1 — Pick batch + test → roster loads with existing scores pre-filled

**👉 Do this:**

1. Open `/offline-scores`. Pick a batch. Type "Weekly Test 12". Today's date pre-fills.

**✅ What you should see:**

- Roster loads under the form.
- If any saved scores already exist for that test name/date/batch, the inputs pre-fill silently (no warning).

**❓ If something looks different:**

- Inputs always blank → `useOfflineScores.existing` was empty (no prior scores) — that's normal for a brand-new test name.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### J.2 — Validation: empty + out-of-range + non-numeric

**👉 Do this:**

1. Type `abc` in one cell → **Save all**.
2. Clear → type `150` (with max=100) → Save.
3. Clear → leave all empty → Save.

**✅ What you should see:**

- "isn't a number" pill for `abc`.
- "outside [0, 100]" pill for `150`.
- "Enter at least one student's score before saving." pill for all-empty.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### J.3 — Save → student profile reflects the score

**👉 Do this:**

1. Fill 2-3 cells with valid scores → **Save all**.
2. Green pill: "N new, M updated."
3. Switch to a student tab → `/profile`.

**✅ What you should see:**

- A new offline-test row in their profile activity (Phase-2 surface).

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

# §K — Teacher batch analytics

### K.1 — `/batch` lists assigned batches → tap → `/batch/[id]` analytics

**👉 Do this:**

1. Open `/batch`.
2. Tap a row.

**✅ What you should see:**

- URL becomes `/batch/<id>`.
- Three tabs: Risk · Mastery · Attendance.
- Side rail / bottom-tabs stay visible (decision: analytics inside `(protected)`).

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### K.2 — Risk tab — At-risk list (composite < 0.4)

**👉 Do this:**

1. Click the **Risk** tab.

**✅ What you should see:**

- Either "No students at risk" emerald card OR a list of students with red composite scores.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### K.3 — Mastery tab — Topic mastery bars

**👉 Do this:**

1. Click **Mastery**.

**✅ What you should see:**

- A list of topics with coloured progress bars (green ≥75% / amber 50–74% / red <50%) and the student-with-data count.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### K.4 — Attendance tab — 30-day heatmap

**👉 Do this:**

1. Click **Attendance**.

**✅ What you should see:**

- A horizontal heatmap of the last 30 days with day labels + a colour legend.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

# §L — Roster corrections

### L.1 — P/L/A pills mark unmarked students

**👉 Do this:**

1. Open any session's roster: `/roster/<id>`.
2. Tap a **P** pill on an unmarked row.

**✅ What you should see:**

- The pill turns solid emerald + the row briefly disables.
- The status persists (refresh confirms).

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### L.2 — Tap active pill → unmark dialog (D-164)

**👉 Do this:**

1. Tap the now-active P pill again.

**✅ What you should see:**

- The "Un-mark this student?" confirmation appears.
- Confirming clears the pill back to unmarked.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### L.3 — Different pill on a marked row → CorrectionDialog with preset reasons

**👉 Do this:**

1. Mark a student Present. Then tap their **L** pill.

**✅ What you should see:**

- A correction dialog opens with status pre-selected = Late.
- Preset reason chips appear: "Late entry confirmed" · "QR scan failed" · "Teacher error" · "Other".
- Save → status persists. `audit_log` has a row with `entity='attendance'` and `action='correct'`.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### L.4 — Bulk "All Present" / "All Absent"

**👉 Do this:**

1. With some students still unmarked, tap **All Present**.
2. Confirm.

**✅ What you should see:**

- The "Pending" chip drops to 0; every previously-unmarked row flips to Present. Existing marks are not changed.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### L.5 — Realtime sync from a second device

**👉 Do this:**

1. Keep the roster open on one device.
2. On a second device, sign in as another teacher (or scan a QR from the student attendance screen) for the same session.

**✅ What you should see:**

- The roster on the first device updates within ~1 second when the second device's mark commits — the `teacher-roster-{id}` channel pushes the change.

**❓ If something looks different:**

- No update → the channel name in `features/teacher/useRoster.ts` was changed; ensure it stays `teacher-roster-${sessionId}`.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

# §M — Security + cleanup (Track 4A spot-checks)

### M.1 — No service-role-key in the client bundle

**👉 Do this:**

1. In PowerShell from the repo root:
   ```powershell
   pnpm --filter @fynestudy/web build
   ```
2. Wait ~30 seconds. After it completes:
   ```powershell
   Get-ChildItem apps/web/.next/static -Include *.js -Recurse | Select-String -Pattern 'SUPABASE_SERVICE_ROLE|service_role|sb_secret' | Measure-Object | Select-Object -ExpandProperty Count
   ```

**✅ What you should see:**

- Build ends with `✓ Generating static pages …` and a routes table that includes `/live/[sessionId]` and `/recording/[sessionId]`.
- The Select-String pipeline prints `0` — no matches.

**❓ If something looks different:**

- The number is non-zero → a server-only secret was bundled into a client component. Re-grep with `Select-String … -CaseSensitive` to find the file. Likely a stray `process.env.SUPABASE_SERVICE_ROLE_KEY` reference inside a `"use client"` file. **Stop and ping me.**

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### M.2 — Realtime channel cleanup count parity

**👉 Do this:**

1. From the repo root:
   ```powershell
   Get-ChildItem apps/web/features -Recurse -Include *.ts,*.tsx | Select-String -Pattern '\.channel\(' | Measure-Object | Select-Object -ExpandProperty Count
   Get-ChildItem apps/web/features -Recurse -Include *.ts,*.tsx | Select-String -Pattern '\.removeChannel\(' | Measure-Object | Select-Object -ExpandProperty Count
   ```

**✅ What you should see:**

- Both counts are equal. For Track 4A baseline, both should print **`3`** (chat-channel + raise-hand + ban-state — plus the existing Phase-2 attendance realtime channel makes it **`4`** depending on how Phase 2 inventoried; the parity is what matters).
- With Track 4B added, the count grows to **`6`** (Track 4A's 3 + teacher-roster + teacher session bans + same-batch chat-channel reuse). The automated `realtimeCleanupAudit.test.ts` source-scan iterates `features/{live,chat,teacher,attendance}/` and per-file enforces parity (34 file checks).

**❓ If something looks different:**

- Counts mismatch → some hook subscribed without a corresponding `removeChannel` in its cleanup function. The realtimeCleanupAudit test will also fail in §O — open the failing file path it prints and add the missing `void supabase.removeChannel(channel)` to the effect's cleanup return.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### M.3a — D-172 audit row coverage (Track 4B)

**👉 Do this:**

1. After running §G (live-control end class), §I (release + regrade), §J (offline scores save), §L (correction / unmark) in Supabase Studio:
   ```sql
   SELECT created_at, actor_role, action, entity, entity_id
     FROM public.audit_log
    WHERE created_at > now() - interval '2 hours'
    ORDER BY created_at DESC
    LIMIT 50;
   ```

**✅ What you should see:**

- Rows for: `attendance.correct`, `attendance.manual_mark`, `attendance.unmark`, `attendance.bulk_mark`, `exam.release`, `exam.regrade`, `offline_score.upsert`, `chat.delete`, `chat.ban`, `chat.unban`, `session.create_ad_hoc`, `yt_broadcast.create/golive/stop`. `before_json` + `after_json` populated.
- **NOTE:** quiz/exam builder writes (`quizzes` + `quiz_questions` + `exams` + `exam_questions`) do NOT show audit rows — they go through RLS-protected direct PostgREST writes (mobile precedent + `quiz-admin-mutate` / `exam-admin-mutate` are admin-only, line 36/38 of each edge fn). Builder writes are still RLS-policy-guarded.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### M.3 — Banned student state (advanced — requires a manual ban row)

**👉 Do this:** (skip if you don't want to muck with SQL; mark N/A.)

1. While the live tab is open, in Supabase Studio SQL run:
   ```sql
   INSERT INTO public.chat_bans (session_id, user_id)
   VALUES (
     '<live session uuid>',
     (SELECT id FROM public.app_users WHERE email = 'review.student@fynestudy.app' LIMIT 1)
   );
   ```

**✅ What you should see:**

- Within ~2 seconds the chat composer in your live tab pivots to its **disabled** state with the text "You've been muted by the teacher. You can read but can't send."
- The **Raise hand** button also disables (`disabled={!playerReady || isBanned}`).
- Delete the ban row to re-enable:
   ```sql
   DELETE FROM public.chat_bans
     WHERE session_id = '<live session uuid>'
       AND user_id = (SELECT id FROM public.app_users WHERE email = 'review.student@fynestudy.app' LIMIT 1);
   ```
- The composer flips back to enabled within ~2 seconds (the `useSessionState` hook receives a DELETE event).

**❓ If something looks different:**

- The composer doesn't disable → the `ban-{sessionId}-{userId}` channel isn't subscribed. Reload the page; it should re-bind on mount.
- The composer doesn't re-enable on DELETE → the `payload.eventType !== "DELETE"` branch isn't flipping `isBanned` back to false. Inspect `useSessionState.ts`.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _If FAIL, what you saw:_

---

### M.4 — No `is_correct` leak (Phase-3 invariant — Phase 4 must not regress)

**👉 Do this:**

1. From the repo root:
   ```powershell
   pnpm --filter @fynestudy/web test -- features/quiz/__tests__/cacheKeySecurity.test.ts
   ```

**✅ What you should see:**

- The Phase-3 cache-key-security test passes (all 4 sub-tests green). It source-scans attempt-stage code for any reference to `is_correct` or `correct_option_id` and fails if any sneak in.

**❓ If something looks different:**

- A test fails with "found `is_correct` reference in <path>" → a Phase 4 change accidentally introduced an attempt-stage leak. Open the failing path; remove the reference; re-run.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

# §N — Responsive + carry-overs

### N.1 — Desktop layout: side-by-side player + chat (≥ lg / 1024px wide)

**👉 Do this:**

1. Open the live tab in a Chrome window that's at least 1024px wide.

**✅ What you should see:**

- The player occupies the LEFT side (width ≈ 70vw or 1100px, whichever is smaller). The chat pane is on the RIGHT, full-height.
- The recording screen has the same split (player + Speed buttons left; CHAT REPLAY right).

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### N.2 — Narrow layout: stacked player above chat (< lg)

**👉 Do this:**

1. Drag the Chrome window to ~600px wide (or use DevTools device emulator → iPhone 14 / Pixel 7).

**✅ What you should see:**

- The player becomes a 16:9 hero block at the top.
- The chat pane (or CHAT REPLAY) drops below the player as a separate vertical section.
- Tap targets (raise hand button, speed pills, composer send button) all fit on a 320px screen with no horizontal scroll.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### N.2a — Teacher screens 320px → 1440px sweep (Track 4B)

**👉 Do this:**

1. Resize the Chrome window from 320px → 1440px in 5 steps. Visit each of the teacher screens at each size:
   - `/` (teacher home — Quick actions tiles + Pending list + My batches)
   - `/scan` (camera frame + session picker)
   - `/classes` (segmented + cards + FABs)
   - `/quiz-builder/new` + `/exam-builder/new` (form + sticky bottom bar)
   - `/exam-results/<id>` (roster + analysis)
   - `/offline-scores`
   - `/roster/<id>`
   - `/live-control/<id>` (setup card or Tabs view in live mode)

**✅ What you should see:**

- No horizontal scroll at 320px.
- At ≥1024px the teacher home becomes a 2-column layout (left col = Next / Pending / Today; right col = Quick actions / My batches).
- All FABs stay above the bottom-tabs on narrow widths.
- Sticky bottom bars on builders + offline-scores stay above the bottom-tabs.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _Notes:_

---

### N.3 — iOS Safari (carry-over)

**👉 Do this:** _CARRY-OVER — requires HTTPS / Vercel deploy. Mark N/A for now._

`Result:` [ ] N/A — pending Vercel deploy (Phase 5)

---

### N.4 — Android Chrome (carry-over)

**👉 Do this:** _CARRY-OVER — requires HTTPS / Vercel deploy. Mark N/A for now._

`Result:` [ ] N/A — pending Vercel deploy (Phase 5)

---

# §O — Automated test gates

Run each in order and tick:

### O.1 — TypeScript

```powershell
pnpm --filter @fynestudy/web typecheck
```

**✅ Expected:** 0 errors. Exit code 0.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, paste the first error:_

---

### O.2 — ESLint

```powershell
pnpm --filter @fynestudy/web lint
```

**✅ Expected:** 0 errors, 0 warnings.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, paste the first error:_

---

### O.3 — Vitest

```powershell
pnpm --filter @fynestudy/web test
```

**✅ Expected (Phase 4 closing — Track 4A + 4B):** 196/196 tests pass across 24 files. Notable Phase-4 files:
- Track 4A: `features/live/__tests__/chat-replay.test.ts` — 14 tests.
- Track 4A: `features/live/__tests__/realtimeCleanupAudit.test.ts` — 34 tests (file-by-file parity audit; auto-discovers Track-4B teacher hooks).
- Track 4B: `features/teacher/__tests__/scanToastMapper.test.ts` — 15 tests.
- Track 4B: `features/teacher/__tests__/rosterCorrectionState.test.ts` — 9 tests (D-164 active-pill toggle).
- Track 4B: `features/teacher/__tests__/builderQuestionReplace.test.ts` — atomic replace plan + reorder helper.
- Track 4B: `features/teacher/__tests__/offlineScoreValidation.test.ts` — zod schema + score-entry filtering.
- Track 4B: `features/teacher/__tests__/raiseHandQueue.test.ts` — FIFO ordering + ban dedup.
- Track 4B: `features/teacher/__tests__/cameraGesture.test.ts` — source-scan: WebcamScanner gates on `active`.
- Track 4B: `features/teacher/__tests__/streamKeyNoCache.test.ts` — source-scan: stream key never in React Query / localStorage.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, paste the failing test name + assertion:_

---

### O.4 — Next.js build

```powershell
pnpm --filter @fynestudy/web build
```

**✅ Expected (Phase 4 closing):** 36 routes total (Track 4A added 2, Track 4B added 7). Track 4B routes: `/scan` (now functional), `/content` `/quizzes` `/exams` `/batch` `/batch/[id]` (replaced placeholders), plus top-level FocusLayout `/quiz-builder/[quizId]` `/exam-builder/[examId]` `/exam-results/[examId]` `/offline-scores` `/roster/[sessionId]` `/live-control/[sessionId]`. sw.js generated. No `Attempted import error` warnings.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, paste the error:_

---

### O.5 — Playwright (optional smoke, may skip on no-seed)

```powershell
pnpm --filter @fynestudy/web e2e
```

**✅ Expected:** Tests in `live-student.spec.ts`, `recording.spec.ts`, `teacher-scan.spec.ts`, `teacher-classes.spec.ts`, `teacher-builders.spec.ts`, `teacher-results.spec.ts`, `live-control.spec.ts`, `teacher-roster.spec.ts`, `teacher-content.spec.ts` either pass or skip with a seed-tolerant message ("No live sessions" / "No exams"). The Playwright suite is not yet a CI gate; manual §A–§L is the authoritative coverage.

`Result:` [ ] PASS · [ ] SKIP · [ ] FAIL — _If FAIL, what you saw:_

---

# §P — Acceptance sign-off

Tick when every section above is green (or correctly marked N/A).

- [ ] §0 Setup
- [ ] §A Student live class
- [ ] §B Student recording
- [ ] §C Teacher home dashboard
- [ ] §D Teacher scan (webcam QR)
- [ ] §E Teacher classes (Schedule-Live + Ad-hoc FAB)
- [ ] §F Teacher content upload (video URL + PDF presign+PUT+finalize)
- [ ] §G Teacher live control + REAL OBS DRY-RUN (most important)
- [ ] §H Teacher quiz builder
- [ ] §I Teacher exam builder + results + regrade
- [ ] §J Teacher offline scores
- [ ] §K Teacher batch analytics
- [ ] §L Roster corrections
- [ ] §M Security + cleanup (incl. M.3a D-172 audit coverage)
- [ ] §N Responsive + carry-overs
- [ ] §O Automated test gates

**Tested by:** _____________________________
**Date:** _________________________________
**Notes / follow-ups:** _____________________

---

## Troubleshooting cheat-sheet (Track 4A common symptoms)

| Symptom | Likely cause | Fix |
|---|---|---|
| `/live/<uuid>` shows the "Loading…" dark lobby forever | `yt-playback-sign` returns 409 — class not live yet | Wait 60s; the auto-retry kicks in every 5s |
| Chat composer disabled with "Chat opens when the class goes live" | `signedPlayback` is null | Wait for `yt-playback-sign` to return 200 |
| Chat messages don't appear in another tab in real time | Realtime websocket not subscribed | DevTools → Network → WS frames; if no `chat-{id}` frame, reload |
| Raise hand button is greyed out | Live not ready OR banned OR `isBusy` | Hover for the tooltip / inspect element disabled attr |
| Player plays but watermark missing | `<Watermark>` sibling not rendered | Inspect `<Watermark text=…>` in React DevTools; check `formatWatermark` output |
| Speed buttons don't change playback rate | `setPlaybackRate` not propagating | Inspect WrappedYtPlayer `useEffect` on `playbackRate` |
| "This class has ended" appears unexpectedly | A `kind='system'` chat message was inserted | Inspect chat.messages; delete the system row if accidental |
| New tab on `/live/<id>` redirects to /login | Cookie session not present in new tab | Open the Chrome tab from inside the existing window (not Incognito) |
| Replay column stays empty even though chat exists | `session.started_at` is NULL | SELECT the session row; if NULL, the screen falls back to `scheduled_start` |
| Speed change doesn't reveal replay faster | `onPosition` callback wired wrong | Check `onPosition` is passed to `<WrappedYtPlayer …>`, posTickRef is alive |
| `pnpm build` fails with "Attempted import error: createClient" | Service-role helper imported from a client component | Search `'/lib/supabase/server'` imports in `"use client"` files |
| Vitest fails on realtimeCleanupAudit | A new hook added a `.channel(` without a matching `.removeChannel(` in cleanup | Open the failing path; pair them |

---

## Carry-overs (Track 4A scope)

1. Vercel deploy + Supabase Auth redirect-URL allowlist + edge-fn CORS allow-list for web-*.vercel.app (Phase 5).
2. iOS Safari + Android Chrome on-device QA — needs HTTPS.
3. The §A.9 pinned-banner + §A.10 end-of-class simulations depend on a teacher action that lands with Track 4B (live-control). For Track 4A they're advanced/N-A.
4. Real YouTube live-broadcast dry-run via OBS — that's §G in the Track 4B doc.

End of Phase 4 Track 4A manual test plan.
