# Phase 4 — Manual Test Plan (`apps/web` — Live Classes + Teacher Portal)

> **Audience:** the human running the manual tests. **Zero coding background required** — every step has the exact buttons to click, the exact URL to type, and what you should see on screen.
>
> **What you're testing:** the Phase 4 surfaces of `apps/web` — the **student** Live class screen (lobby → wrapped YouTube + realtime chat + raise-hand + pinned + end-of-class) at `/live/[sessionId]`, the **student** Recording screen (player + speed buttons + time-synced chat replay) at `/recording/[sessionId]`, and (in Track 4B) the **teacher** portal (home, scan webcam QR, classes, library upload, quiz/exam builders, results, offline scores, batch analytics, roster, live-control). Walk through every section in order. **Chrome on a laptop/desktop is required.** iOS Safari + Android Chrome rows tagged **carry-over** need HTTPS — do them after the Vercel deploy session (intentional, not a blocker).
>
> **How to record results:** every test ends with `[ ] PASS / [ ] FAIL / [ ] N/A`. Tick one box. If FAIL, write what you saw in the space below it and ping me — I'll diagnose. If N/A, write the reason.
>
> **Estimated time (Track 4A only):** ~45 minutes on Chrome desktop if no failures. Track 4B sections (§C–§L) will be added in the next conversation — that session's QA is ~3 hours including the OBS dry-run.
>
> **🟡 Phase 4 is being built in two tracks.** This document is the FULL Phase 4 doc; the **Track 4A** sections (§0, §A, §B, security spot-checks in §M, responsive in §N, automated gates in §O) are LIVE and ready to test now. The **Track 4B** sections (§C teacher home → §L roster + live-control) will be appended in the next conversation when those features are built. Until then, treat §C–§L as `N/A — pending Track 4B`.

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
- §C–§L — pending Track 4B (next conversation).

> Source of truth for credentials: `CREDENTIALS.local.md` at the repo root (git-ignored, do not paste publicly).

---

## Table of contents

- **§0 Setup** — branch, env, dependencies, seed, dev server, DevTools (7 sub-tasks)
- **§A Student live class** — lobby countdown → player → chat → raise-hand → pinned → end-of-class (10 tests) ✅ Track 4A
- **§B Student recording** — playback → speed buttons → chat replay sync (7 tests) ✅ Track 4A
- **§C Teacher home dashboard** — Track 4B (pending)
- **§D Teacher scan (webcam QR)** — Track 4B (pending)
- **§E Teacher classes** — Track 4B (pending)
- **§F Teacher content upload** — Track 4B (pending)
- **§G Teacher live control + REAL OBS DRY-RUN** — Track 4B (pending)
- **§H Teacher quiz builder** — Track 4B (pending)
- **§I Teacher exam builder + results + regrade** — Track 4B (pending)
- **§J Teacher offline scores** — Track 4B (pending)
- **§K Teacher batch analytics** — Track 4B (pending)
- **§L Roster corrections** — Track 4B (pending)
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

# §C–§L — Track 4B (pending)

These sections will be appended in the next conversation when Track 4B (teacher portal) is built. For now, mark them `N/A — pending Track 4B`:

- §C Teacher home dashboard
- §D Teacher scan (webcam QR)
- §E Teacher classes
- §F Teacher content upload
- §G Teacher live control + REAL OBS DRY-RUN
- §H Teacher quiz builder
- §I Teacher exam builder + results + regrade
- §J Teacher offline scores
- §K Teacher batch analytics
- §L Roster corrections

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
- The same audit is automated as `features/live/__tests__/realtimeCleanupAudit.test.ts` (it iterates files and per-file enforces parity).

**❓ If something looks different:**

- Counts mismatch → some hook subscribed without a corresponding `removeChannel` in its cleanup function. The realtimeCleanupAudit test will also fail in §O — open the failing file path it prints and add the missing `void supabase.removeChannel(channel)` to the effect's cleanup return.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

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

**✅ Expected (Track 4A baseline):** 117/117 tests pass across 17 files. Notable Phase-4 files:
- `features/live/__tests__/chat-replay.test.ts` — 14 tests.
- `features/live/__tests__/realtimeCleanupAudit.test.ts` — 11 tests (file-by-file parity audit).

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, paste the failing test name + assertion:_

---

### O.4 — Next.js build

```powershell
pnpm --filter @fynestudy/web build
```

**✅ Expected:** 29 routes total. New routes from Track 4A: `/live/[sessionId]` (ƒ) and `/recording/[sessionId]` (ƒ). sw.js generated. No `Attempted import error` warnings.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, paste the error:_

---

### O.5 — Playwright (optional smoke, may skip on no-seed)

```powershell
pnpm --filter @fynestudy/web e2e -- live-student.spec.ts recording.spec.ts
```

**✅ Expected:** Either tests pass, or they skip with the message "No live sessions in this environment" / "No recordings in this environment" — both are acceptable signals. The Playwright suite is not yet a CI gate; manual §A + §B is the real coverage.

`Result:` [ ] PASS · [ ] SKIP · [ ] FAIL — _If FAIL, what you saw:_

---

# §P — Acceptance sign-off

Tick when every section above is green (or correctly marked N/A).

- [ ] §0 Setup
- [ ] §A Student live class
- [ ] §B Student recording
- [ ] §C–§L (Track 4B — pending)
- [ ] §M Security + cleanup
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
