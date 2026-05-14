# Spec: Student Dashboard

The dashboard is the student's home screen. It collapses everything important into one scroll: what's happening today, how I'm doing, what to do next.

---

## 1. Goals

- Surface today's schedule at the top.
- Show three at-a-glance health numbers: attendance %, current streak, weak topics.
- Give one clear CTA at any given moment ("Join Live Now", "Take Today's Quiz", "Continue Watching").
- Load in <500ms on a warm cache, <1.5s on cold.

## 2. Non-Goals

- Notifications inbox (deferred — push not in MVP).
- Newsfeed / announcements (deferred).
- Settings (lives in Menu).

## 3. Information Architecture

```
┌──────────────────────────────────────┐
│  Greeting + streak flame             │
│  "Good morning, Kaustab • 🔥 12 days"│
├──────────────────────────────────────┤
│  NEXT CARD                           │
│   ┌────────────────────────────────┐ │
│   │ Physics — Live in 12 min       │ │
│   │ Mr. Sharma • Room 4            │ │
│   │ [Join Live]                    │ │
│   └────────────────────────────────┘ │
├──────────────────────────────────────┤
│  STATS STRIP                         │
│  ┌──────┐  ┌──────┐  ┌──────┐        │
│  │ 92%  │  │ 78%  │  │  #4  │        │
│  │ Attn │  │Mastry│  │ Rank │        │
│  └──────┘  └──────┘  └──────┘        │
├──────────────────────────────────────┤
│  TODAY'S SCHEDULE                    │
│   • Physics 09:00 – 10:30  ✔ Marked  │
│   • Chem    11:00 – 12:30  Upcoming  │
│   • Bio     14:00 – 15:30  Upcoming  │
├──────────────────────────────────────┤
│  WEAK TOPICS (Mastery < 50%)         │
│   • Rotational Motion — 38%          │
│       [Practice quiz]                │
│   • Thermodynamics — 42%             │
│       [Practice quiz]                │
├──────────────────────────────────────┤
│  CONTINUE                            │
│  Last video: Vectors Pt 2 (40% done) │
│       [Resume]                       │
├──────────────────────────────────────┤
│  RECENT BADGES                       │
│  🏅 7-Day Streak    🏅 First Quiz    │
└──────────────────────────────────────┘
```

## 4. Cards (in order)

### 4.1 Next Card (single, contextual)

Picks the most relevant action right now:

| Priority | Condition | CTA |
|---|---|---|
| 1 | A live class is `live` and student belongs to batch | "Join Live Now" → `(student)/live/[sessionId]` |
| 2 | An exam is `live` (within start..end) and student hasn't submitted | "Start Exam" → `(student)/exam/[id]` |
| 3 | Next scheduled session is within next 30 min | "Live in X min — [Join Lobby]" |
| 4 | Pending attendance for an active session | "Mark Attendance" → `(student)/attendance` |
| 5 | Most-recent unwatched recording | "Catch Up — Watch Replay" |
| 6 | Top weak topic (`mastery < 50%`) has a published quiz | "Practice Rotational Motion" |
| 7 | (default fallback) | "Browse Library" |

Only one is shown; runner-ups are not stacked.

### 4.2 Stats Strip

Three pills, equal width. Tap each → drill-down screen.

| Stat | Source | Drill-down |
|---|---|---|
| Attendance % (last 30 days) | `attendance` table | Attendance history |
| Mastery (weighted average across all topics with data) | `mastery` table | Topic-by-topic breakdown |
| Rank in batch (weekly leaderboard composite) | `leaderboard_weekly` view | Leaderboard screen |

### 4.3 Today's Schedule

- Lists all `sessions` for the student's batch with `scheduled_start::date = today (IST)`.
- Each row: subject, time range, status badge:
  - `Marked ✔` (attended)
  - `Missed ✕` (status = absent, or session in past with no attendance row)
  - `Live ●` (currently live)
  - `Upcoming` (future)
- Tap → goes to live/lobby/recording as appropriate.

### 4.4 Weak Topics

- Query: top 3 topics where `mastery_pct < 50` AND attempt_count >= 2, ordered by `mastery_pct asc`.
- Each row: topic name, mastery %, "Practice" button → starts the most relevant published practice quiz for the topic.
- Empty state: "You're on top of every topic. Try a harder quiz?" → links to library.

### 4.5 Continue Watching

- Last `content_items` of kind `video` with a `video_progress` row where `watched_pct < 95%`, ordered by `last_watched_at desc`.
- Shows thumbnail, title, % watched, resume CTA.
- Skipped entirely if no in-progress video.

### 4.6 Recent Badges

- Last 3 `badge_earnings` rows. Tap to see full badge collection on `(student)/profile`.

## 5. Data Fetching

Single composed query on dashboard mount, parallelized via TanStack Query:

```ts
useQueries([
  ['dashboard', 'next-card', studentId],        // resolves priority above
  ['dashboard', 'stats', studentId],            // 3 numbers
  ['dashboard', 'today', studentId, todayIST],  // sessions + attendance
  ['dashboard', 'weak-topics', studentId],      // mastery scan
  ['dashboard', 'continue', studentId],         // last video progress
  ['dashboard', 'badges-recent', studentId],
]);
```

All queries cached 60s (`staleTime: 60_000`). Pull-to-refresh forces refetch.

Realtime subscriptions:
- Subscribe to `sessions` UPDATE where `batch_id = my_batch` → if `status` changes to `live`, invalidate `next-card`.
- Subscribe to `attendance` INSERT where `student_id = me` → invalidate `stats` and `today`.

## 6. Mastery Calculation

Per `(student_id, topic_id)`:
1. Gather attempts: last 5 (combined `quiz_attempts` + `exam_attempts`) where `submitted_at IS NOT NULL`, ordered DESC.
2. Compute per-attempt score % = `score / max_score * 100`.
3. `mastery_pct = avg(score_pct)`.
4. Stored in `mastery` table, recomputed on every submission by `mastery-recompute` edge fn.
5. Topic-level mastery is averaged into "overall mastery" for the stats strip — weighted equally across topics with `attempt_count >= 1`.

## 7. Streak Display

- `streaks.current_days` shown next to greeting.
- Color: cool grey if 0, orange flame if 1–6, red flame with sparks if 7+, golden if 30+.
- Tap → opens streak detail modal: calendar heatmap (last 30 days), best streak, "what counts" rules.

Active-day rule:
- App opened (recorded by `app_open` analytics event on first launch of the day)
- AND at least one meaningful action: attendance marked, quiz submitted, exam submitted, or video watched ≥50%
- Streak ticks at 02:00 IST nightly via `streak-recompute` cron.
- Miss a day → reset to 0.
- No streak freeze.

## 8. Empty / Loading / Error States

- **Skeleton loader** on first paint (already implemented in current build; reuse).
- **Empty dashboard** (brand-new student, day 1): hero says "Welcome! Tap [Take a Tour] for a quick walkthrough." Stats strip shows 0s; Today's Schedule shows tomorrow's first session.
- **Network error**: shows cached data with a yellow banner "Offline — showing last sync from {time}". Retry on tap.
- **Session expired**: redirects to login.

## 9. Performance Notes

- Single Supabase query per card; no N+1.
- Dashboard view materialized on the DB side via a `student_dashboard(student_id)` SQL function returning JSON — single round trip when warm.
- Skeletons mounted instantly; data swaps in as queries resolve.

## 10. Accessibility

- All cards reachable via keyboard / screen reader.
- Stats pills have full text label (`"Attendance, 92 percent, tap to view history"`) not just numbers.
- Color is never the only signal (icons + text on every status badge).

## 11. Telemetry

PostHog events:
- `dashboard_viewed`
- `dashboard_next_card_clicked` with `{ priority, action }`
- `dashboard_weak_topic_clicked` with `{ topic_id }`
- `dashboard_continue_clicked`

## 11A. Profile Card (Read-Only Identity)

The student's profile screen (`(student)/profile.tsx`) is partly editable, partly read-only. Identity-critical fields are read-only per D-016 (`spec/authentication.md §10A`):

```
┌──────────────────────────────────────┐
│  Aarav Sharma  [editable: avatar]    │
│  NEET 2027 Morning · NEET UG         │
│                                      │
│  Email      aarav@…           🔒     │
│  Phone      +91 9876543···    🔒     │
│  DOB        14 Mar 2008       🔒     │
│  Batch      NEET 2027 Morning 🔒     │
│  Course     NEET UG           🔒     │
│                                      │
│  Need to change something?           │
│  [Contact your admin ↗]              │
├──────────────────────────────────────┤
│  Password    [Change]                │
│  Dark mode   [Toggle]                │
└──────────────────────────────────────┘
```

The "Contact your admin" link opens whichever contact channel is configured in `institute_config.contact_url` (defaults to a mailto: address).

## 12. UI / Screens

| Screen | Path |
|---|---|
| Dashboard | `app/(student)/index.tsx` |
| Streak detail modal | `app/modal.tsx?type=streak` |
| Mastery breakdown | `app/(student)/profile.tsx?tab=mastery` |

## 13. Data Model Touchpoints

- `students` — `batch_id`, name
- `sessions` — today's schedule
- `attendance` — today's marks
- `mastery` — per-topic mastery
- `streaks`, `activity_days` — streak state
- `badge_earnings` — recent badges
- `content_items` + `video_progress` (new table for partial playback state — added in a later migration)
- `leaderboard_weekly` view — rank pill

## 14. Open Items

- "Continue Watching" requires a `video_progress` table — included in schema for phase 2 wiring.
- Weak topics drill-down: should it list every weak topic or top 5? Defaulting to top 5.
