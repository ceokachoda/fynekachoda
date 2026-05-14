# Phase 10 — Leaderboard & Gamification

> Batch-scoped composite leaderboard (60% Q + 25% A + 15% S). 11 starter badges with sticky earning. Streak flame + celebration modals. Wire the `rank` placeholder in the dashboard.

---

## 1. Goal

Bring the engagement layer online — public ranking, streak flame, badges. All visible in the dashboard, profile, and a dedicated leaderboard screen.

## 2. Prerequisites

- [ ] Phase 9 accepted.
- [ ] Mastery + streaks live (Phase 8).
- [ ] Asset pack: 11 badge SVGs designed and ready to upload to `badge-assets` bucket.

## 3. Scope

### In
- DB: `badges`, `badge_earnings`, plus DB views `leaderboard_weekly` + `leaderboard_alltime`.
- Edge functions: `leaderboard-weekly-rollover` (Sun 23:59 IST cron), `badge-evaluate` (helper called from feeders), `badge-celebration-poll` (returns unread badge earnings on app focus).
- Seeded badge catalogue (11 starter badges).
- Mobile student: `(student)/leaderboard.tsx` (Weekly + All-Time tabs).
- Mobile student: BadgeEarnedModal celebration; badges collection in `(student)/profile.tsx?tab=badges`.
- Mobile dashboard wire-up: stats strip `rank` reads from `leaderboard_weekly`; recent badges card reads from `badge_earnings`.
- Mobile teacher: batch dashboard at-risk list uses the composite formula (replaces Phase 8 simplified version).
- Storage: badge SVGs uploaded to `badge-assets` bucket.

### Out
- Cross-batch / institute leaderboard.
- Levels / XP.
- Real-money rewards.
- Leaderboard for teachers themselves.

## 4. Specs in play

- `docs/spec/leaderboard-and-gamification.md` — primary.
- `docs/spec/student-dashboard.md` (rank pill + badges card).
- `docs/decisions.md` D-071 to D-077.

## 5. Backend work

### 5.1 Migration: badges + earnings (Checkpoint 1)

`supabase/migrations/0021_badges.sql`:

```sql
create table public.badges (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  description text not null,
  icon_path   text not null
);

create table public.badge_earnings (
  student_id  uuid not null references public.students(user_id) on delete cascade,
  badge_id    uuid not null references public.badges(id) on delete cascade,
  earned_at   timestamptz not null default now(),
  is_seen     boolean not null default false,
  primary key (student_id, badge_id)
);

create index badge_earnings_unseen_idx on public.badge_earnings (student_id, is_seen) where is_seen = false;

-- Seed catalogue
insert into public.badges (code, name, description, icon_path) values
  ('first_quiz', 'First Step', 'Submit your first practice quiz', 'badges/first_quiz.svg'),
  ('streak_7', 'Week Warrior', '7-day active streak', 'badges/streak_7.svg'),
  ('streak_30', 'Marathoner', '30-day active streak', 'badges/streak_30.svg'),
  ('streak_90', 'Iron Mind', '90-day active streak', 'badges/streak_90.svg'),
  ('perfect_week_attendance', 'Showed Up', '100% attendance for 7 consecutive scheduled days', 'badges/perfect_week.svg'),
  ('topper_of_week', 'Top of the Class', '#1 on the weekly leaderboard', 'badges/topper.svg'),
  ('runner_up_week', 'So Close', '#2 or #3 on the weekly leaderboard', 'badges/runner_up.svg'),
  ('quiz_100', 'Centurion', '100 practice quizzes submitted', 'badges/quiz_100.svg'),
  ('mastery_80_subject', 'Subject Specialist', 'Average mastery ≥80 across all topics of a subject', 'badges/mastery_80.svg'),
  ('early_bird', 'Early Bird', '5 attendance scans before scheduled start', 'badges/early_bird.svg'),
  ('comeback', 'Comeback', 'Restored a 7+ day streak after a reset', 'badges/comeback.svg');
```

### 5.2 Migration: leaderboard views (Checkpoint 2)

`supabase/migrations/0022_leaderboard_views.sql`:

```sql
create or replace view public.leaderboard_weekly as
with windowed as (
  select s.user_id as student_id, s.batch_id,
         coalesce(avg(qa.score / nullif(qa.max_score, 0)) filter (where qa.submitted_at >= now() - interval '7 days'), 0)
           + coalesce(avg(ea.score / nullif(ea.max_score, 0)) filter (where ea.submitted_at >= now() - interval '7 days'), 0) as raw_score,
         count(distinct ad.day) filter (where ad.day >= (current_date - interval '7 days')::date) as active_days_in_week,
         st.current_days
  from public.students s
  left join public.quiz_attempts qa on qa.student_id = s.user_id
  left join public.exam_attempts ea on ea.student_id = s.user_id
  left join public.activity_days ad on ad.student_id = s.user_id
  left join public.streaks st on st.student_id = s.user_id
  group by s.user_id, s.batch_id, st.current_days
)
select
  student_id, batch_id,
  least(raw_score / 2, 1) as q_norm,                          -- avg of two halves
  least(active_days_in_week::numeric / 7, 1) as a_norm,
  least(coalesce(current_days, 0)::numeric / 30, 1) as s_norm,
  (0.60 * least(raw_score / 2, 1)
   + 0.25 * least(active_days_in_week::numeric / 7, 1)
   + 0.15 * least(coalesce(current_days, 0)::numeric / 30, 1)) as composite
from windowed;

-- Alltime variant uses different windows (180 days for Q, all-time for A, current streak).
create or replace view public.leaderboard_alltime as ...;
```

Performance note: views compute on read. At 600 students × 20/batch, this is well under 100ms. If it slows down later, materialize.

### 5.3 RLS on views (Checkpoint 3)

Views inherit from underlying tables. Add a wrapper RLS-friendly query helper:

```sql
create or replace function public.my_batch_leaderboard(scope text default 'weekly')
returns table (student_id uuid, full_name text, phone_last_2 text, composite numeric, rank int)
language sql stable security definer set search_path = public as $$
  with my_batch as (select batch_id from public.students where user_id = public.current_app_user_id())
  select au.id, au.full_name,
         coalesce(right(au.phone, 2), '00') as phone_last_2,
         lb.composite,
         (rank() over (partition by lb.batch_id order by lb.composite desc, lb.q_norm desc))::int
  from (select * from public.leaderboard_weekly where scope = 'weekly'
        union all
        select * from public.leaderboard_alltime where scope = 'alltime') lb
  join public.students s on s.user_id = lb.student_id
  join public.app_users au on au.id = s.user_id
  where s.batch_id = (select batch_id from my_batch)
  order by composite desc, lb.q_norm desc, au.full_name asc;
$$;
```

(Refine in implementation; this is the shape.)

### 5.4 Edge fn: badge-evaluate (Checkpoint 4)

`apps/functions/badge-evaluate/index.ts`:

Helper called by other fns. Input: `{ student_id, triggers: ('quiz_submit'|'exam_submit'|'attendance'|'video_watch'|'streak_tick')[] }`.

For each badge whose conditions a trigger could satisfy, evaluate:
- `first_quiz`: count of submitted quiz_attempts == 1
- `quiz_100`: count >= 100
- `streak_7/30/90`: streaks.current_days >= 7/30/90
- `perfect_week_attendance`: 7 consecutive scheduled days with status in present|late
- `mastery_80_subject`: avg mastery across subject's topics ≥ 80, min 3 topics
- `early_bird`: count of attendance where `marked_at < scheduled_start` >= 5
- `comeback`: pre-existing best_days >= 7, current_days just hit 7 again after a reset

INSERT into `badge_earnings ON CONFLICT DO NOTHING`. Each new insert is a celebration.

### 5.5 Cron: leaderboard-weekly-rollover (Checkpoint 5)

Schedule: Sunday 23:59 IST (Sunday 18:29 UTC).

`apps/functions/leaderboard-weekly-rollover/index.ts`:
1. For each batch, compute the final weekly leaderboard.
2. Top 1 gets `topper_of_week` badge.
3. Top 2-3 get `runner_up_week` badge.
4. Snapshot the weekly leaderboard into a `leaderboard_snapshots` table for historical "best week" badges later.

`supabase/migrations/0023_leaderboard_snapshots.sql`:

```sql
create table public.leaderboard_snapshots (
  id          uuid primary key default gen_random_uuid(),
  batch_id    uuid not null references public.batches(id) on delete cascade,
  period_start date not null,
  period_end   date not null,
  rankings    jsonb not null,  -- [{student_id, composite, rank}]
  created_at  timestamptz not null default now()
);
```

### 5.6 Call badge-evaluate from feeders (Checkpoint 6)

Add inline calls to `badge-evaluate` (or inline its logic) inside:
- `quiz-submit` after recording attempt.
- `exam-submit` after recording attempt.
- `attendance-qr-verify` after marking.
- `streak-recompute` after each streak tick.
- video_progress upsert when watched_pct crosses 50%.

Use the `is_seen=false` flag so the client can detect new badges.

### 5.7 Storage: upload badge SVGs (Checkpoint 7)

Manual step (not automated): upload the 11 SVGs to `badge-assets` bucket at paths matching `badges.icon_path`.

Add `badge-assets` bucket if not yet created:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('badge-assets', 'badge-assets', false, 102400, array['image/svg+xml','image/png']);

-- Cacheable signed URL (24h)
```

## 6. Frontend work

### 6.1 Mobile student: leaderboard screen (Checkpoint 8)

`apps/mobile/app/(student)/leaderboard.tsx`:

Layout per `spec/leaderboard-and-gamification.md §3.3`:
- Title: "Leaderboard — [batch name]".
- Segmented Weekly / All-Time.
- "Your rank: #N / total" hero.
- List of all batch members with rank, name, last-2 phone, composite.
- Tap row → small public-profile card modal (name, batch, streak, badges only — no PII).
- "How is this calculated?" link → modal with the 60/25/15 explanation.

Data: `supabase.rpc('my_batch_leaderboard', { scope })`. Cached 60s.

### 6.2 Mobile student: badge collection + celebration (Checkpoint 9)

`apps/mobile/app/(student)/profile.tsx?tab=badges`:
- Grid of all 11 badges. Earned = colored; unearned = silhouette + "How to earn".

`components/gamification/BadgeEarnedModal.tsx`:
- Full-screen confetti modal.
- Badge icon + name + description.
- "Share" button (disabled in MVP).
- "Awesome!" dismiss → flips `is_seen=true`.

On app focus / mount: poll `badge_earnings WHERE is_seen=false`. Queue them and show one at a time as modals.

### 6.3 Mobile dashboard: rank + recent badges live (Checkpoint 10)

`apps/mobile/app/(student)/index.tsx`:
- StatsStrip rank pill: shows actual rank (was "—" in Phase 8).
- RecentBadgesStrip: shows last 3 earned badges (was empty in Phase 8).
- Streak flame: actual streak from Phase 8 streaks table — color varies per `spec/leaderboard-and-gamification.md §4.4`.

### 6.4 Mobile streak detail modal — final polish (Checkpoint 11)

`app/modal.tsx?type=streak`: enhanced from Phase 8 to also list badges earned during the streak.

### 6.5 Mobile teacher: at-risk list uses real composite (Checkpoint 12)

`apps/mobile/app/(teacher)/batch/[id].tsx?tab=risk`:
- Query `my_batch_leaderboard` (or a teacher equivalent) with composite < 0.4.
- Show each at-risk student with their actual composite.

## 7. Files changed (summary)

### Mobile — added
- `app/(student)/leaderboard.tsx`
- `components/leaderboard/RankRow.tsx`, `RankBadge.tsx`, `ScopeTabs.tsx`, `LeaderboardCalcModal.tsx`
- `components/gamification/BadgeShowcase.tsx`, `BadgeEarnedModal.tsx`, `StreakFlame.tsx` (already exists from Phase 8; refine colors)
- `features/leaderboard/useLeaderboard.ts`
- `features/gamification/useUnseenBadges.ts`, `useBadgesCollection.ts`

### Mobile — edited
- `app/(student)/index.tsx` — wire rank + recent badges.
- `app/(student)/profile.tsx` — add Badges tab.
- `app/(teacher)/batch/[id].tsx` — at-risk uses real composite.

### Edge fns
- `badge-evaluate` (new; also inlined into quiz-submit etc.)
- `leaderboard-weekly-rollover` (new cron)

### DB
- 3 migrations (badges, views, snapshots)
- Storage bucket `badge-assets`

## 8. Integration & cross-cutting

- Audit: `badge_earned` events from `badge-evaluate`.
- Telemetry: `leaderboard_viewed`, `leaderboard_scope_changed`, `badge_earned`, `badge_collection_viewed`, `streak_modal_opened`, `leaderboard_calc_modal_opened`.

## 9. Risks & gotchas

| Risk | Mitigation |
|---|---|
| Leaderboard view slow with many batches | At 600 students × 20/batch, fine. If grows, materialize as table refreshed every 5 min. |
| Badge double-award race | `(student_id, badge_id)` is primary key; ON CONFLICT DO NOTHING. |
| Composite formula tuning | Constants in `packages/shared/constants/leaderboard.ts` so easy to adjust. |
| Badge SVGs not uploaded → broken icons | Phase 10 acceptance includes "all 11 SVGs uploaded". |
| Celebration modal shown to a student who left the app open across days | Poll on app focus; consume one badge at a time; flip is_seen synchronously. |
| Topper-of-week ties | Rank tie-breaker per spec: composite → q_norm → quiz count → name asc. |
| Privacy of last-2 phone digits | Acceptable per D-073; documented. |
| Comeback badge wrongly awarded for first streak | Check `best_days >= 7` predicate. |

## 10. Acceptance criteria

1. Migrations clean. 11 badges seeded.
2. Storage bucket `badge-assets` exists; all 11 SVGs uploaded.
3. Student opens leaderboard → sees self + batch peers.
4. Tied ranks resolved per tie-breaker.
5. "How calculated?" modal explains 60/25/15.
6. Student submits first quiz → `badge-evaluate` awards `first_quiz` → celebration modal shows on next app focus.
7. Streak hits 7 days (via SQL backdate or wait) → `streak_7` awarded.
8. Topper of week (Sunday rollover): badge awarded to #1; runner-up to #2-3.
9. Snapshot inserted into `leaderboard_snapshots` for each batch.
10. Dashboard stats strip shows live rank (was "—").
11. Recent badges card shows last 3 earned.
12. Streak flame color matches state (small orange for 5 days, etc.).
13. Badge collection in profile shows earned (colored) + unearned (silhouette).
14. Tapping unearned badge shows "How to earn" copy.
15. RLS: student of batch B cannot read leaderboard of batch A.
16. Teacher's at-risk list now uses true composite formula.
17. CI green; RLS tests updated.

## 11. Test plan

### Unit
- Composite formula calc with various inputs.
- Badge condition evaluators (each of 11).
- Rank tie-breaker.

### Integration
- `badge-evaluate`: each badge unlock scenario.
- `leaderboard-weekly-rollover`: top 1 + top 2-3 receive correct badges.

### RLS
- Cross-batch isolation on leaderboard query.
- Student cannot read another's badge_earnings (RLS).

### Manual QA
- Backdate quiz_attempts via SQL to simulate 100 quizzes → `quiz_100` awarded.
- Backdate activity_days to simulate 7-day streak → `streak_7` awarded.
- Force-run Sunday rollover via admin button → snapshot + badges.

## 12. Rollback plan

If Phase 10 breaks:
1. Revert migrations 0021-0023.
2. Mobile leaderboard reverts to "Coming soon".
3. Dashboard rank pill returns to "—".
4. Badge celebrations disabled.

## 13. Definition of done

- [ ] All 17 AC pass.
- [ ] All 11 badge SVGs present in storage and rendering correctly.
- [ ] CI green.
- [ ] User says "Phase 10 accepted".

## 14. Hand-off to Phase 11

- Activity_days + streaks + badges all live.
- Composite leaderboard live (used in parents' report too).
- Phase 11 adds the WhatsApp PDF report pipeline.
