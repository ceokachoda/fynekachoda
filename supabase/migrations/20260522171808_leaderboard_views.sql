-- Phase 10 CP2 — leaderboard_weekly + leaderboard_alltime composite views.
--
-- composite = 0.60*Q + 0.25*A + 0.15*S (D-071, LOCKED). The weights/windows mirror
-- packages/shared/src/constants/leaderboard.ts (the TS single-source for tests + the
-- mobile "How is this calculated?" copy) — keep both in sync.
--   Q = avg of per-attempt clamp01(score/max_score) over quiz+exam attempts in window
--       (weekly: last 7 days; all-time: last 180 days).
--   A = active_days_in_window / expected_days, capped 1. expected_days is reduced for
--       students who joined recently (fairness, spec §3.6): weekly = min(7, days since
--       join); all-time = days since join.
--   S = min(current_streak_days / 30, 1).
-- Suspended/inactive students are hidden (app_users.is_active, spec §3.6).
--
-- SECURITY: views are `security_invoker = true` (so a direct authenticated read would
-- be RLS-limited to the caller's own attempts — never a cross-batch leak — AND the
-- 0010 security-definer-view lint stays clear). SELECT is revoked from anon +
-- authenticated regardless: the ONLY client path is the my_batch_leaderboard
-- SECURITY DEFINER fn (CP3), which reads these views as the owner. Service role +
-- the rollover/dashboard SECURITY DEFINER fns also read them.

create or replace view public.leaderboard_weekly
with (security_invoker = true) as
with today as (
  select (now() at time zone 'Asia/Kolkata')::date as d
),
base as (
  select s.user_id as student_id, s.batch_id,
         (s.joined_at at time zone 'Asia/Kolkata')::date as joined_day
  from public.students s
  join public.app_users au on au.id = s.user_id and au.is_active = true
),
q as (  -- pooled quiz+exam score ratio (per-attempt clamped) in the last 7 days
  select student_id, avg(ratio) as q_avg
  from (
    select student_id, least(greatest(score / max_score, 0), 1) as ratio
    from public.quiz_attempts
    where submitted_at is not null and submitted_at >= now() - interval '7 days'
      and score is not null and max_score is not null and max_score > 0
    union all
    select student_id, least(greatest(score / max_score, 0), 1) as ratio
    from public.exam_attempts
    where submitted_at is not null and submitted_at >= now() - interval '7 days'
      and score is not null and max_score is not null and max_score > 0
  ) u
  group by student_id
),
qc as (  -- all-time submitted quiz count (tie-breaker 3, spec §3.5)
  select student_id, count(*) as quiz_count
  from public.quiz_attempts
  where submitted_at is not null
  group by student_id
),
act as (  -- distinct active IST days in [today-6 .. today]
  select ad.student_id, count(*) as active_days
  from public.activity_days ad, today
  where ad.day > today.d - 7 and ad.day <= today.d
  group by ad.student_id
)
select x.student_id, x.batch_id, x.q_norm, x.a_norm, x.s_norm, x.quiz_count,
       (0.60 * x.q_norm + 0.25 * x.a_norm + 0.15 * x.s_norm) as composite
from (
  select b.student_id, b.batch_id,
         coalesce(q.q_avg, 0) as q_norm,
         least(coalesce(act.active_days, 0)::numeric
               / greatest(least(7, (select d from today) - b.joined_day + 1), 1), 1) as a_norm,
         least(coalesce(st.current_days, 0)::numeric / 30, 1) as s_norm,
         coalesce(qc.quiz_count, 0)::int as quiz_count
  from base b
  left join q   on q.student_id  = b.student_id
  left join qc  on qc.student_id = b.student_id
  left join act on act.student_id = b.student_id
  left join public.streaks st on st.student_id = b.student_id
) x;

create or replace view public.leaderboard_alltime
with (security_invoker = true) as
with today as (
  select (now() at time zone 'Asia/Kolkata')::date as d
),
base as (
  select s.user_id as student_id, s.batch_id,
         (s.joined_at at time zone 'Asia/Kolkata')::date as joined_day
  from public.students s
  join public.app_users au on au.id = s.user_id and au.is_active = true
),
q as (  -- pooled quiz+exam score ratio over the last 180 days
  select student_id, avg(ratio) as q_avg
  from (
    select student_id, least(greatest(score / max_score, 0), 1) as ratio
    from public.quiz_attempts
    where submitted_at is not null and submitted_at >= now() - interval '180 days'
      and score is not null and max_score is not null and max_score > 0
    union all
    select student_id, least(greatest(score / max_score, 0), 1) as ratio
    from public.exam_attempts
    where submitted_at is not null and submitted_at >= now() - interval '180 days'
      and score is not null and max_score is not null and max_score > 0
  ) u
  group by student_id
),
qc as (
  select student_id, count(*) as quiz_count
  from public.quiz_attempts
  where submitted_at is not null
  group by student_id
),
act as (  -- all-time distinct active days
  select student_id, count(*) as active_days
  from public.activity_days
  group by student_id
)
select x.student_id, x.batch_id, x.q_norm, x.a_norm, x.s_norm, x.quiz_count,
       (0.60 * x.q_norm + 0.25 * x.a_norm + 0.15 * x.s_norm) as composite
from (
  select b.student_id, b.batch_id,
         coalesce(q.q_avg, 0) as q_norm,
         least(coalesce(act.active_days, 0)::numeric
               / greatest((select d from today) - b.joined_day + 1, 1), 1) as a_norm,
         least(coalesce(st.current_days, 0)::numeric / 30, 1) as s_norm,
         coalesce(qc.quiz_count, 0)::int as quiz_count
  from base b
  left join q   on q.student_id  = b.student_id
  left join qc  on qc.student_id = b.student_id
  left join act on act.student_id = b.student_id
  left join public.streaks st on st.student_id = b.student_id
) x;

revoke all on public.leaderboard_weekly  from anon, authenticated;
revoke all on public.leaderboard_alltime from anon, authenticated;
