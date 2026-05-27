-- Phase 10 CP6 — streak_recompute now also awards streak/comeback badges (D-188).
-- After the streak tick, evaluate badges for every student holding a 7+ day streak.
-- Best-effort + idempotent (evaluate_student_badges is ON CONFLICT DO NOTHING) and
-- wrapped per-row so one bad student never aborts the tick. (Phase 8 body unchanged
-- above the sweep.)
create or replace function public.streak_recompute(
  p_today date default ((now() at time zone 'Asia/Kolkata'::text))::date
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_total integer;
  r record;
begin
  with islands as (
    select student_id, day,
           day - (row_number() over (partition by student_id order by day))::int as grp
    from activity_days
  ),
  runs as (
    select student_id, grp, count(*) as run_len, max(day) as run_end
    from islands
    group by student_id, grp
  ),
  agg as (
    select
      student_id,
      max(run_len) as best_run,
      (array_agg(run_len order by run_end desc))[1] as latest_run_len,
      max(run_end) as latest_day
    from runs
    group by student_id
  )
  insert into streaks as s (student_id, current_days, best_days, last_active, last_evaluated_date, updated_at)
  select
    a.student_id,
    case when a.latest_day >= p_today - 1 then a.latest_run_len else 0 end,
    a.best_run,
    a.latest_day,
    p_today,
    now()
  from agg a
  on conflict (student_id) do update
    set current_days        = excluded.current_days,
        best_days           = greatest(s.best_days, excluded.best_days, excluded.current_days),
        last_active         = excluded.last_active,
        last_evaluated_date = excluded.last_evaluated_date,
        updated_at          = now();

  -- Ensure every student has a row (zeros for those with no activity yet).
  insert into streaks (student_id, current_days, best_days, last_active, last_evaluated_date, updated_at)
  select st.user_id, 0, 0, null, p_today, now()
  from students st
  where not exists (select 1 from streaks s2 where s2.student_id = st.user_id)
  on conflict (student_id) do nothing;

  -- Phase 10 (D-188): award streak_7/30/90 + comeback for anyone now holding a 7+ day
  -- streak. Best-effort + idempotent — a failure here must never break the streak tick.
  for r in select student_id from streaks where current_days >= 7 loop
    begin
      perform public.evaluate_student_badges(r.student_id, array['streak_tick']);
    exception when others then
      raise warning 'streak badge eval failed for %: %', r.student_id, sqlerrm;
    end;
  end loop;

  select count(*) into v_total from streaks;
  return v_total;
end
$function$;
