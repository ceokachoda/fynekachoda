-- Phase 10 post-QA hardening (2026-05-27).
--
-- Two badge-fact corrections in evaluate_student_badges + a reliability guard in
-- leaderboard_weekly_rollover. All other logic is byte-identical to the originals
-- (20260522172327 / 20260522172647). These are CREATE OR REPLACE on unchanged
-- signatures, but we re-issue the revoke/grant explicitly so the self-award hole
-- stays closed regardless of grant inheritance.
--
--  1. early_bird now excludes attendance against CANCELLED sessions (was counting
--     present/late scans on sessions later cancelled — a permanent over-award on a
--     sticky badge). Now consistent with perfect_week_attendance's status filter.
--  2. mastery_80_subject now requires attempt_count >= 1 per topic, matching the
--     rest of the codebase's "attempted/mastered topic" definition (a 0-attempt
--     placeholder row should neither count toward the 3-topic floor nor drag the
--     average). Strictly more correct — can never over-award.
--  3. leaderboard_weekly_rollover drops a stale temp table before (re)creating it,
--     so two invocations sharing one pooled connection in a single transaction
--     can't collide with "relation _rollover already exists".

create or replace function public.evaluate_student_badges(
  p_student uuid,
  p_triggers text[] default null
)
returns text[]
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_batch        uuid;
  v_quiz_count   int;
  v_streak       int;
  v_first_quiz   boolean;
  v_quiz_100     boolean;
  v_streak_7     boolean;
  v_streak_30    boolean;
  v_streak_90    boolean;
  v_early_bird   boolean;
  v_perfect_week boolean;
  v_mastery_80   boolean;
  v_comeback     boolean;
  v_awarded      text[];
begin
  if p_student is null then
    return '{}';
  end if;
  select batch_id into v_batch from public.students where user_id = p_student;
  if v_batch is null then
    return '{}';  -- not a student
  end if;

  select count(*) into v_quiz_count
  from public.quiz_attempts where student_id = p_student and submitted_at is not null;
  select coalesce(current_days, 0) into v_streak
  from public.streaks where student_id = p_student;
  v_streak := coalesce(v_streak, 0);

  v_first_quiz := v_quiz_count >= 1;
  v_quiz_100   := v_quiz_count >= 100;
  v_streak_7   := v_streak >= 7;
  v_streak_30  := v_streak >= 30;
  v_streak_90  := v_streak >= 90;

  -- early_bird: >=5 present/late scans recorded before the scheduled start of a
  -- NON-cancelled session.
  select count(*) >= 5 into v_early_bird
  from public.attendance a
  join public.sessions se on se.id = a.session_id
  where a.student_id = p_student
    and a.status in ('present','late')
    and se.status <> 'cancelled'
    and a.marked_at < se.scheduled_start;

  -- mastery_80_subject: a subject with >=3 ATTEMPTED topics averaging >=80.
  select exists (
    select 1
    from public.mastery m
    join public.topics  t  on t.id = m.topic_id
    join public.chapters ch on ch.id = t.chapter_id
    join public.subjects su on su.id = ch.subject_id
    where m.student_id = p_student and m.attempt_count >= 1
    group by su.id
    having count(distinct m.topic_id) >= 3 and avg(m.mastery_pct) >= 80
  ) into v_mastery_80;

  -- perfect_week_attendance: a run of >=7 consecutive class-days (the batch's already-
  -- started, non-cancelled sessions, by IST date) where the student was present/late
  -- for EVERY session of each day.
  with classdays as (
    select distinct (se.scheduled_start at time zone 'Asia/Kolkata')::date as d
    from public.sessions se
    where se.batch_id = v_batch and se.status <> 'cancelled' and se.scheduled_start <= now()
  ),
  good as (
    select cd.d,
      not exists (
        select 1 from public.sessions se
        left join public.attendance a on a.session_id = se.id and a.student_id = p_student
        where se.batch_id = v_batch and se.status <> 'cancelled' and se.scheduled_start <= now()
          and (se.scheduled_start at time zone 'Asia/Kolkata')::date = cd.d
          and (a.status is null or a.status = 'absent')
      ) as all_present
    from classdays cd
  ),
  ordered as (
    select d, all_present, row_number() over (order by d) as rn from good
  ),
  islands as (
    select all_present, rn - row_number() over (partition by all_present order by d) as grp
    from ordered
  )
  select coalesce(max(cnt), 0) >= 7 into v_perfect_week
  from (select count(*) as cnt from islands where all_present group by grp) z;

  -- comeback: a CURRENT 7+ streak AND an earlier (now-broken) run that also reached 7+.
  -- Never fires on a first-ever streak (no prior run). Guards the risks-table case.
  if v_streak >= 7 then
    with islands as (
      select day, (day - (row_number() over (order by day))::int) as grp
      from public.activity_days where student_id = p_student
    ),
    runs as (
      select min(day) as sd, max(day) as ed, count(*) as len from islands group by grp
    ),
    cur as (select sd from runs order by ed desc limit 1)
    select exists (select 1 from runs r, cur where r.ed < cur.sd and r.len >= 7)
    into v_comeback;
  else
    v_comeback := false;
  end if;

  -- Award (idempotent). Each fresh row is one celebration.
  with elig(code) as (
    select code from (values
      ('first_quiz',              v_first_quiz),
      ('quiz_100',                v_quiz_100),
      ('streak_7',                v_streak_7),
      ('streak_30',               v_streak_30),
      ('streak_90',               v_streak_90),
      ('early_bird',              v_early_bird),
      ('perfect_week_attendance', v_perfect_week),
      ('mastery_80_subject',      v_mastery_80),
      ('comeback',                v_comeback)
    ) t(code, ok) where ok
  ),
  ins as (
    insert into public.badge_earnings (student_id, badge_id)
    select p_student, b.id from public.badges b join elig e on e.code = b.code
    on conflict (student_id, badge_id) do nothing
    returning badge_id
  )
  select coalesce(array_agg(b.code order by b.sort_order), '{}')
  into v_awarded
  from ins join public.badges b on b.id = ins.badge_id;

  return v_awarded;
end
$function$;

revoke all on function public.evaluate_student_badges(uuid, text[]) from public, anon, authenticated;
grant execute on function public.evaluate_student_badges(uuid, text[]) to service_role;

create or replace function public.leaderboard_weekly_rollover(
  p_period_start date default null,
  p_batch uuid default null
)
returns int
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_start date := coalesce(p_period_start, v_today - 6);
  v_end   date := v_start + 6;
  v_count int;
begin
  -- Guard against a stale temp table on a reused pooled connection (the table is
  -- ON COMMIT DROP, but two calls inside one transaction would otherwise collide).
  drop table if exists _rollover;
  create temporary table _rollover on commit drop as
  with ranked as (
    select lw.batch_id, lw.student_id, au.full_name, lw.composite, lw.q_norm, lw.quiz_count,
      rank() over (partition by lw.batch_id
                   order by lw.composite desc, lw.q_norm desc, lw.quiz_count desc, au.full_name asc) as rnk
    from public.leaderboard_weekly lw
    join public.app_users au on au.id = lw.student_id
    where p_batch is null or lw.batch_id = p_batch
  )
  select r.* from ranked r
  where not exists (
    select 1 from public.leaderboard_snapshots ls
    where ls.batch_id = r.batch_id and ls.period_start = v_start
  );

  insert into public.leaderboard_snapshots (batch_id, period_start, period_end, rankings)
  select batch_id, v_start, v_end,
         jsonb_agg(jsonb_build_object(
           'student_id', student_id, 'full_name', full_name,
           'composite', round(composite, 4), 'rank', rnk) order by rnk)
  from _rollover
  group by batch_id;

  insert into public.badge_earnings (student_id, badge_id)
  select r.student_id, b.id
  from _rollover r
  join public.badges b on b.code = case when r.rnk = 1 then 'topper_of_week'
                                        when r.rnk in (2, 3) then 'runner_up_week' end
  where r.rnk <= 3 and r.composite > 0
  on conflict (student_id, badge_id) do nothing;

  select count(distinct batch_id) into v_count from _rollover;
  return coalesce(v_count, 0);
end
$function$;

revoke all on function public.leaderboard_weekly_rollover(date, uuid) from public, anon, authenticated;
grant execute on function public.leaderboard_weekly_rollover(date, uuid) to service_role;
