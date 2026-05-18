-- Phase 4 CP7 — `public.materialize_sessions(days)` + pg_cron nightly job.
--
-- For each active `batch_schedule` row, generate `sessions` rows for the
-- next `days` calendar days in `Asia/Kolkata` (D-014). Idempotent via a new
-- UNIQUE `(batch_id, scheduled_start)` constraint on `sessions` —
-- `ON CONFLICT DO NOTHING` skips already-materialized occurrences.
--
-- Schedule: 00:30 IST nightly (= 19:00 UTC), name
-- `materialize-sessions-nightly`. Spec §5.7 quoted '30 18 * * *' under a
-- "00:00 IST" comment which contradicted its own "00:30 IST" prose line;
-- the time is shifted to match the prose. The admin "Re-materialize now"
-- button (Phase 12) will invoke the same function via service-role.

create extension if not exists pg_cron;

alter table public.sessions
  add constraint sessions_batch_start_unique unique (batch_id, scheduled_start);

create or replace function public.materialize_sessions(p_days int default 14)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inserted int := 0;
begin
  with cal as (
    select generate_series(
      (now() at time zone 'Asia/Kolkata')::date,
      (now() at time zone 'Asia/Kolkata')::date + (p_days - 1),
      interval '1 day'
    )::date as d
  ),
  occurrences as (
    select
      bs.batch_id,
      bs.subject_id,
      ((c.d + bs.start_time) at time zone 'Asia/Kolkata') as scheduled_start,
      ((c.d + bs.end_time)   at time zone 'Asia/Kolkata') as scheduled_end
    from public.batch_schedule bs
    join cal c on (extract(dow from c.d)::int = bs.weekday)
    where bs.is_active
  )
  insert into public.sessions (batch_id, subject_id, scheduled_start, scheduled_end)
  select o.batch_id, o.subject_id, o.scheduled_start, o.scheduled_end
  from occurrences o
  on conflict on constraint sessions_batch_start_unique do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function public.materialize_sessions(int) from public, anon, authenticated;
grant execute on function public.materialize_sessions(int) to service_role;

do $$
begin
  perform cron.unschedule('materialize-sessions-nightly');
exception when others then
  -- pg_cron raises if the job name doesn't exist; safe to ignore on first run.
  null;
end;
$$;

select cron.schedule(
  'materialize-sessions-nightly',
  '0 19 * * *',
  $cron$select public.materialize_sessions(14);$cron$
);
