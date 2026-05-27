-- Phase 10 CP5 — weekly rollover: snapshot each batch's final weekly board + award
-- topper_of_week (#1) and runner_up_week (#2/#3). Idempotent (D-106): a batch already
-- snapshotted for the period is skipped, so a second run neither re-snapshots nor
-- double-awards (badge inserts are also ON CONFLICT DO NOTHING). composite>0 guard
-- avoids crowning an all-zero batch. The rank tie-breaker matches my_batch_leaderboard
-- (composite desc, q_norm desc, quiz_count desc, full_name asc).
--
-- p_period_start defaults to (today_IST - 6) → the week ending today (Sunday at the
-- cron time). p_batch null = all active batches (the cron); set = one batch (admin
-- force-run / smoke). SECURITY DEFINER + EXECUTE service_role/postgres only.

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

-- Sunday 23:59 IST = Sunday 18:29 UTC. Calls the DB fn directly (no pg_net), like the
-- Phase 8 streak/mastery crons. Idempotent re-schedule.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'leaderboard-weekly-rollover') then
    perform cron.unschedule('leaderboard-weekly-rollover');
  end if;
end $$;
select cron.schedule('leaderboard-weekly-rollover', '29 18 * * 0',
                     $$select public.leaderboard_weekly_rollover();$$);
