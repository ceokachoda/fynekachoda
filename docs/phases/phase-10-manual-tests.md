# Phase 10 — Manual test plan (VISUAL / ON-DEVICE ONLY)

> **Status: ✅ ACCEPTED — 2026-05-27.** On-device visual QA signed off; post-QA fixes applied + verified (see `phase-10.md §15.11`). Phase 10 is done.
>
> Everything a machine can check is already green — see **§J** (composite math, the rank
> tie-breaker, all 11 badge evaluators, cross-batch RLS, rollover top-1/2-3 + snapshot +
> idempotency, icon signing, the full mobile gate). **Don't re-test those.** This plan is
> ONLY the things a human eye must confirm on a real device: the leaderboard render, the
> badge celebration + collection, streak-flame colours, the dashboard rank pill, and the
> teacher at-risk view.
>
> Report back with the **§K** checklist.

---

## §0 — Setup

### 0.1 — Re-seed
The seed plants ONE batch + 6 students engineered to exercise every signal. It is NOT
time-sensitive (streaks are IST-date based and valid all day), so you can seed any time
before the session.

- **Easiest:** tell me **"ready to seed leaderboard"** and I'll run
  `pnpm seed:leaderboard-manual-test --reset` and paste the fresh logins.
- **Or yourself:** run `pnpm seed:leaderboard-manual-test --reset` at the repo root and
  copy the `== Summary ==` block (Teacher + 6 students + a one-line "what correct looks like").

> _[agent-confirmed: seed builds course `P10_TEST_<n>` → Physics → Mechanics → Kinematics /
> Laws of Motion / Energy; batch `P10_A_<n>` with 1 teacher + 6 students. Final board:
> **Topper 0.85 (#1) · Runner Up A 0.62 (#2) · Runner Up B 0.46 (#3) · Streak Star 0.28 (#4)
> · At Risk 0.12 (#5) · Centurion 0.00 (#6)**. All accounts have `must_change_password=false`
> so you log straight in.]_

### 0.2 — Metro clean restart (NON-NEGOTIABLE)
Phase 10 **added a new tab + route (`leaderboard`), new components/hooks, and a new
modal/celebration host**. Hot-reload **cannot** propagate a new route/tab — a stale bundle
renders the OLD 6-tab home with no Ranks tab. Every session:

```
1. Ctrl+C in the Metro terminal (stop any running dev server).
2. Force-quit Expo Go:
      iOS: swipe up, flick the Expo Go card away.
      Android: recents button, swipe Expo Go away.
3. pnpm dev:mobile -- --clear        ← the wrapper, WITH --clear.
4. Open Expo Go from its HOME-SCREEN icon (not from recents). Scan the QR.
5. The Metro log MUST print "(NNNN modules)" with N in the thousands.
   If it says "(1 module)" the cache did NOT clear — go back to step 1.
```
**Report:** `0.2 ok — bundled NNNN modules`.

### 0.3 — What's NEW in Phase 10
A 7th student tab **"Ranks"** (Trophy icon); a leaderboard screen; a **Badges** tab in
Profile; a full-screen **badge celebration** that pops on app focus when you have an unseen
badge; the dashboard **Rank** pill is now live (was "—") and the **Recent badges** strip shows
real badges; the teacher **Risk** tab now ranks by the real composite score.

---

## §A — Leaderboard screen (sign in as **Topper**)

### A1. Open + header + tabs
```
1. Bottom tab bar now has a "Ranks" tab (trophy icon). Tap it.
2. Header: trophy + "Leaderboard"; subtitle shows the batch name (e.g. "P10_A_<n>").
3. A segmented control reads "Weekly" (selected, white) | "All-Time".
```
**Report:** `A1 ok — Ranks tab opens, Weekly selected`.

### A2. "Your rank" hero + the list
```
1. Blue hero card: "YOUR RANK"  →  "#1 / 6"  on the left, "0.85 composite" on the right.
2. Below, a list of 6 rows. Row 1 has a 🥇, row 2 🥈, row 3 🥉, rows 4–6 show "#4/#5/#6".
3. The #1 row is highlighted (light-blue) and reads "You" instead of the name.
4. Each OTHER row shows the student's name, "••NN" (last 2 phone digits, may be blank if
   the seed account has no phone), and a composite to 2 decimals.
5. Order top→bottom: You 0.85, Runner Up A 0.62, Runner Up B 0.46, Streak Star 0.28,
   At Risk 0.12, Centurion 0.00.
```
_[agent-confirmed: ranks + composites exactly as above; tie-breaker = composite → q_norm →
quiz count → name.]_
**Report:** `A2 ok — #1/6 hero 0.85, list ordered + medals`.

### A3. Tap a row → public card
```
1. Tap the "Runner Up A" row.
2. A centred card pops: initials avatar, full name, batch name, a flame + streak number
   ("5 day streak"), and a "Badges (2)" section with chips "First Step" + "So Close".
3. NO email / phone / DOB anywhere on the card.
4. Tap "Close" (or outside) → card dismisses.
```
_[agent-confirmed: student_public_card returns name+batch+streak+badges only; same-batch
guard verified in §J.]_
**Report:** `A3 ok — public card name/batch/streak/badges, no PII`.

### A4. "How is this calculated?"
```
1. Scroll to the bottom of the list; tap "How is this calculated?".
2. A sheet slides up titled "How rank is calculated" with three rows:
      60% Quiz & exam scores · 25% Activity · 15% Streak.
3. A footnote explains the tie-break + that only you can see your own scores.
4. Close it.
```
**Report:** `A4 ok — 60/25/15 modal`.

### A5. All-Time tab
```
1. Tap "All-Time". The list re-loads (may briefly show the hero skeleton).
2. You're still ranked; composites may differ slightly from Weekly (180-day quiz window).
```
**Report:** `A5 ok — All-Time loads`.

---

## §B — Badge collection (sign in as **Topper**, Profile → Badges)

### B1. Grid: earned vs locked
```
1. Profile tab → the segmented control now has a third option "Badges". Tap it.
2. "Badge collection" — "6 of 11 earned".
3. A 3-column grid of 11 badges. SIX are full-colour discs (First Step, Week Warrior,
   Showed Up, Early Bird, Subject Specialist, Top of the Class). FIVE are dimmed
   silhouettes with a small lock icon (Marathoner, Iron Mind, So Close, Centurion, Comeback).
```
_[agent-confirmed: Topper earns first_quiz, streak_7, perfect_week_attendance, early_bird,
mastery_80_subject, topper_of_week.]_
**Report:** `B1 ok — 6 coloured / 5 locked, "6 of 11"`.

### B2. Tap a LOCKED badge → how to earn
```
1. Tap "Marathoner" (locked).
2. A card appears below the grid: "Marathoner" + "How to earn: Reach a 30-day active streak".
```
**Report:** `B2 ok — locked badge shows how-to-earn`.

### B3. Tap an EARNED badge → earned date
```
1. Tap "Top of the Class" (coloured).
2. The card shows "Top of the Class" + a green "✓ Earned <date>".
```
**Report:** `B3 ok — earned badge shows earned date`.

---

## §C — Badge celebration (confetti)

### C1. Celebration on first focus (sign in as **Topper**)
```
1. Fully sign out, then sign in as Topper (or just open the app to the Home tab fresh).
2. Within a moment a full-screen modal pops: "BADGE UNLOCKED!", a large badge icon,
   "Top of the Class", its description, a disabled "Share" + a blue "Awesome!" button.
3. Confetti falls from the top.
4. Tap "Awesome!". The modal closes.
5. Pull-to-refresh / re-open Home — the SAME celebration does NOT pop again.
```
_[agent-confirmed: Topper has exactly one unseen badge (topper_of_week); "Awesome!" flips
is_seen=true so it won't re-fire.]_
**Report:** `C1 ok — confetti modal, Awesome! dismisses, no repeat`.

### C2. Other celebration students
```
1. Sign in as "Streak Star" → "Week Warrior" celebration pops once.
2. Sign in as "Centurion" → "Centurion" celebration pops once.
```
**Report:** `C2 ok — Streak Star=Week Warrior, Centurion=Centurion`.

---

## §D — Dashboard rank + recent badges + flame (sign in as **Topper**)

### D1. Rank pill is live
```
1. Home tab → the stats strip has three pills: Attendance, Mastery, Rank.
2. "Rank" now shows "#1" (NOT "—").
3. Tap the Rank pill → it opens the Ranks (leaderboard) screen.
```
_[agent-confirmed: student_dashboard.rank slice now returns the live batch rank.]_
**Report:** `D1 ok — Rank pill #1, taps through to leaderboard`.

### D2. Recent badges strip
```
1. Scroll to "Recent badges". Instead of the old placeholder you see up to 3 small
   coloured chips with badge names (the most recently earned).
```
**Report:** `D2 ok — recent badges chips show`.

### D3. Streak flame colour
```
1. Top-right of the greeting: a flame pill with "7" + "days".
2. The flame is ORANGE (7–29 day tier), not grey, not red.
```
_[agent-confirmed: Topper current streak = 7.]_
**Report:** `D3 ok — orange 7-day flame`.

---

## §E — Streak modal lists badges (sign in as **Streak Star**)

### E1. Streak modal
```
1. Dismiss the celebration if it pops. On Home, tap the flame pill (top-right).
2. The "Your streak" screen slides up: big flame, "7", "day streak", "Best streak: 7 days",
   a 30-day heatmap (7 recent days green).
3. A new section "Badges earned during this streak" shows the badge(s) earned recently
   (e.g. First Step + Week Warrior) as small icons with names.
```
_[agent-confirmed: Streak Star current=7; badges earned within the streak window list here.]_
**Report:** `E1 ok — streak modal + badges-during-streak section`.

---

## §F — Streak-flame colours across states

### F1. Grey ember (sign in as **At Risk**)
```
1. At Risk has no streak → the flame pill shows "0 days" and the flame is GREY.
```
**Report:** `F1 ok — grey 0-day ember`.

> (Red 30–89 and golden 90+ tiers need a 30/90-day backdated streak — agent-confirmed in the
> StreakFlame tier logic; not part of the seed. Optional: ask me to backdate one.)

---

## §G — Teacher at-risk uses real composite (sign in as **Teacher**)

### G1. Risk tab
```
1. Teacher Home → open the batch (P10_A_<n>) → "Batch analytics".
2. The "Risk" tab is selected and shows "(2)".
3. Subtitle: "Composite score below 0.40 — blends quiz/exam (60%), activity (25%) and streak (15%)."
4. Two students listed: "At Risk" and "Centurion". Each row shows a red composite pill
   (≈ 0.12 and ≈ 0.00) on the right + "Mastery X% · Attendance Y%" below the name.
5. Topper / Runner-ups / Streak Star do NOT appear (composite ≥ 0.40).
```
_[agent-confirmed: at_risk = composite < 0.4 from leaderboard_weekly; At Risk 0.12, Centurion
0.00; the three top students are above 0.4.]_
**Report:** `G1 ok — At Risk + Centurion below 0.40, composite pills`.

---

## §J — Agent-verified on 2026-05-22 (DON'T re-test)

**Automated suites**
| Suite | Result |
|---|---|
| `pnpm test:leaderboard` | **60/60** (composite 60/25/15 + clamps; aNorm/sNorm; rank tie-breaker; all 11 badge evaluators true+false) |
| `pnpm smoke:leaderboard-rls` | **14/14** (my_batch_leaderboard cross-batch isolation **AC #15**; p_batch guard student/teacher/admin; views NOT client-readable; badge_earnings own/teacher/other; snapshots teacher-only) |
| `pnpm smoke:leaderboard-fns` | **18/18** (badge-evaluate per scenario: first_quiz+quiz_100, streak_7/30/90+comeback, early_bird+perfect_week, mastery_80; admin-gating 403; bad input 400; idempotent; rollover topper#1 + runner#2/3 + snapshot + **composite-0 #3 gets nothing** + idempotent re-run + 403; my_batch_leaderboard RPC; badge-icon-sign → 11 signed badge-assets URLs) |
| Mobile gate | `pnpm typecheck && pnpm lint && pnpm test` green; jest **53/53** (+ shared 17/17) |

**Backend deploy**
- 12 migrations applied (badges → student_public_card_fn). 11 badges seeded; 11 SVGs in `badge-assets`.
- Edge fns ACTIVE: `badge-evaluate`, `leaderboard-weekly-rollover`, `badge-icon-sign` (new); `quiz-submit`/`exam-submit`/`attendance-qr-verify` redeployed with inline eval.
- pg_cron `leaderboard-weekly-rollover` = `29 18 * * 0` calling the DB fn directly.

**Seeded composition** (batch P10_A_<n>)
- Board: Topper **0.85 (#1)**, Runner Up A **0.62 (#2)**, Runner Up B **0.46 (#3)**, Streak Star **0.28 (#4)**, At Risk **0.12 (#5)**, Centurion **0.00 (#6)**.
- Badges: Topper {first_quiz, streak_7, perfect_week_attendance, topper_of_week, mastery_80_subject, early_bird}; Runner-ups {first_quiz, runner_up_week}; Streak Star {first_quiz, streak_7}; At Risk {first_quiz}; Centurion {first_quiz, quiz_100}.
- Unseen (for the celebration): Topper→topper_of_week, Streak Star→streak_7, Centurion→quiz_100 (one each). All others marked seen.
- Snapshot: 1 row for the batch with all 6 ranked.

**SQL sanity**
- `student_dashboard.rank` returns the live batch rank (e.g. #1 for Topper); `recent_badges` is a real array.
- `teacher_batch_overview.at_risk` filters composite < 0.4 and includes the composite value.
- `my_batch_leaderboard` EXPLAIN ANALYZE on the seeded batch = **9.9 ms** (<100 ms).

**Advisor sweep**
- Security: only the accepted 5 guarded-SECURITY-DEFINER WARNs (D-186) + leaked-password (Phase-1). `evaluate_student_badges` + `leaderboard_weekly_rollover` not callable by authenticated. No 0010 / 0011.
- Performance: only accepted `multiple_permissive_policies` WARNs + fresh `unused_index` INFOs. No unindexed-FK, no auth_rls_initplan.

---

## §K — Report-back format

```
0.2 ok — NNNN modules

A1 ok — Ranks tab, Weekly selected
A2 ok — #1/6 hero 0.85, medals + order
A3 ok — public card, no PII
A4 ok — 60/25/15 modal
A5 ok — All-Time loads
B1 ok — 6 coloured / 5 locked
B2 ok — locked how-to-earn
B3 ok — earned date
C1 ok — confetti, Awesome!, no repeat
C2 ok — Streak Star + Centurion celebrations
D1 ok — Rank pill #1 → leaderboard
D2 ok — recent badges chips
D3 ok — orange 7-day flame
E1 ok — streak modal + badges section
F1 ok — grey 0-day ember
G1 ok — At Risk + Centurion < 0.40

(or: <Xn> FAIL — <what you saw>)
```
