# Spec: Leaderboard & Gamification

Two related but distinct features:
1. **Leaderboard** — batch-scoped weekly + all-time rankings driven by a composite score.
2. **Gamification** — streaks (active days) and badges (milestones).

Both exist to nudge daily engagement without becoming gimmicky.

---

## 1. Goals

- Make it obvious how the student is doing relative to peers.
- Reward consistent daily activity (streaks).
- Reward milestones with collectible badges.
- Calculations are transparent — students can see how rank is computed.

## 2. Non-Goals (MVP)

- Cross-batch / institute-wide leaderboard.
- Real-money / coin rewards.
- "Levels" / XP bars.
- Anti-gaming countermeasures beyond basic sanity checks.
- Streak freezes / restoration.

---

## 3. Leaderboard

### 3.1 Scope & Tabs

- **Batch-scoped only.** A student sees ranking within their own batch.
- Two tabs: **Weekly** and **All-Time**.
- Tied to the `leaderboard_weekly` (and a parallel `leaderboard_alltime`) view.

### 3.2 Composite Score Formula

Composite = `0.60 * Q + 0.25 * A + 0.15 * S`

Where (each normalized to [0,1]):
- **Q (Quiz / Exam score)** — average of `score / max_score` across `quiz_attempts` + `exam_attempts` submitted in the window.
- **A (Attendance)** — fraction of `activity_days` in the window over expected days (7 for weekly, 30 for all-time computed slot).
- **S (Streak)** — `min(current_streak_days / 30, 1)` (so a 30-day streak = full credit).

Tunable — weights and formula live in `packages/shared/constants/leaderboard.ts`.

### 3.3 Display

`(student)/leaderboard.tsx`:

```
┌──────────────────────────────────────┐
│  Leaderboard — NEET 2027 Morning     │
│  [Weekly]  All-Time                  │
├──────────────────────────────────────┤
│  Your rank: #4 / 30                  │
│  Composite: 0.78                     │
│                                      │
│   #1  🥇 Priya Singh        0.92  ••12 │
│   #2  🥈 Aarav Sharma       0.88  ••34 │
│   #3  🥉 Rohit Patel        0.81  ••56 │
│   #4  ⭐ You                 0.78       │
│   #5     Kavya Iyer         0.74  ••78 │
│   ...                                │
│                                      │
│  [How is this calculated?]           │
└──────────────────────────────────────┘
```

Display rules:
- Real names + last 2 digits of phone (for disambiguation among common Indian names).
- Tap a row → see their public profile card (name, badges, streak only — no PII).
- "How is this calculated?" → modal explaining the 60/25/15 weights.

### 3.4 Refresh cadence

- Computed live on view (the view is cheap at 600 students per batch ÷ ~20 per batch = ~30 rows max).
- Cached 60s client-side.
- No background refresh job — query on demand.

### 3.5 Tie-breaking

Order by:
1. Composite (desc)
2. Q (desc) — quiz score has more weight than attendance for ties
3. Total quiz attempt count (desc)
4. Alphabetical first name (asc)

### 3.6 Edge Cases

| Case | Behavior |
|---|---|
| Student joined mid-week | Their A normalized over days since join (fairness). |
| Brand-new student (no attempts) | Listed at the bottom with composite = 0. |
| Student suspended | Hidden from leaderboard for the duration. |

---

## 4. Streaks

### 4.1 Definition

Streak = consecutive days the student had an **active day**.

**Active day** = both of these on the same IST calendar day:
1. App opened (any session)
2. At least one meaningful action: attendance marked OR quiz submitted OR exam submitted OR a video watched ≥50%

Tracked in `activity_days(student_id, day)` with day as IST date.

### 4.2 Ticker

`streak-recompute` cron, daily at 02:00 IST:

```
for each active student:
  let s = streaks(student_id)
  if exists activity_days(student_id, yesterday):
     s.current_days += 1
     if s.current_days > s.best_days: s.best_days = s.current_days
  else:
     s.current_days = 0
  s.last_active = last activity_day date
```

### 4.3 Display

- Dashboard greeting: "🔥 12 day streak"
- Profile screen: current + best.
- Tap → modal with calendar heatmap of last 30 days (green = active, grey = miss).

### 4.4 Streak Visual States

| Days | Flame |
|---|---|
| 0 | Grey ember |
| 1–6 | Orange small flame |
| 7–29 | Orange bigger flame with sparks |
| 30–89 | Red flame |
| 90+ | Golden flame |

### 4.5 Edge Cases

| Case | Behavior |
|---|---|
| Student travels across timezones | Streak based on IST always. Tough on traveling students, fine for India-only MVP. |
| Streak ticks fail (cron error) | Idempotent — next run catches up if a day's data exists. |
| Clock manipulation on device | Irrelevant; we read server-side dates. |

---

## 5. Badges

### 5.1 Catalogue (Starter)

Stored in the `badges` table; seeded via migration. Easy to add new ones later.

| Code | Name | How to earn |
|---|---|---|
| `first_quiz` | First Step | Submit your first practice quiz |
| `streak_7` | Week Warrior | 7-day active streak |
| `streak_30` | Marathoner | 30-day active streak |
| `streak_90` | Iron Mind | 90-day active streak |
| `perfect_week_attendance` | Showed Up | 100% attendance for 7 consecutive scheduled days |
| `topper_of_week` | Top of the Class | #1 on weekly leaderboard |
| `runner_up_week` | So Close | #2 or #3 on weekly leaderboard |
| `quiz_100` | Centurion | 100 practice quizzes submitted |
| `mastery_80_subject` | Subject Specialist | Avg mastery ≥80 across all topics of a subject (min 3 topics) |
| `early_bird` | Early Bird | 5 attendance scans before scheduled_start |
| `comeback` | Comeback | Restored streak after a break (first restart of ≥7 days streak after a reset) |

### 5.2 Awarding

Triggered by:
- Quiz submit → `first_quiz`, `quiz_100`
- Exam submit → mastery recompute → `mastery_80_subject`
- Daily streak tick → `streak_7/30/90`
- Weekly leaderboard rollover (Sunday 23:59 IST) → `topper_of_week`, `runner_up_week`
- Attendance verify → `early_bird` (if `marked_at < scheduled_start`), `perfect_week_attendance` (computed weekly)

Implementation: inside the relevant edge functions, after the primary action, evaluate badge predicates and `INSERT INTO badge_earnings ON CONFLICT DO NOTHING` (idempotent).

### 5.3 Display

- **Earn celebration:** confetti modal on app focus next time after award. Shows badge icon, name, description, and a "Share" button (optional, deferred).
- **Profile collection:** grid of all earned + locked badges. Locked badges show silhouette + "How to earn".

### 5.4 Edge Cases

| Case | Behavior |
|---|---|
| Same badge eligible twice | `(student_id, badge_id)` is primary key; second insert is a no-op. |
| Badge condition revoked (e.g., recomputed mastery falls below 80) | Badges are sticky — once earned, never removed. Documented to teachers. |
| New badge added later | Eligible students retroactively earn on next eligibility sweep. |

---

## 6. Data Model Touchpoints

- `activity_days` — feeds streaks + leaderboard A factor
- `streaks` — current/best per student
- `quiz_attempts`, `exam_attempts` — Q factor
- `badges`, `badge_earnings`
- `leaderboard_weekly` view, `leaderboard_alltime` view

## 7. Edge Function Map

| Function | Caller | Action |
|---|---|---|
| `streak-recompute` | Cron | Daily streak tick + streak badge award |
| `leaderboard-weekly-rollover` | Cron (Sun 23:59) | Award topper + snapshot weekly rank for "best week" badge later |
| `badge-evaluate` | Internal (called by other fns) | Idempotent eligibility check + award |

## 8. Telemetry

- `leaderboard_viewed` `{ scope: 'weekly'|'alltime' }`
- `leaderboard_calc_modal_opened`
- `streak_modal_opened`
- `badge_earned` `{ badge_code }`
- `badge_collection_viewed`

## 9. Security Considerations

- Leaderboard view filters by batch — student can't query other batches.
- Composite formula is public; the values used to compute it are private to each student (Q from their own attempts).
- Badge eligibility is server-side only — clients can't claim a badge.
- No PII leaks in leaderboard rows (only first + last name + last 2 phone digits).

## 10. UI / Screens

| Screen | Path |
|---|---|
| Leaderboard | `app/(student)/leaderboard.tsx` |
| Streak detail | `app/modal.tsx?type=streak` |
| Badge celebration | `app/modal.tsx?type=badge&code=...` |
| Badge collection | `app/(student)/profile.tsx?tab=badges` |
| How rank is calculated | `app/modal.tsx?type=leaderboard-help` |

## 11. Open Items

- Weekly rollover timezone is Sun 23:59 IST. Confirm this is when the "topper" is locked.
- Public-profile card on tap of a leaderboard row — what fields are public? Defaulting to name + batch + streak + earned badges.
- Should runners-up of weekly leaderboard get a different badge each week, or one cumulative badge? Defaulting to cumulative.
