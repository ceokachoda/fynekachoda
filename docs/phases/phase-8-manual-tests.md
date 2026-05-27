# Phase 8 — Manual Test Plan (VISUAL / ON-DEVICE ONLY)

> **Trimmed 2026-05-22.** The agent re-ran the **entire data + logic layer** on the
> dev project (`orqwyazvcthgxoadfxfv`) — automated suites, the dashboard RPC
> definitions, the seeded data composition, RLS, idempotency, the realtime
> publication, the advisor sweep, and the next-card cascade logic. **All of it is
> green** (full results + every confirmed number in **§J**). The SQL-only sub-tests
> that used to live here (old §0.1, §0.4, §C3, §D3, §H3, §I) have been **removed —
> the agent already did them.**
>
> What remains below is **only what a machine cannot do**: real-device rendering,
> the flame colour + calendar heatmap visuals, that the right next-card *renders +
> its button routes*, realtime refresh on a live screen, scroll smoothness, and
> cold-start feel. **Each test now lists the agent-confirmed expected value** — so
> your job is simply *"do the pixels match this number, and does tapping go to the
> right place?"* If a screen shows a value that differs from the confirmed one, that
> is a **client render bug** (the data is proven correct), so report it.
>
> **How to report:** after each numbered test, reply `OK`, `OK — note: <x>`, or
> `FAIL — <what you saw>` (+ a screenshot if visual). Compact checklist in **§K**.
>
> **SQL during the session:** for the few tests that need a DB "stage" (§B3–B7,
> §C4) or a live DB poke (§H1, §H2), **just tell me when you reach that step and I'll
> run the SQL for you** and tell you exactly when to pull-to-refresh. The SQL is kept
> inline below for reference.

---

## §0 — Setup before your pass (in order)

### 0.1 — Re-seed (do this right before you start — there's a clock)

The seed plants a class that **starts ~20 minutes from when it runs**. That class is
what makes A1's default Next card say *"Starts in N minutes"* (§A2/§B2). So seed
**right before** §A, not earlier.

- **Easiest:** tell me **"ready to seed"** and I'll run `pnpm seed:dashboard-manual-test --reset`
  and paste you the four fresh logins (Teacher / A1 / A2 / A3).
- **Or yourself:** run `pnpm seed:dashboard-manual-test --reset` at the repo root and
  copy the `== Summary ==` logins.

> If you spend more than ~15 min before §A/§B, that "starts in 20 min" class will
> already have begun and the Next card moves to a different priority — not a bug, just
> **re-seed** to reset the clock.
>
> _[agent-confirmed: seed builds 1 course `P8_TEST_<n>` → Physics → Mechanics →
> Kinematics + Laws of Motion; 1 batch `P8_A_<n>` with 3 students + 1 teacher; full
> data composition verified — see §J. All four accounts have
> `must_change_password=false` so you log straight in.]_

### 0.2 — Metro clean restart (NON-NEGOTIABLE)

Phase 8 **rebuilt 6 screens and added a new modal type + new routes/components**.
Hot-reload **cannot** propagate this — a stale bundle renders the OLD Phase-4/7 home.
Every test session:

```
1. Ctrl+C in the Metro terminal (stop any running dev server).
2. Force-quit Expo Go:
      iOS: swipe up, flick the Expo Go card away.
      Android: recents button, swipe Expo Go away.
3. pnpm dev:mobile -- --clear        ← the wrapper, WITH --clear.
4. Open Expo Go from its HOME-SCREEN icon (not from recents).
5. Scan the QR.
6. The Metro log MUST print "(NNNN modules)" with N in the thousands.
   If it says "(1 module)" the cache did NOT clear — go back to step 1.
```

**Report:** `0.2 ok — bundled NNNN modules`.

### 0.3 — What's NEW vs Phase 7 (mental map of what to look for)

- **Student Home (`index.tsx`) — completely rebuilt.** No longer the old "schedule
  rail + attendance card + exams list". Now top→bottom: **greeting + flame pill →
  blue Next card → 3 stat pills → Today's schedule → Weak topics → Continue watching
  → Recent badges.**
- **Streak flame** (top-right of greeting) — replaces the old grey "0-day streak"
  placeholder. Now a **tappable coloured flame pill**.
- **Student Classes tab** — was a hardcoded demo (Rivers / H.C. Verma fakes). Now a
  **real feed**: Live now / Upcoming / Exams / Recent.
- **Profile** — new **"Profile | Mastery" segmented toggle** at the top.
- **Streak modal** — tapping the flame opens a new **30-day calendar heatmap**.
- **Teacher Home (`index.tsx`)** — was just a batch list. Now: **Next card → Pending
  → Today's classes → Quick actions → My batches.**
- **Teacher batch screen (`batch/[id].tsx`)** — was a flat roster. Now a **3-tab
  analytics screen: Risk / Mastery / Attendance.**

> _Backend deploy (old §0.4) — ✅ agent-verified: 2 edge fns ACTIVE + 2 crons + 6 DB
> fns. See §J._

---

## §A — Student Home renders (sign in as **A1 "Streak Star"**)

Sign in with A1. You land on **Home**. Verify each block top to bottom.
_All A1 numbers below are agent-confirmed in the DB (§J)._

### A1. Header + greeting + streak flame
```
1. Top row: blue circle with white initials (e.g. "PS"), FyneStudy logo centre,
   bell icon right.
2. Greeting (large blue): "Good morning/afternoon/evening, P8."
3. Top-right of greeting: a WHITE rounded pill with a FLAME + "7" + "days".
4. The flame is ORANGE (7-day tier), NOT grey, NOT red.
```
_[agent-confirmed: A1 streak current=7, best=7.]_
**Report:** `A1 ok — greeting + orange 7-day flame`.

### A2. Next card (the single blue card)
```
1. Blue rounded card. Small uppercase label "UP NEXT".
2. Title: "Physics".
3. Subtitle: "Starts in N minutes." (1–30 is fine).
4. White button "View Schedule".
5. Tap "View Schedule" → switches to the CLASSES tab. Tap Home to come back.
```
_[agent-confirmed: A1's default next-card = priority 3 (upcoming session ≤30 min);
exactly 1 scheduled session is within the 30-min window.]_
> If the subtitle says "Mark Attendance"/"Browse Library" etc., the 20-min window
> passed — re-seed and retry.

**Report:** `A2 ok — Up next = Physics, "Starts in N minutes", View Schedule → Classes`.

### A3. Stats strip (three white pills)
```
1. Row of 3 equal white pills, each = big number on top + small label below.
2. Left: "89%" / "Attendance"   Middle: "64%" / "Mastery"   Right: "—" / "Rank"
3. Tap Attendance pill → opens Attendance tab. Come back.
4. Tap Mastery pill → opens PROFILE on the MASTERY tab (verify in §D). Come back.
5. Tap Rank pill → nothing happens (Phase-10 placeholder); value stays "—".
```
_[agent-confirmed: attendance_pct=89, mastery_pct=64 (avg of 27.78 & 100), rank=null.]_
**Report:** `A3 ok — 89% / 64% / —, attendance + mastery pills route`.

### A4. Today's schedule
```
1. Header "Today's schedule".
2. TWO rows:
      Row 1 (earlier): a time on the left, "Physics", GREEN "Present" badge right.
      Row 2 (later):   a later time, "Physics", GREY "Upcoming" badge.
3. Times are IST, 24-hour.
4. Tap either row → opens Attendance tab. Come back.
```
_[agent-confirmed: 2 sessions today; A1 present for the earlier, no attendance on the later.]_
**Report:** `A4 ok — 2 rows, Present (green) + Upcoming (grey)`.

### A5. Weak topics
```
1. Header "Weak topics".
2. ONE card: AMBER circle "28%" left, "Kinematics" bold, "Practice this topic" in
   blue underneath, chevron ">" right.
3. Laws of Motion (100%) must NOT appear here.
4. Tap the Kinematics card → opens the "Kinematics Practice" quiz intro. Close/back
   WITHOUT submitting.
```
_[agent-confirmed: Kinematics mastery=27.78 (<50, ≥2 attempts → weak); Laws=100 (not weak).]_
**Report:** `A5 ok — Kinematics 28% card, Practice routes to quiz`.

### A6. Continue watching
```
1. Header "Continue watching".
2. A horizontally-scrollable card: blue play icon, "Kinematics — Crash Course",
   a thin progress bar ~45%, and "45% watched".
3. (Tapping opens the video player; the seeded YT id is a placeholder so it may say
   "video unavailable" — fine, this test is only the CARD. Back out.)
```
_[agent-confirmed: A1 has 1 in-progress video at watched_pct=45.]_
**Report:** `A6 ok — Continue card at 45%`.

### A7. Recent badges
```
1. Header "Recent badges".
2. A single card: purple award icon, "Earn your first badge soon!" + a one-line
   subtitle. (Badges are Phase 10 — this placeholder is correct.)
```
**Report:** `A7 ok — badges placeholder`.

### A8. Classes tab — real feed
```
1. Tap the CLASSES tab.
2. Title "My Classes" + subtitle "Your sessions and graded exams."
3. Sections (those with data only):
      "Upcoming" → the seeded upcoming Physics class row (time/date + chevron).
      "Exams"    → "Mechanics Unit Test <n>" row, a date, "60 min", status line
                   "Submitted · awaiting release". Blue clipboard icon + chevron.
      "Recent"   → the earlier class that finished today, GREEN "Present" badge.
   ("Live now" appears only if a class is live — none by default.)
4. Tap the exam row → opens the exam screen (submitted / awaiting-release state). Back.
```
_[agent-confirmed: exam is published, manual-release, NOT yet released, with A1's
attempt submitted → "awaiting release".]_
**Report:** `A8 ok — Upcoming + Exams (awaiting release) + Recent`.

### A9. Pull-to-refresh + cold skeleton
```
1. Back on Home, pull DOWN to refresh. Spinner shows briefly, SAME data re-renders,
   no flicker / no layout jump.
2. (Optional cold check) Force-quit Expo Go, re-open, sign in: for a moment you see
   grey SKELETON blocks (big card + 3 small pills) before real data paints. No white
   flash, no crash.
```
**Report:** `A9 ok — refresh clean, skeleton on cold load`.

---

## §B — Next card RENDERS + ROUTES for each priority

> _[agent-confirmed: the server-side `next_card` cascade is **correct by
> construction** — its SQL coalesces P1→P7 in exactly the documented order (live class
> → live exam → session ≤30 min → pending attendance → unwatched recording →
> weak-topic quiz → browse fallback), and the default-seed state correctly resolves to
> priority 3. So the **picking logic is proven**; what's left is purely that each card
> variant **renders as described and its CTA button routes**.]_

Priority order (1 = highest):
```
1 live class   2 live exam   3 session ≤30 min   4 pending attendance
5 unwatched recording        6 weak-topic quiz   7 browse (fallback)
```

For the staged ones (B3–B7): **tell me when you're on that step and I'll run the SQL
stage**, then you pull-to-refresh Home and check the card. **Re-seed before each staged
test.** The SQL is shown for reference.

### B1. Priority 7 — fallback "Browse Library" (student **A3**)
```
1. Sign in as A3. (A3 is in the batch, so while the upcoming class is still in the
   future A3's card is priority 3 "Starts in N min". To see the TRUE fallback, either
   use a seed whose class window has passed, or do the B6 "cancel sessions" stage first.)
   With NO upcoming class + no other signal → card: title "Keep learning", subtitle
   about the library, button "Browse Library".
2. Tap "Browse Library" → opens the Library tab.
```
**Report:** `B1 ok — fallback card → Library` (note if you cancelled sessions first).

### B2. Priority 3 — "Starts in N minutes" (student **A1**) — covered in §A2
**Report:** `B2 ok — (covered in A2)`.

### B3. Priority 4 — "Mark Attendance" (student **A1**)
Stage (makes the upcoming class be happening now, A1 unmarked):
```sql
update sessions
set scheduled_start = now() - interval '5 minutes',
    scheduled_end   = now() + interval '55 minutes'
where id = (
  select s.id from sessions s
  where s.batch_id = (select st.batch_id from students st join app_users au on au.id=st.user_id
                      where au.email like 'p8-stu-a1-%' order by au.created_at desc limit 1)
    and s.scheduled_start > now() limit 1);
```
```
1. As A1, pull-to-refresh Home.
2. Next card: title "Physics", subtitle "Mark your attendance now.", button
   "Mark Attendance".
3. Tap "Mark Attendance" → opens the Attendance tab.
```
**Report:** `B3 ok — card flipped to Mark Attendance`. (Then re-seed.)

### B4. Priority 2 — "Start Exam" (student **A3**)
Stage (makes the seeded exam live for the batch; A3 hasn't submitted):
```sql
update exams
set starts_at = now() - interval '5 minutes', duration_min = 60
where title like 'Mechanics Unit Test%'
  and batch_id = (select st.batch_id from students st join app_users au on au.id=st.user_id
                  where au.email like 'p8-stu-a3-%' order by au.created_at desc limit 1);
```
```
1. Sign in as A3, pull-to-refresh Home.
2. Next card: clipboard icon, title "Mechanics Unit Test <n>", subtitle "Window
   closes in …", button "Start Exam".
3. Tap "Start Exam" → opens the exam intro screen.
```
**Report:** `B4 ok — card = Start Exam`. (Then re-seed.)

### B5. Priority 1 — "Join Live Now" (student **A1**)
Stage (makes the upcoming class a live class):
```sql
update sessions
set status = 'live', is_live_class = true,
    scheduled_start = now() - interval '2 minutes',
    scheduled_end   = now() + interval '58 minutes'
where id = (
  select s.id from sessions s
  where s.batch_id = (select st.batch_id from students st join app_users au on au.id=st.user_id
                      where au.email like 'p8-stu-a1-%' order by au.created_at desc limit 1)
    and s.scheduled_start > now() limit 1);
```
```
1. As A1, pull-to-refresh Home.
2. Next card: radio/broadcast icon, title "Physics", subtitle "Your class is live
   right now.", button "Join Live Now".
3. Tap "Join Live Now" → routes to the CLASSES tab.
   (The real live player ships in Phase 9 — this CTA intentionally lands on Classes;
   NOT a bug.)
```
**Report:** `B5 ok — card = Join Live Now → Classes`. (Then re-seed.)

### B6. Priority 6 — "Practice Kinematics" (student **A1**)
Stage (cancel recent/upcoming sessions; the seeded exam has ended; A1's only video is
already watched — leaving the weak topic as top signal):
```sql
update sessions set status = 'cancelled'
where batch_id = (select st.batch_id from students st join app_users au on au.id=st.user_id
                  where au.email like 'p8-stu-a1-%' order by au.created_at desc limit 1)
  and scheduled_end >= now() - interval '2 hours';
```
```
1. As A1, pull-to-refresh Home.
2. Next card: target icon, title "Kinematics", subtitle about practice, button
   "Practice Kinematics".
3. Tap it → opens the Kinematics Practice quiz intro.
```
**Report:** `B6 ok — card = Practice Kinematics`. (Stay on this seed for B7.)

### B7. Priority 5 — "Watch Replay" (student **A1**, continues from B6)
Stage (with sessions cancelled, add a brand-new UNWATCHED video — outranks the weak
topic, P5 beats P6):
```sql
insert into content_items (kind, title, topic_id, course_id, batch_id, yt_video_id, uploaded_by, is_published)
select 'video', 'NEW Lesson — Projectiles',
       (select id from topics where name='Kinematics'
        and chapter_id in (select c.id from chapters c join subjects s on s.id=c.subject_id
                           join courses co on co.id=s.course_id where co.code like 'P8_TEST_%') limit 1),
       co.id, st.batch_id, 'p8new'||floor(random()*90000+10000)::text,
       (select bt.teacher_id from batch_teachers bt where bt.batch_id = st.batch_id limit 1), true
from students st join app_users au on au.id=st.user_id
join batches b on b.id = st.batch_id join courses co on co.id = b.course_id
where au.email like 'p8-stu-a1-%' order by au.created_at desc limit 1;
```
```
1. As A1, pull-to-refresh Home.
2. Next card: play icon, title "NEW Lesson — Projectiles", subtitle about catching up,
   button "Watch Replay".
3. Tap it → opens the video player (placeholder id, may say unavailable; the card +
   routing is what matters).
```
**Report:** `B7 ok — card = Watch Replay`. (Then re-seed to finish §B.)

---

## §C — Streak modal + flame tiers (student **A1**)

### C1. Open the modal
```
1. On A1's Home, tap the ORANGE FLAME PILL (top-right of the greeting).
2. A screen slides up titled "Your streak" with a big flame, a large "7",
   "day streak", and "Best streak: 7 days".
```
_[agent-confirmed: current=7, best=7.]_
**Report:** `C1 ok — modal opens, 7 / best 7`.

### C2. The 30-day calendar heatmap
```
1. Below the number: a grid of exactly 30 small rounded squares (oldest → newest,
   left→right, wrapping).
2. The LAST 7 squares (most recent, ending bottom-right) are GREEN with a small white
   day-number; all earlier squares are GREY.
3. The VERY LAST square (today) has a BLUE OUTLINE.
4. Legend: green = "Active", grey = "No activity".
5. A "How streaks work" box explains the rule (one action a day, IST, miss → reset).
6. Tap the X (top-right) → returns to Home.
```
_[agent-confirmed: A1 `activity_days` = exactly 7 dates, 2026-05-16 → 2026-05-22
(today + 6 prior, contiguous). The 7 green squares must be the 7 most recent, today
outlined. (Old §C3 SQL cross-check already done by agent.)]_
**Report:** `C2 ok — 7 green squares, today outlined`.

### C4. Flame tier colours (optional — needs a stage)
Tell me to bump A1's streak and I'll run:
```sql
-- 30-day streak → RED flame
update streaks set current_days = 30, best_days = 30
where student_id = (select id from app_users where email like 'p8-stu-a1-%' order by created_at desc limit 1);
-- (or current_days = 95 for the GOLDEN flame)
```
```
1. As A1, pull-to-refresh Home. Flame pill reads "30 days", flame is RED (30–89 tier).
   With 95 it is GOLDEN/yellow (90+ tier).
2. A3 (no streak) shows a GREY flame "0 days".
```
**Report:** `C4 ok — red at 30, gold at 95, grey at 0` (or `skipped`). Then re-seed.

> _Old §C3 (SQL cross-check of green squares vs `activity_days`) — ✅ done by agent (§J)._

---

## §D — Mastery tab (Profile)

### D1. Open the Mastery tab
```
1. As A1, tap the PROFILE tab. (Or from Home, tap the "Mastery" stat pill — deep-links here.)
2. Below the avatar card, a segmented toggle: "Profile" | "Mastery".
3. Tap "Mastery".
```
**Report:** `D1 ok — Mastery segment present`.

### D2. Per-topic breakdown
```
1. Header "Topic mastery" + a note about "rolling average of your last 5 attempts".
2. TWO rows, WEAKEST FIRST:
      "Kinematics"     — red/amber bar at ~28% (number on the right),
                         caption "Avg of last 3 attempts · practiced <date>".
      "Laws of Motion" — green bar at 100%,
                         caption "Avg of last 2 attempts · practiced <date>".
3. Tap "Profile" segment → read-only Account / Academic / Actions sections come back,
   Sign out at the bottom.
```
_[agent-confirmed: Kinematics 27.78 (3 attempts) → "28%"; Laws 100.00 (2 attempts);
weakest-first ordering. (Old §D3 SQL cross-check already done by agent.)]_
**Report:** `D2 ok — Kinematics 28% then Laws 100%, weakest first`.

### D4. Empty mastery (student **A3**)
```
1. Sign in as A3. Profile → Mastery tab.
2. Empty state: a sparkle icon + "No mastery data yet" + a one-line hint to finish a
   quiz or exam. No crash, no error.
```
_[agent-confirmed: A3 has 0 mastery rows.]_
**Report:** `D4 ok — A3 empty mastery state`.

> _Old §D3 (SQL cross-check Kinematics 27.78 / Laws 100) — ✅ done by agent (§J)._

---

## §E — Empty student renders clean zeros (student **A3**)

```
1. Sign in as A3 "Fresh Start". Home tab.
2. NO red error anywhere. Greeting "Good …, P8." + a GREY flame pill "0 days".
3. Next card = "Keep learning" / "Browse Library" (if the upcoming class window has
   passed) OR the batch's upcoming Physics class (priority 3) if it hasn't.
4. Stats: "0%" Attendance / "0%" Mastery / "—" Rank.
5. Today's schedule: the batch's two classes — the earlier shows "Missed" (no
   attendance for A3), the later "Upcoming".
6. Weak topics: a card "You're on top of every topic." with "Try a harder quiz?".
7. Continue watching: the WHOLE section is ABSENT (A3 has no in-progress video).
8. Recent badges: the "Earn your first badge soon!" placeholder is present.
```
_[agent-confirmed: A3 attendance=0, mastery=0, streak=0, activity_days=0, weak_count=0,
continue_videos=0 (→ section hidden); today = 2 sessions both unattended (missed +
upcoming).]_
**Report:** `E1 ok — A3 zeros, no crash, Continue section hidden`.

---

## §F — Teacher Home (sign in as the **Teacher**)

### F1. Header + Next card
```
1. Header: "Welcome back" / "Hi, P8" / today's date (e.g. "Thursday, 22 May").
2. Blue Next card: label "NEXT", "Physics · P8_A_<n>", a line with the start time +
   "in N min" (or "Live now" if you staged a live class), white "Take Attendance" button.
3. Tap "Take Attendance" → opens the Scan tab. Come back.
```
> If there's no upcoming/live class today, the Next card is simply absent — fine.

**Report:** `F1 ok — header + Next card → Scan`.

### F2. Pending
```
1. Section "Pending".
2. ONE row: amber megaphone icon, "Release results: Mechanics Unit Test <n>", subtitle
   "P8_A_<n> · 1 submitted".
3. Tap the row → opens the exam-results screen for that exam.
   (If you instead see "You're all caught up — nothing pending." the exam was already
   released — re-seed.)
```
_[agent-confirmed: exam is published + manual-release + unreleased with exactly 1
submitted attempt (A1) → it IS pending.]_
**Report:** `F2 ok — pending exam release row`.

### F3. Today's classes + Quick actions
```
1. Section "Today's classes": the batch's class(es) for today, each with time + subject + batch.
2. Section "Quick actions": three tiles —
      "Scan QR"  → Scan tab
      "New exam" → Exams tab
      "Upload"   → Library tab
   Tap each, confirm it navigates, come back each time.
```
_[agent-confirmed: 2 sessions today for this batch.]_
**Report:** `F3 ok — today list + 3 quick actions route`.

### F4. My batches
```
1. Section "My batches": a card "P8_TEST_<n>" (course code) / "P8_A_<n>" / course name,
   with "3 students" and a schedule line.
2. Tap the batch card → opens the batch analytics screen (§G).
```
_[agent-confirmed: batch has 3 students.]_
**Report:** `F4 ok — batch card → analytics`.

---

## §G — Teacher batch analytics (tap the **P8_A** batch)

### G1. Header + tabs
```
1. Top: a back chevron + "Batch analytics".
2. Header card: "P8_TEST_<n>" (blue), "P8_A_<n>" (bold), course name, a graduation-cap
   row "Roster — 3 students".
3. A segmented control with THREE tabs: "Risk (1)" | "Mastery" | "Attendance".
   "Risk" is selected by default and shows the count "(1)".
```
_[agent-confirmed: at-risk count = 1.]_
**Report:** `G1 ok — header + 3 tabs, Risk(1) default`.

### G2. Risk tab
```
1. ONE row: a red-initials circle, "P8 At Risk <n>", subtitle "Mastery 8% · Attendance 33%".
2. Two greyed chips: "Send report" + "Note". Tap one → an alert "arrives in Phase 11"
   (disabled placeholders — correct for Phase 8).
3. A1 (good) and A3 (no data) must NOT appear here.
```
_[agent-confirmed: only A2 qualifies (mastery 8 <40 AND attendance 33 <60). A1
(64/89) and A3 (no data → coalesces to 100/100) are correctly excluded.]_
**Report:** `G2 ok — only A2 at-risk, chips show Phase-11 alert`.

### G3. Mastery tab
```
1. Tap "Mastery". A note "Class average per topic, weakest first."
2. TWO bars, WEAKEST FIRST:
      "Kinematics"     — red bar ~18%, caption "2 students with data".
      "Laws of Motion" — green bar 100%, caption "1 student with data".
```
_[agent-confirmed: Kinematics class avg = round((27.78+8.33)/2) = 18 (n=2);
Laws = 100 (n=1); ascending order.]_
**Report:** `G3 ok — Kinematics 18% then Laws 100%`.

### G4. Attendance tab (heatmap)
```
1. Tap "Attendance". A note about present/late share per class day.
2. A HORIZONTAL strip of coloured squares, each showing a "%" and a small date label
   (e.g. "15/5"). Colours: green ≥80, amber 60–79, red <60.
3. A legend row: green "≥80%", amber "60–79%", red "<60%".
4. SWIPE the strip sideways — it scrolls SMOOTHLY, no lag/jank.
```
_[agent-confirmed: 9 distinct class-days have attendance in the last 30 days → expect
~9 squares.]_
**Report:** `G4 ok — heatmap squares + legend, smooth scroll`.

### G5. Tab switching
```
1. Tap Risk → Mastery → Attendance → Risk a few times quickly.
2. Content swaps instantly, no flicker, no crash, header card stays put.
3. Pull-to-refresh on the screen reloads without error.
```
**Report:** `G5 ok — tab switching smooth`.

---

## §H — Realtime + the live feeder + devices

### H1. Realtime attendance invalidation (device + I run the SQL)
```
1. Keep A1's HOME open on the device (don't touch it).
2. Tell me "ready for H1" — I'll insert an attendance row for one of A1's sessions:
```
```sql
insert into attendance (session_id, student_id, status, method)
select s.id,
       (select id from app_users where email like 'p8-stu-a1-%' order by created_at desc limit 1),
       'present','manual'
from sessions s
where s.batch_id = (select st.batch_id from students st join app_users au on au.id=st.user_id
                    where au.email like 'p8-stu-a1-%' order by au.created_at desc limit 1)
  and not exists (
    select 1 from attendance a
    where a.session_id = s.id
      and a.student_id = (select id from app_users where email like 'p8-stu-a1-%' order by created_at desc limit 1))
limit 1;
```
```
3. Within ~1–2 s, WITHOUT touching the phone, A1's Home should refresh (a schedule
   badge flips to Present and/or the Attendance % ticks up). If it only updates after a
   manual pull-to-refresh, note that.
```
_[agent-confirmed: `attendance` IS in the `supabase_realtime` publication, so the
push channel exists. This test confirms the CLIENT subscribes + invalidates.]_
**Report:** `H1 ok — Home auto-refreshed on attendance insert` (or `only on pull-to-refresh`).

### H2. The live mastery feeder (real quiz submit — the key end-to-end)
This proves the redeployed `quiz-submit` recomputes mastery on submit.
```
1. Tell me "ready for H2" — I'll read A1's current Kinematics mastery (it's 27.78 / 3 now).
2. On the phone (A1): Home → Weak topics → "Practice this topic" (or Library →
   Kinematics). Start the quiz, answer the questions (any answers), and SUBMIT.
3. I'll re-read the mastery within a few seconds: attempt_count should INCREASE by 1
   and mastery_pct should change to reflect the new attempt.
```
_[agent-confirmed: `quiz-submit/index.ts` calls `mastery_recompute` + upserts
`activity_days` right after a submit (the feeder is wired); `smoke:dashboard-fns`
proves recompute writes the row. This test confirms it end-to-end from the device.]_
**Report:** `H2 ok — mastery row updated within ~2s of submitting a quiz`.

### H4. Cold-start budget — Redmi 8A class (hardware)
```
On a low-end Android (Redmi 8A, Android 9, 2 GB RAM): cold-launch (force-quit first),
sign in as A1. Icon tap → Home FULLY PAINTED should be < 3 s. Record the number.
```
**Report:** `H4: cold start Ns` or `skipped — no Redmi 8A`.

### H5. iOS / Android parity (if you have both)
```
Repeat §A (Home render) + §C2 (calendar) + §G4 (heatmap) on the other platform. Look
for layout differences, clipped text, or mis-coloured squares.
```
**Report:** `H5 ok — parity` or the differences seen.

> _Old §H3 (cron jobs exist) — ✅ done by agent (§J)._

---

## §J — Agent-verified on 2026-05-22 (DON'T re-test)

Everything here was re-run against the dev project (`orqwyazvcthgxoadfxfv`) on
2026-05-22 and is **green**. The numbers feed the "agent-confirmed" annotations above.

### Automated suites
| Suite | Result |
|---|---|
| `pnpm test:dashboard` | **16/16** (mastery rolling-N + clamp; IST streak gaps/boundaries) |
| `pnpm smoke:dashboard-rls` | **9/9** (mastery/streak self vs teacher-batch scoping; dashboard own-or-admin guard) |
| `pnpm smoke:dashboard-fns` | **11/11** (3 dashboard RPCs over HTTP; recompute admin-gates 403/400; recompute→mastery 50%) |

### Backend deploy (old §0.4)
- Edge fns **ACTIVE**: `mastery-recompute` (jwt=true), `streak-recompute` (jwt=true).
- Cron: `mastery-sweep` `0 21 * * *` active, `streak-recompute` `30 20 * * *` active.
- 6 DB fns present: `mastery_recompute`, `streak_recompute`, `student_dashboard`,
  `teacher_dashboard`, `teacher_batch_overview`, `video_progress_activity`.

### Seeded data composition (the source of truth for every annotation)
| | Attendance | Mastery (avg) | Weak topics | Streak cur/best | activity_days | Continue video |
|---|---|---|---|---|---|---|
| **A1** | 89% | 64% | 1 (Kinematics) | 7 / 7 | 7 (05-16→05-22) | 1 @ 45% |
| **A2** | 33% | 8% | 1 | 1 / 1 | 2 | 0 |
| **A3** | 0% | 0% | 0 | 0 / 0 | 0 | 0 (section hidden) |

- Per-topic mastery: A1 Kinematics **27.78** (3 attempts) + Laws **100.00** (2); A2
  Kinematics **8.33** (2). (Doc's "28%"/"8%" are the rounded renders — correct. The
  seed's code-comment "~25%"/"~4%" are loose and were ignored.)
- A1 today = 2 sessions (present @ earlier, none @ later); A3 today = 2 sessions, both
  unattended (missed + upcoming).
- A1 offline score = **68/100**. A1 exam = "Mechanics Unit Test" published, manual
  release, **not released**, A1 attempt **submitted** → "awaiting release".
- A1 default next-card = **priority 3** (exactly 1 scheduled session within 30 min).

### Teacher batch overview (`teacher_batch_overview`)
- `topic_mastery`: Kinematics **18** (n=2), Laws **100** (n=1), ascending.
- `at_risk` = **only A2** (`mastery<40 OR attendance<60`, with `coalesce(...,100)` so
  no-data students like A3 are excluded — A1 and A3 correctly absent).
- `attendance` heatmap: **9** distinct class-days in the last 30 days.

### Next-card cascade logic
- The `student_dashboard.next_card` SQL coalesces **P1→P7 in exactly the documented
  order**; first non-null wins. Default seed resolves to P3. (Logic proven; §B only
  checks render + route.)

### SQL sanity (old §I)
- RLS **on** for `mastery` + `streaks`; **3 policies each**.
- `streak_rows = student_rows` (162 = 162).
- `mastery_recompute(p_full := true)` run twice → **6 → 6**, no drift (idempotent).
- `attendance` ∈ `supabase_realtime` publication (also `chat_messages`,
  `raise_hand_events`, `chat_bans` for Phase 9).

### Cross-checks already done (old §C3 / §D3 / §H3)
- §C3 — A1 `activity_days` = 7 contiguous dates 2026-05-16 → 2026-05-22 (today last). ✓
- §D3 — mastery Kinematics 27.78 (3) / Laws 100 (2). ✓
- §H3 — both crons present with the expected schedules. ✓

### Feeder code
- `apps/functions/quiz-submit/index.ts` calls `mastery_recompute` + upserts
  `activity_days` after a submit (the §H2 engine). ✓

### Advisor sweep
- **Security: 0 ERRORs.** WARNs = 3× `authenticated_security_definer_function_executable`
  on the dashboard RPCs (**accepted, D-186**) + `auth_leaked_password_protection`
  (Phase-1 backlog).
- **Performance: 0 ERRORs.** All 81 lints are project-wide accepted (59
  `multiple_permissive_policies`, 18 `unindexed_foreign_keys` INFO, 3 `unused_index`
  INFO, 1 `auth_rls_initplan` WARN). Nothing new from Phase 8.

---

## §K — Report-back format (visual / device only)

One line per test. `OK`, `OK — note: <x>`, or `FAIL — <what you saw>`.

```
0.2 ok — NNNN modules

A1 ok — orange 7-day flame
A2 ok — Up next Physics → Classes
A3 ok — 89/64/—, pills route
A4 ok — Present + Upcoming
A5 ok — Kinematics 28% → quiz
A6 ok — Continue 45%
A7 ok — badges placeholder
A8 ok — classes feed (Upcoming/Exams/Recent)
A9 ok — refresh + skeleton

B1 ok — fallback → Library
B2 ok — (covered in A2)
B3 ok — Mark Attendance
B4 ok — Start Exam
B5 ok — Join Live Now → Classes
B6 ok — Practice Kinematics
B7 ok — Watch Replay

C1 ok — modal 7 / best 7
C2 ok — 7 green + today outline
C4 ok — tiers (or skipped)

D1 ok — Mastery segment
D2 ok — Kinematics 28% then Laws 100%
D4 ok — A3 empty state

E1 ok — A3 zeros, Continue hidden

F1 ok — header + Next → Scan
F2 ok — pending exam release
F3 ok — today + quick actions
F4 ok — batch card → analytics

G1 ok — 3 tabs, Risk(1)
G2 ok — A2 at-risk only
G3 ok — Kinematics 18% then Laws 100%
G4 ok — heatmap + smooth scroll
G5 ok — tab switching

H1 ok — realtime refresh (or only on pull)
H2 ok — mastery updated on quiz submit
H4: cold start Ns (or skipped)
H5 ok — parity (or skipped)
```

Anything that **FAILS** — paste the test number + what you saw + a screenshot if
visual + (for realtime) tell me and I'll pull the Supabase log line. Since the data
layer is proven (§J), a value mismatch on screen is a client render bug — I'll diagnose
and patch before the **ACCEPTED** line in `phase-8.md §15`.

## Sign-off

When §A–§H all look right on a real device, fill in the **ACCEPTED** line in
`docs/phases/phase-8.md §15` with the date and flip the Phase 8 status in `CLAUDE.md`
from 🟡 to ✅.
