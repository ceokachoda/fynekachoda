-- Phase 10 CP4 — server-side badge eligibility evaluator (the client NEVER decides).
--
-- Evaluates the 9 NON-RANK badges (topper_of_week + runner_up_week are awarded only
-- by leaderboard_weekly_rollover, which has the rank context). Idempotent: inserts
-- ON CONFLICT DO NOTHING into badge_earnings, so a double-award race is a no-op and
-- each fresh insert (is_seen=false) is exactly one celebration. Returns the codes
-- NEWLY awarded this call (so the caller can audit / surface them).
--
-- SECURITY DEFINER + EXECUTE revoked from authenticated/anon → only service_role
-- (edge fns + inline feeders) and postgres (rollover/cron) can invoke it. This closes
-- the self-award hole (an authenticated user must NOT be able to award themselves).
-- p_triggers is accepted for API/telemetry symmetry; the predicates are cheap indexed
-- lookups, so all 9 are evaluated each call regardless (ON CONFLICT keeps it idempotent).

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

  -- early_bird: >=5 present/late scans recorded before the scheduled start.
  select count(*) >= 5 into v_early_bird
  from public.attendance a
  join public.sessions se on se.id = a.session_id
  where a.student_id = p_student
    and a.status in ('present','late')
    and a.marked_at < se.scheduled_start;

  -- mastery_80_subject: a subject with >=3 mastered topics averaging >=80.
  select exists (
    select 1
    from public.mastery m
    join public.topics  t  on t.id = m.topic_id
    join public.chapters ch on ch.id = t.chapter_id
    join public.subjects su on su.id = ch.subject_id
    where m.student_id = p_student
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
