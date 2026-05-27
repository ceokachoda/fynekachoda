-- Phase 8 CP4: streak_recompute() — consecutive IST-day activity streak (D-074),
-- no freeze (D-075/D-140). Computed from scratch via gaps-and-islands over
-- activity_days, so it is idempotent (D-106) and self-healing if the cron misses a day.
--
-- current_days = length of the most-recent consecutive-day run, but only if that run
-- reaches yesterday or today (else the streak was broken -> 0). best_days is sticky.
-- p_today defaults to the current IST calendar date; the cron may pass it explicitly.
create or replace function public.streak_recompute(
  p_today date default (now() at time zone 'Asia/Kolkata')::date
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
begin
  with islands as (
    -- consecutive days share the same (day - row_number) anchor
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

  select count(*) into v_total from streaks;
  return v_total;
end
$$;

revoke all on function public.streak_recompute(date) from public, anon, authenticated;
grant execute on function public.streak_recompute(date) to service_role;
