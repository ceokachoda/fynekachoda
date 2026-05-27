# Phase 9 — Live Classes — Manual Test Plan (VISUAL / ON-DEVICE ONLY)

> **Trimmed 2026-05-22.** The agent re-ran the **entire data + logic layer** on the
> dev project (`orqwyazvcthgxoadfxfv`) — automated suites (`test:live` 9/9,
> `smoke:live-rls` 14/14, `smoke:live-fns` 34/34), the 6 edge fns + 3 tables + RLS +
> realtime + scope helpers, the seeded chat/raise-hand composition + replay offsets,
> the chat trigger denormalisation, the rate-limit, the cross-batch isolation, the
> Vault state, the advisor sweep, and the mobile gate (typecheck/lint/jest). **All
> green** (full results + every confirmed value in **§J**). The SQL-only / automated
> sub-tests that used to live here (old §0.5, §F3, §I) have been **removed — the agent
> already did them.**
>
> What remains is **only what a machine cannot do**: real-device rendering, the
> wrapped player, the moving watermark, real-time chat / raise-hand / pin / delete /
> ban across two devices, chat-replay sync + speed, the lobby countdown, airplane-mode
> reconnect, WebView teardown, cold-start — **plus §G**, the real-OBS YouTube
> broadcast dry-run, which genuinely needs **you** (Google channel, OAuth, OBS — see
> §0.0). Each remaining test lists the **agent-confirmed expected value**; if a screen
> shows something different, that's a **client render bug** (the data is proven), so
> report it.
>
> **How to report:** reply `OK`, `OK — note: <x>`, or `FAIL — <what you saw>`
> (+ screenshot if visual). Compact checklist in **§K**.
>
> **SQL during the session:** for the few tests that need a DB poke (§F2 stage, the
> §B6 un-mute), **just tell me when you reach that step and I'll run the SQL** and tell
> you what to expect. The SQL is kept inline for reference.

---

## §00 — How to actually run this test pass (beginner setup — read once)

New to this? This section gets you from "nothing open" to "ready to test." Do it once at
the start; the per‑run details are in §0.

### What you're testing, and the two roles
A live class has two sides: **students** (watch + chat + raise hand) and a **teacher**
(controls the stream, moderates chat, ends the class). You'll log in as different people
on different devices. The seed creates three accounts:

- **Student 1** and **Student 2** — students in the test batch.
- **Teacher** — assigned to that batch.

"Sign in as Student 1" just means: on the app's **login screen**, type Student 1's email +
password (from the seed summary I give you). These accounts have
`must_change_password=false`, so there's **no** forced password‑change screen — you go
straight in.

### Devices you need
- **Single‑device tests** (§A, §C, §D, §E, §F, §H1/H3): **one phone** is enough.
- **Two‑device tests** (§B — chat/raise‑hand/pin/delete/ban *across* people): you need
  **two screens at once** — e.g. two phones, or one phone + one simulator (iOS Simulator
  on a Mac / Android emulator). One is the **Student**, the other is the **Teacher**.
- **§G** (real YouTube): also a **computer with OBS** (see the setup guide).
- **iOS + Android:** the app must work on **both**. If you have both, run the visual tests
  (§A, §C) on each; §H4 is the dedicated parity check.

### Getting the app running on a device
1. Install **Expo Go** from the App Store (iOS) / Play Store (Android) on each test device.
2. Tell me **"ready to seed live"** — I run the seed and paste you the three logins.
3. Do the **Metro clean restart** in **§0.3** (non‑negotiable — Phase 9 changed the route
   tree). On each device, open **Expo Go → scan the QR** printed in the Metro terminal.
4. On the app's login screen, enter one role's email + password. To switch roles, sign out
   (Profile → sign out) or use a second device.

### How to report what you see
For each test below, reply with **one line**: `OK`, `OK — note: <x>`, or
`FAIL — <what you saw>` (add a screenshot for anything visual). The compact checklist is in
**§K**. Most of the data is already proven by the agent (§J), so if a screen shows
something different from the **agent‑confirmed** value noted in a test, that's a **client
render bug** — report it and I'll patch it.

### Two guides sit alongside this one
- **`phase-9-youtube-setup.md`** — the full A‑Z for the YouTube credentials + OBS (needed
  only for §G).
- **`phase-9-youtube-own-channel.md`** — optional: letting teachers stream to their *own*
  channel instead of the institute one (a planned add‑on; doesn't affect these tests).

---

## §0 — Setup before your pass (in order)

### 0.0 — ✅ YouTube is configured — §G is UNBLOCKED (done 2026-05-26)

> This used to be the only blocker. It's now **done.** Full setup history + how to change
> it: [`phase-9-youtube-setup.md`](./phase-9-youtube-setup.md).

All **5** YouTube secrets are loaded in Vault and **verified working**:
- OAuth app **published ("In production")** → the refresh token is **permanent** (no 7‑day
  expiry).
- The token controls channel **"NOvA FX"** (`UCSa8awrJseI_8r_oZQjuvYQ`), which is
  **live‑streaming enabled**.

What this means for your pass:
- **§A–§F + §H** run on the **seeded demo video** and never needed YouTube — unchanged.
- **§E** now shows a **real Server (RTMP URL) + Stream key** (no more amber "not
  configured" card) — scheduling a class creates a real *unlisted* broadcast on NOvA FX.
- **§G** (the real OBS dry‑run) is now **doable** — it just needs **OBS** on a computer
  (`phase-9-youtube-setup.md` STEP 6).

> ⚠ **"NOvA FX" is a temporary, personal streaming account** used to get this working. To
> point streaming at the **client's** YouTube account before go‑live, follow
> [`phase-9-youtube-client-handover.md`](./phase-9-youtube-client-handover.md).

**Report:** `0.0 — YT: configured ✅` (nothing for you to do here).

### 0.1 — Heads-up: Phase 8 is also pending visual QA (not a blocker)

Phase 9 does **not** change the Home dashboards, but the **Student → Classes** tab
reuses the Phase-8 `useStudentSchedule` feed. If a Classes-tab *row* looks wrong
(missing session, wrong time), first check it isn't a Phase-8 feed issue before filing
it as a Phase-9 bug. The **live / recording / chat / moderation** screens are pure
Phase 9.

### 0.2 — Re-seed (do this right before you start — there's a clock)

The seed plants an **upcoming** class that **starts ~12 min from when it runs** (drives
the §D lobby countdown). So seed **right before** §A.

- **Easiest:** tell me **"ready to seed live"** and I'll run `pnpm seed:live-manual-test --reset`
  and paste you the three fresh logins.
- **Or yourself:** run `pnpm seed:live-manual-test --reset`, copy the `== Summary ==` logins.

> If you spend more than ~12 min before §D, that upcoming class will already have
> started — just **re-seed** to reset the clock. Demo video is 3Blue1Brown
> `youtu.be/WUvTyaaNkzM`; if it shows "Video unavailable" in your region, edit
> `DEMO_VIDEO_ID` at the top of `scripts/seed-live-manual-test.ts` and re-seed.
>
> _[agent-confirmed: seed builds 1 course `P9_TEST_<n>` → Physics → 1 batch `P9_A_<n>`
> with Student 1 + Student 2 + 1 teacher; **LIVE** session (real video, 2 chat msgs),
> **UPCOMING** (no video, starts ~12 min), **RECORDING** (`ended`, real video, 9 chat
> rows + 2 resolved raised hands). All accounts `must_change_password=false`.]_

### 0.3 — Metro clean restart (NON-NEGOTIABLE)

Phase 9 added new routes (`live/`, `recording/`, `live-control/`), **deleted**
`live-session.tsx`, and added components/hooks. Hot-reload **cannot** propagate
route-tree changes (D-158) — a stale bundle 404s the new screens. Every session:

```
1. Ctrl+C in the Metro terminal.
2. Force-quit Expo Go on the device(s):
      iOS: swipe up, flick the Expo Go card away.
      Android: recents button, swipe Expo Go away.
3. pnpm dev:mobile -- --clear        ← the wrapper, WITH --clear.
4. Open Expo Go from its HOME-SCREEN icon (not from recents). Scan the QR.
5. The Metro log MUST print "(NNNN modules)" with N in the thousands.
   If it says "(1 module)" the cache did NOT clear — go back to step 1.
```
Do this on **both** devices if running the two-device test (§B).

**Report:** `0.3 ok — bundled NNNN modules`.

### 0.4 — What's NEW in Phase 9 (mental map)

- **Student Classes tab — rebuilt.** Was Live/Upcoming/Exams/Recent *sections*; now a
  **segmented control `Live | Upcoming | Recorded`** (with counts) + an Exams section
  underneath. Live rows → real **live player**; Recorded rows → **recording + chat replay**.
- **NEW student screens** (full-screen, outside the tab bar): the **live class** and
  the **recording**.
- **Teacher Classes tab** — now has **two floating buttons**: a **red broadcast (Radio)**
  (Schedule live) above the existing **blue "+"** (ad-hoc). Live-class rows show a red
  **"Live control" / "Go live"** button.
- **NEW teacher screen** — **live-control** (stream key / Go Live / chat moderation /
  raise-hand queue / pin / End class).
- The old fake `live-session.tsx` (Dr. Emily Chen / pravatar) is **gone**.

> _Backend deploy (old §0.5) — ✅ agent-verified: 6 edge fns ACTIVE + 3 tables RLS-on
> + 3 in realtime + 3 `private` helpers. See §J._

---

## §A — Student joins the LIVE class (single device, sign in as **Student 1**)

Sign in as Student 1 → tap the **Classes** tab.

### A1. Classes tab — segmented control + Live row
```
1. Header "My Classes" + subtitle "Live sessions, recordings and graded exams."
2. Segmented control: "Live 1" | "Upcoming 1" | "Recorded 1". "Live" selected (blue) by default.
3. ONE row: a RED broadcast icon on a red tile, "Physics" bold, "Today · HH:MM", a RED
   "Live" badge (pulsing dot) on the right.
4. Below: an "Exams" section (likely "No exams published…" — fine, exams are Phase 7).
```
_[agent-confirmed: 1 live + 1 upcoming + 1 recording session for this batch → counts 1/1/1.]_
**Report:** `A1 ok — Live(1)/Upcoming(1)/Recorded(1), live row red`.

### A2. Open the live class — wrapped player
```
1. Tap the live "Physics" row.
2. Live screen opens. Header: back chevron (grey circle) left, "Physics" blue, RED "LIVE" badge right.
3. Below: a BLACK video area that loads + PLAYS (3Blue1Brown). 1–3 s to start.
4. NO YouTube chrome beyond the small play button — no "Watch on YouTube", no channel
   name, no related-video grid.
```
_[agent-confirmed: live session carries real video `WUvTyaaNkzM`; `yt-playback-sign(live)`
returns a signed envelope in-batch (200).]_
**Report:** `A2 ok — live player loads + plays, no YT chrome`.

### A3. Watermark present + identifies the viewer (AC 6)
```
1. A corner of the video shows a faint translucent watermark = your first name + masked
   phone, e.g. "Student • ••1234".
2. It must be YOUR identity (Student 1's), not a generic label.
```
**Report:** `A3 ok — watermark shows my name + last-4`.

### A4. Watermark repositions (AC 7)
```
1. Keep watching ~60 s.
2. The watermark hops to a DIFFERENT corner (rotates through 4 corners + bottom-centre ~1×/min).
```
**Report:** `A4 ok — watermark moved after ~60s`.

### A5. Chat is visible + I can send
```
1. Below the video: a chat list with the 2 seeded messages — "Good evening sir! 👋"
   (Student One) and "Excited for today's class" (Student Two) — each with a coloured
   initials avatar + sender name + time.
2. Bottom: a blue "Raise hand" button + a "Type a message…" composer with a blue send button.
3. Type "Hello from student 1" → send. Your message appears at the BOTTOM instantly,
   labelled with your name + "(you)". The input clears.
```
_[agent-confirmed: live session has exactly those 2 seeded chat messages, author names
denormalised.]_
**Report:** `A5 ok — 2 seeded msgs, my send appears at bottom`.

### A6. Raise / lower hand (single-device feel)
```
1. Tap "Raise hand" (blue) → turns AMBER "Lower hand", a "Hand raised ✋" label appears right.
2. Tap "Lower hand" → back to blue "Raise hand"; the ✋ label disappears.
```
**Report:** `A6 ok — raise/lower toggles colour + label`.

---

## §B — Two-device LIVE: chat, raise-hand, pin, delete, ban, end

Device 1 = **Student 1** (stay on the live screen). Device 2 = **Teacher**. (One device +
one simulator is fine.)

### B1. Open teacher live-control
```
1. Device 2: sign in as Teacher → Classes tab.
2. Two FABs bottom-right: a RED broadcast (Radio) ABOVE a BLUE "+". The live "Physics"
   row shows a red "Live control" button.
3. Tap "Live control".
4. Live-control opens DIRECTLY in live mode (session already live): header "Physics" +
   "● Live now" + a people icon w/ viewer count + a red "End class" button. Below: a small
   video PREVIEW, then tabs "Chat" and "Hands (0)".
```
> If you land on a "Stream setup" screen instead, the session wasn't live — re-seed.

_[agent-confirmed: seeded session is `status='live'`.]_
**Report:** `B1 ok — live-control opens in live mode, viewer count + End class`.

### B2. Chat both ways (AC 8, 9)
```
1. TEACHER → "Chat" tab → type "Welcome everyone" → send.
2. Within ~1 s it appears on STUDENT 1's chat, with a green "Teacher" badge by the name.
3. STUDENT 1 → send "Can you hear us?". Within ~1 s it appears on the TEACHER's panel.
```
_[agent-confirmed: chat tables in realtime publication; trigger stamps author_role so
the green "Teacher" badge has data.]_
**Report:** `B2 ok — messages cross both ways < ~1s, Teacher badge shows`.

### B3. Raise hand → teacher queue → resolve (AC 10)
```
1. STUDENT 1 → tap "Raise hand" (amber "Lower hand").
2. TEACHER → tab now reads "Hands (1)". Tap it.
3. Queue shows "1" + "Student One <n>" + a green "Resolve" button.
4. Tap "Resolve". Queue empties ("Hands (0)"), AND on STUDENT 1 the button flips back to
   blue "Raise hand" (✋ clears) within ~1 s.
```
**Report:** `B3 ok — hand appears in queue, resolve clears it on both sides`.

### B4. Pin an announcement (AC 11)
```
1. TEACHER → Chat tab → tap the blue "Pin an announcement" bar (above the composer). A sheet opens.
2. Type "We'll review Chapter 4 at the end." → tap "Pin".
3. Within ~1 s, a BLUE banner appears at the top of STUDENT 1's chat: "Pinned by <teacher>" + text.
```
**Report:** `B4 ok — pinned banner appears on student within ~1s`.

### B5. Delete a chat message (AC 12)
```
1. TEACHER → LONG-PRESS Student 1's "Can you hear us?" (~0.4 s).
2. Sheet shows the text + "Delete message" (red) + "Mute … for this class" (amber).
3. Tap "Delete message". Within ~1 s it DISAPPEARS from BOTH chats.
```
_[agent-confirmed: `chat-delete` soft-deletes (`is_deleted=true`) via the edge fn.]_
**Report:** `B5 ok — deleted message vanishes for both within ~1s`.

### B6. Mute / ban a student (AC 13)
```
1. TEACHER → long-press any Student 1 message → "Mute Student One … for this class".
2. Within ~1 s on STUDENT 1, the composer is REPLACED by grey text "You've been muted by
   the teacher. You can read but can't send." Student 1 can still scroll + read.
3. (Optional) TEACHER sends another message — Student 1 still RECEIVES it (read works).
```
_[agent-confirmed: `chat-ban` inserts a ban row; banned student reads but cannot insert
(403) — proven in `smoke:live-rls`.]_
> **Un-mute (now has teacher UI):** long-press any message from the muted student again →
> the sheet header shows "<name> (muted)" and the amber "Mute…" row is replaced by an
> emerald "Unmute <name> for this class". Tap it → within ~1 s the student's composer
> re-enables (the grey "muted" notice disappears and they can type + send again).

**Report:** `B6 ok — muted composer disabled; Unmute from the sheet re-enables it`.

### B7. End class → student moves to the recording (AC 14, partial)
```
1. TEACHER → tap red "End class" → confirm in the alert.
2. Teacher returns to the Classes list.
3. Within ~1 s, STUDENT 1's live screen shows "This class has ended" + a blue "Watch recording" button.
4. Tap "Watch recording" → opens the recording screen, video loads. (Real YouTube
   auto-save is §G; here the seeded video stands in.)
```
_[agent-confirmed: `yt-broadcast-stop` sets `status='ended'` + inserts a system
"Class has ended." message — proven in `smoke:live-fns`.]_
**Report:** `B7 ok — End class → student sees "ended" + Watch recording`.

---

## §C — Recording + chat replay (sign in as **Student 1** or **Student 2**)

### C1. Open the recording
```
1. Classes tab → "Recorded" segment. ONE row, VIOLET video icon + a violet "Watch" badge (play triangle).
2. Tap it. Recording screen: header + grey "RECORDING" badge, the video player, a "Speed"
   row "1× 1.5× 2×", and a chat area (a hint that chat will replay as the video plays).
```
**Report:** `C1 ok — recording opens, RECORDING badge + speed buttons`.

### C2. Chat replays IN SYNC (AC 16)
```
1. Press play. Watch the chat area.
2. Messages appear roughly in time with the video, IN ORDER, NOT all at once.
3. The system "Class has ended." marker does NOT appear in the replay.
```
_[agent-confirmed: 9 recording rows at these offsets — replay reveals the first 8;
the system marker at 180 s is filtered out:_
```
 5s  "Good evening sir!"                 (Student One, chat)
12s  "Ready for kinematics 🚀"           (Student Two, chat)
30s  "We'll cover projectile motion…"    (Teacher, ANNOUNCEMENT — green badge)
45s  "Can you explain the derivation…?"  (Student One, chat)
70s  "Same doubt here"                   (Student Two, chat)
95s  "Sure — pausing to recap…"          (Teacher, chat)
130s "Got it, thanks!"                   (Student One, chat)
160s "Crystal clear now 🙏"              (Student Two, chat)
180s "Class has ended."                  (SYSTEM — NOT shown in replay)
```
_]_
**Report:** `C2 ok — messages reveal in time + order as the video plays`.

### C3. Speed control accelerates the replay (AC 17)
```
1. Tap "2×". The button turns blue; the VIDEO plays ~2× faster.
2. The remaining chat reveals FASTER too (replay is keyed to the player's real position).
3. Tap "1×" to return to normal.
```
**Report:** `C3 ok — 2× speeds up video AND chat reveal`.

### C4. Scrub re-syncs
```
1. Drag the YouTube scrubber back toward the start.
2. The replay re-syncs: messages already past the new position stay; "future" ones
   (relative to the scrubbed position) hide until reached.
```
_[agent-confirmed: `messagesUpTo` windowing + offset math proven in `test:live`.]_
**Report:** `C4 ok — scrubbing re-syncs the replay`.

---

## §D — Upcoming lobby (sign in as **Student 1**)
```
1. Classes tab → "Upcoming" segment. ONE row (blue calendar icon, "Today · HH:MM").
2. Tap it. A DARK lobby screen: a broadcast icon, the subject name, and either:
      • "Starts in mm:ss" counting DOWN (start is ~12 min out), OR
      • "Waiting for the teacher to go live…" with a spinner (if start has passed).
3. NO video yet (the upcoming session has no broadcast).
```
_[agent-confirmed: upcoming session is `scheduled`, no video, starts ~10–12 min after
seeding.]_
> To watch it flip to "Waiting…", tell me and I'll run the §F2 SQL to push start into the past.

**Report:** `D1 ok — lobby countdown / waiting state renders`.

---

## §E — Teacher schedules a NEW live class (real stream key now shown)
```
1. Teacher → Classes tab → tap the RED broadcast (Radio) FAB (upper button).
2. "Schedule live class" sheet: subtitle "Streams over YouTube. You'll get your OBS
   stream key on the next screen.", a batch picker (your batch pre-selected), duration
   chips "30 / 45 / 60 / 90 min", a "Starts …" summary, a RED "Set up live class" button.
3. Tap "Set up live class".
4. You're taken to LIVE-CONTROL for the new session, header "Setup". Because YouTube is now
   configured (§0.0), the "Stream setup" card shows a real "Server (RTMP URL)" + "Stream
   key", each with its own **Copy** button, plus a **Copy Server + Key** button (tapping
   briefly shows a green "Copied"). A red "Go Live" button is below.
      • This just created a real *unlisted* broadcast on the NOvA FX channel — expected.
      • If you instead see an amber "YouTube isn't configured yet" card, the secrets aren't
        loading — tell me (it shouldn't happen now).
5. Tap "Go Live". Header flips to "● Live now"; "Chat"/"Hands" tabs + "End class" appear.
   The preview says "Connecting preview… (needs an active YouTube stream)" until OBS is
   actually streaming (that's §G) — expected.
6. (Cross-device) A batch student can open this from their "Live" tab; chat / raise-hand
   / pin / ban all work (only the VIDEO needs OBS). Send a chat student→teacher.
7. Tap "End class" → confirm. Session ends.
```
_[agent-confirmed (data layer): `yt-broadcast-golive` sets `status='live'` (200). NOTE: the
old `smoke:live-fns` "503 not configured" result no longer applies — `yt-broadcast-create`
now returns a real key (secrets loaded 2026-05-26).]_
**Report:** `E1 ok — schedule → real stream key shown → Go Live → live → End`.

---

## §F — Security / edge behaviour (device)

### F1. Chat rate-limit (device, Student 1, on the live session)
```
1. As Student 1, open the live class.
2. Send 6 messages as fast as you can (within ~10 s).
3. The first 5 send fine; the 6th FAILS with a red line under the composer:
   "Sending messages too fast - please slow down."
```
_[agent-confirmed: the 5-msgs/window rate-limit trigger blocks the 6th (HTTP 400) —
proven in `smoke:live-rls`. This test confirms the UI surfaces the error.]_
**Report:** `F1 ok — 6th rapid message rate-limited`.

### F2. (Helper) flip the upcoming session live / reset it
Tell me and I'll run either of these (to re-test lobby→live, etc.):
```sql
-- make the UPCOMING session start in the past (lobby shows "Waiting…"):
update public.sessions set scheduled_start = now() - interval '1 minute'
where status='scheduled' and is_live_class
  and batch_id in (select id from public.batches where name like 'P9_A_%');

-- flip a scheduled session live with the demo video (so a student can play it):
update public.sessions
set status='live', started_at=now(), yt_video_id='WUvTyaaNkzM'
where status='scheduled' and is_live_class
  and batch_id in (select id from public.batches where name like 'P9_A_%');
```
**Report:** `F2 ok — staged` (or skipped).

> _Old §F3 (cross-batch isolation: other-batch student can't read chat / get a playback
> token / see the hand queue; banned-read-not-post; rate-limit) — ✅ done by agent via
> `smoke:live-rls` (14 checks). See §J._

---

## §G — Real-YouTube live broadcast (the ACTUAL live-streaming test, click-by-click)

This is the **one** test that uses a real YouTube stream end-to-end — everything before it
used a seeded demo video. It needs **OBS on a computer** + your **teacher phone** + ideally
a **second device** signed in as a student. Budget ~20 min the first time. Closes AC
2–7, 14–15, 22.

> The **one-time** OBS setup (building the scene, encoder, mic) lives in
> `phase-9-youtube-setup.md` **STEP 6** — do that first. This section is the per-broadcast
> run. OBS errors → that doc's **§9** troubleshooting table.

### G0. Pre-flight — tick all before you start
```
- [ ] OBS installed + a scene built (screen + webcam + mic) + a 20-sec test recording
      played back with picture + sound (setup STEP 6 + 6.9).
- [ ] §0.0 above says "YT: configured ✅" (it does).
- [ ] Teacher signed in on your phone; ideally a student signed in on a 2nd device.
- [ ] A way to copy text from phone → OBS computer (WhatsApp "message yourself",
      Telegram "Saved Messages", or email-to-self).
- [ ] Decent upload internet on the OBS computer (≥ ~5 Mbps up; wired if possible).
```
**Report:** `G0 ok — OBS ready + signed in`.

### G1. Teacher (phone) — schedule the class + copy the REAL stream key
```
1. Teacher → Classes tab → tap the RED broadcast (Radio) FAB (upper of the two).
2. "Schedule live class" sheet → pick the batch (pre-selected) + a duration chip → tap
   "Set up live class".
3. Live-control opens (header "Setup"). The "Stream setup" card shows a real:
      • Server (RTMP URL) — e.g. rtmp://a.rtmp.youtube.com/live2
      • Stream key — a long secret string
   each with a Copy button, plus a "Copy Server + Key" button.
4. Tap "Copy Server + Key" (green "Copied" flashes). Paste it into a message to yourself;
   open that message on the OBS computer.
```
_[If you see an amber "YouTube isn't configured yet" card instead, the secrets aren't
loading — stop and tell me; it shouldn't happen now.]_
**Report:** `G1 ok — real Server + Key shown + copied to computer`.

### G2. OBS (computer) — connect + Start Streaming
```
1. OBS → Settings (bottom-right ⚙) → "Stream" tab.
2. Service: choose "Custom…".
3. Server: paste the RTMP URL.   Stream Key: paste the key.   → click OK.
4. Click "Start Streaming" (bottom-right).
5. SUCCESS = the bottom status bar turns GREEN with a kbps number + a LIVE timer + a
   low/zero "dropped frames" count.
```
> "Failed to connect to server"? The key may be stale/already used — re-copy a fresh
> Server + Key from the app (G1) and paste again. More fixes: setup doc §9.
**Report:** `G2 ok — OBS streaming (green bar, kbps climbing)`.

### G3. Verify it reached YouTube + it's UNLISTED (don't skip this)
```
1. On the OBS computer open https://studio.youtube.com → left menu "Content" → "Live" tab
   (or Create → Go Live → "Manage").
2. You should see the broadcast the app created, titled "<Subject> · <Batch>".
3. Its "Stream health" should read "Good" or "Excellent".
4. ✅ Confirm its visibility says "Unlisted" — NOT "Public". (The app creates it unlisted
   by design; if it ever shows Public, that's a bug — tell me.)
```
**Report:** `G3 ok — YT shows the broadcast, health good, visibility UNLISTED`.

### G4. Teacher (phone) — tap Go Live
```
1. Back in the app's live-control, tap the red "Go Live" button.
2. Header flips to "● Live now"; "Chat"/"Hands" tabs + a viewer count + "End class" appear.
```
**Report:** `G4 ok — went live in app`.

### G5. Student — see the REAL feed + watermark (AC 5/6/7)
```
1. Student device → Classes → "Live" segment → tap your class row.
2. The wrapped player shows YOUR OBS FEED. Wave at your webcam — you'll see it on the
   student device after a ~10–30 s delay. ⚠ That delay is NORMAL YouTube live latency,
   NOT a bug (the chat/raise-hand below are instant regardless).
3. The moving watermark (the student's name + masked phone) sits over the REAL feed and
   repositions ~1×/min.
4. No YouTube chrome (no "Watch on YouTube", no channel name, no related-video grid).
```
**Report:** `G5 ok — student sees my live feed + moving watermark, ~Ns delay`.

### G6. Live interaction against the REAL stream (AC 8–13)
Now run the whole **§B** flow, but over the real video: chat both ways, raise hand →
teacher resolves, pin an announcement, delete a message, mute a student. Each should behave
exactly as it did in §B (within ~1 s), now while the real stream plays.
**Report:** `G6 ok — chat/hands/pin/delete/ban all work during the live stream`.

### G7. End the class — APP FIRST, then OBS (AC 14)
```
1. App (teacher): tap red "End class" → confirm. (This finishes the YouTube broadcast AND
   marks the session ended.)
2. OBS: click "Stop Streaming".
3. The student's live screen shows "This class has ended" + a "Watch recording" button.
```
> Always End in the app FIRST — that's the clean path that finalises the YouTube broadcast
> and links the recording. (Stopping OBS first also auto-ends it, but use the app button.)
**Report:** `G7 ok — ended in app, then stopped OBS`.

### G8. Recording appears + chat replays (AC 15/16)
```
1. YouTube needs a FEW MINUTES to process the finished live stream into a saved video —
   be patient; it won't be instant.
2. Student → Classes → "Recorded" segment → open the new row.
3. The saved REAL video plays, with the watermark visible.
4. The chat from THIS session replays in sync as the video plays.
```
> Recording not watchable yet? Wait a few minutes for YouTube processing and reopen. (If it
> never appears after ~15 min, tell me and I'll check the session's `yt_video_id`.)
**Report:** `G8 ok — real recording plays + chat replays` (or `processing — will recheck`).

### G9. (Optional, hardware) Memory on a low-end Android (AC 22)
On a Redmi 8A-class device, run a ~30-min live session → RAM should stay under ~350 MB
(only one WebView is mounted; it unmounts when you leave the screen).
**Report:** `G9: NNN MB peak` or `skipped — no Redmi 8A`.

### G10. (Optional) OBS drops mid-class → recovery
In OBS click "Stop Streaming" for ~15 s, then "Start Streaming" again. The student's player
should re-buffer and resume within ~30 s (YouTube + the app tolerate a brief ingest gap).
**Report:** `G10 ok — recovered after OBS reconnect` or `skipped`.

---

## §H — Realtime, reconnect, devices

### H1. Realtime delivery latency (covered in §B)
Already exercised by §B2/§B4/§B5 — messages, pins, deletes propagate within ~1 s. Note
here if any only updated after a manual scroll/re-open.
_[agent-confirmed: chat_messages / raise_hand_events / chat_bans are all in the
`supabase_realtime` publication.]_
**Report:** `H1 ok — realtime < ~1s` (or where it lagged).

### H2. Network drop + auto-reconnect (device)
```
1. STUDENT 1 in a live class → airplane mode ON ~10 s → OFF.
2. Video may pause/buffer then resume. Have the TEACHER send a message while the student
   is offline — after reconnect, that message should arrive (Realtime auto-reconnects).
```
**Report:** `H2 ok — recovers after airplane-mode toggle` (or what broke).

### H3. WebView is unmounted on leave (memory hygiene)
```
1. In a live class (player playing), tap the back chevron to leave.
2. Audio STOPS immediately (player pauses/unmounts on blur). Re-enter → loads fresh. No
   "ghost" audio in the background.
```
**Report:** `H3 ok — audio stops on leave, only one player at a time`.

### H4. iOS / Android parity (do this — both platforms must pass)
Phase 9 ships on **iOS and Android equally**; a feature isn't "done" until it works on
both. If you have one of each, run this checklist on the **second** platform after the
first. (Two devices of the same OS still counts for §B, but parity needs one of each.)
```
On the OTHER platform, repeat the key flows and watch for OS-specific breakage:
 a. §A2/§A3/§A4 — live player loads + PLAYS; watermark shows your name + last-4; it moves.
 b. §A5 + §B2 — open the chat composer: the on-screen KEYBOARD must NOT cover the input or
    push the video off-screen; the input stays visible and you can type + send.
 c. Safe areas — header isn't under the notch/status bar (iOS) or the camera cutout
    (Android); nothing is clipped at the bottom gesture bar.
 d. §C1/§C2 — recording opens, the speed row (1×/1.5×/2×) is tappable, chat replay reveals
    in time + order.
 e. §A6/§B3 — raise/lower hand toggles colour + label; the teacher queue updates.
 f. Text/emoji in chat render the same (no missing glyphs, no clipped sender names).
```
**Report:** `H4 ok — parity (iOS + Android)` or list each difference + which OS.

### H5. Cold-start budget — Redmi 8A class (hardware)
```
On a low-end Android (Redmi 8A, Android 9, 2 GB RAM): cold-launch + open a live class.
Row tap → player painted should feel < ~3 s.
```
**Report:** `H5: live open Ns` or `skipped — no Redmi 8A`.

---

## §J — Agent-verified on 2026-05-22 (DON'T re-test)

Re-run against the dev project (`orqwyazvcthgxoadfxfv`) on 2026-05-22 — all **green**.
These feed the "agent-confirmed" annotations above.

### Automated suites
| Suite | Result |
|---|---|
| `pnpm test:live` | **9/9 groups** (HMAC sign/verify/tamper/rotation/envelope; YT ISO-8601 duration + id/url parser; chat-replay offset math + windowing/sort) |
| `pnpm smoke:live-rls` | **14/14** (own-session read; **cross-batch chat hidden**; 5 OK + **6th rate-limited 400**; **banned reads but can't post 403**; `yt-playback-sign(live)` in-batch 200 / **cross-batch 404**; raise-hand in-batch OK / **cross-batch 403** / teacher sees queue / cross-batch can't) |
| `pnpm smoke:live-fns` | **34/34** (full 6-fn lifecycle — see below) |
| Mobile gate | `typecheck` (6 projects) clean · `lint` (admin eslint + mobile expo lint) clean · `jest` **53/53** · shared **17/17** |

### Edge-fn lifecycle (`smoke:live-fns`, all 6 fns)
- `yt-broadcast-create`: 401 / 400 / 404 / 403(role) / 403(unassigned) / **503 (YT not configured)**.
- `yt-broadcast-golive`: 403 / 404 / **200 + sets `status='live'`**.
- `yt-playback-sign`: live 200 / **recording-before-end 409** / recording-after-end 200 /
  cross-batch 404 / 400.
- `chat-delete`: 400 / 404 / 403 / **200 + `is_deleted=true`**.
- `chat-ban`: self-400 / 403 / 200 / **idempotent 200** / unban 200 / row removed.
- `yt-broadcast-stop`: 403 / **200 + `status='ended'` + inserts the system end message**.

### Backend deploy (old §0.5)
- 6 edge fns **ACTIVE** (`verify_jwt=true`): `yt-broadcast-create`, `yt-broadcast-golive`,
  `yt-broadcast-stop`, `yt-playback-sign` (v2), `chat-delete`, `chat-ban`.
- 3 tables **RLS-on**: `chat_messages`, `raise_hand_events`, `chat_bans`.
- All 3 in the `supabase_realtime` publication.
- 3 `private` helpers present: `can_access_session`, `is_session_teacher`, `is_session_live`.

### Seeded composition (source of truth for the annotations)
- **Sessions** for `P9_A_<n>`: `live` (real video, 2 chat msgs) · `scheduled` (no video,
  starts ~10–12 min) · `ended` (real video, 9 chat rows) → segmented **1 / 1 / 1**.
- **Live chat (2):** "Good evening sir! 👋" (Student One) · "Excited for today's class"
  (Student Two) — `kind=chat`, author names denormalised.
- **Recording chat (9):** offsets 5/12/**30(announcement)**/45/70/95/130/160/**180(system)** —
  8 conversational rows replay, the 180 s system "Class has ended." is excluded from replay.
- **Raised hands:** 2 total, 2 resolved.

### SQL sanity (old §I)
- Policies: `chat_messages` **2** (cm_read/cm_insert), `raise_hand_events` **3**,
  `chat_bans` **1** (cb_read).
- Chat trigger denormalises `author_name` + `author_role` (never blank) and stamps
  `kind ∈ {chat, announcement, system}` — verified on the seeded rows.
- Phase-9 audit actions = **0 rows** now (expected — fills `yt_broadcast_*` /
  `live_session_*` / `chat_*` after a real broadcast/end/moderation; the seed plants
  history directly).

### Vault / YouTube config  _(updated 2026-05-26 — now PROVISIONED)_
- **5 secrets loaded + verified:** `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`,
  `INSTITUTE_CHANNEL_ID`, `YT_DATA_API_KEY`. OAuth app **published** → permanent token;
  controls channel **NOvA FX** (`UCSa8awrJseI_8r_oZQjuvYQ`), live‑streaming enabled.
- ⚠ Because secrets are now present, the `smoke:live-fns` "**503 (YT not configured)**"
  assertion (in the table above, from 2026‑05‑22) **no longer holds** — `yt-broadcast-create`
  now attempts a real broadcast. Don't re‑run that one assertion against this project (it
  would create real unlisted broadcasts on NOvA FX).
- NOvA FX is a temporary personal account → swap to the client's per
  `phase-9-youtube-client-handover.md`.

### Advisor sweep (project-wide)
- **Security: 0 ERRORs.** WARNs = 3× `authenticated_security_definer_function_executable`
  (Phase-8 dashboard RPCs, accepted D-186) + `auth_leaked_password_protection` (Phase-1
  backlog). No new lints from Phase 9 DDL.
- **Performance: 0 ERRORs.** All INFO/WARN are in the project-wide accepted set
  (`multiple_permissive_policies`, `unindexed_foreign_keys`, `unused_index`,
  `auth_rls_initplan`).

---

## §K — Report-back format (visual / device only)

One line per test. `OK`, `OK — note: <x>`, or `FAIL — <what you saw>`.

```
0.0 — YT: configured ✅
0.3 ok — NNNN modules

A1 ok — Live/Upcoming/Recorded segmented (1/1/1)
A2 ok — live player loads, no YT chrome
A3 ok — watermark = my name + last4
A4 ok — watermark moved after ~60s
A5 ok — 2 seeded msgs + my send
A6 ok — raise/lower toggles

B1 ok — live-control live mode + viewer count
B2 ok — chat both ways < ~1s
B3 ok — hand → queue → resolve clears both
B4 ok — pinned banner appears
B5 ok — delete vanishes for both
B6 ok — muted composer disabled, can read
B7 ok — End → "ended" + Watch recording

C1 ok — recording + speed buttons
C2 ok — replay in time + order
C3 ok — 2× speeds video + chat
C4 ok — scrub re-syncs

D1 ok — lobby countdown / waiting

E1 ok — schedule → setup → Go Live → End

F1 ok — 6th message rate-limited
F2 ok — staged (or skipped)

G0 ok — OBS ready + signed in
G1 ok — real Server + Key copied to computer
G2 ok — OBS streaming (green bar)
G3 ok — YT shows broadcast, health good, UNLISTED
G4 ok — went live in app
G5 ok — student sees my live feed + watermark (~Ns delay)
G6 ok — chat/hands/pin/delete/ban work live
G7 ok — ended in app then OBS
G8 ok — real recording + chat replay (or processing)
G9: NNN MB (or skipped)
G10 ok — OBS reconnect recovered (or skipped)
   (whole §G skipped if OBS not set up yet)

H1 ok — realtime < ~1s
H2 ok — reconnect after airplane mode
H3 ok — audio stops on leave
H4 ok — parity iOS+Android (or differences + which OS)
H5: live open Ns (or skipped)
```

Anything that **FAILS** — paste the test number + what you saw + a screenshot if visual
+ (for realtime) tell me and I'll pull the Supabase log line. Since the data + logic
layer is proven (§J), a value mismatch on screen is a client render bug — I'll patch
before the **ACCEPTED** line in `phase-9.md §15`.

## Sign-off

✅ **ACCEPTED — 2026-05-27.** §A–§F + §H passed on real devices (iOS + Android) **and §G
(the real OBS → unlisted-YouTube live-broadcast dry-run) passed** on the dev "NOvA FX"
channel. Phase 9 status flipped to ✅ in `CLAUDE.md` + `docs/phases/phase-9.md §15`. A post-QA
bug-hunt (2026-05-27) shipped fixes — see `phase-9.md §15.11` (3 LOW-severity edge-fn guards
ride the Phase 12 prod edge-fn deploy). Remaining carry-over: Redmi 8A live-session memory
profile → Phase 12 perf pass.
