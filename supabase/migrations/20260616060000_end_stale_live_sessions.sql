-- Auto-end abandoned live classes (2026-06-16).
--
-- Bug: a teacher who STARTS a live class (status -> 'live') but never calls
-- yt-broadcast-stop (closes the app / loses network) leaves the session stuck
-- at status='live' forever. Every surface (mobile + web student "Classes > Live"
-- tab, dashboard "Join live" card, live screen) keys off status='live', so the
-- finished class keeps showing as LIVE indefinitely. (Found in prod: session
-- eab47b19-d18f-4129-840c-82615e4ba83e "trail 2", live since 2026-06-14.)
--
-- Fix: an idempotent pg_cron backstop that ends any session left 'live' well
-- past its scheduled window. Mirrors yt-broadcast-stop's DB effects: status +
-- ended_at, a kind='system' "Class has ended." chat signal (so any client still
-- on the live screen flips to the recording over the realtime channel), and
-- resolution of dangling raised hands. YouTube itself auto-completes a broadcast
-- shortly after the encoder disconnects and the recording stays reachable via
-- the stored yt_video_id, so this DB-only end is sufficient for the apps.
--
-- Grace window: ended when scheduled_end is >1h past, OR the class has been live
-- for >4h (covers a missing/garbage scheduled_end). Generous enough never to cut
-- a class that is merely running over its slot, tight enough that an abandoned
-- class clears within ~1h instead of lingering for days.

create or replace function private.end_stale_live_sessions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ended integer := 0;
  r record;
begin
  for r in
    select id, created_by, is_live_class
    from public.sessions
    where status = 'live'
      and (
        scheduled_end < now() - interval '1 hour'
        or started_at  < now() - interval '4 hours'
      )
    for update skip locked
  loop
    update public.sessions
      set status = 'ended',
          ended_at = coalesce(ended_at, now())
      where id = r.id;

    -- Live-class housekeeping mirrors yt-broadcast-stop. Guarded so it never
    -- aborts the sweep: skip the end signal when created_by is null (NOT NULL
    -- author_id) or a system marker already exists (idempotent re-runs).
    if r.is_live_class then
      if r.created_by is not null
         and not exists (
           select 1 from public.chat_messages
           where session_id = r.id and kind = 'system'
         ) then
        insert into public.chat_messages (session_id, author_id, kind, body)
        values (r.id, r.created_by, 'system', 'Class has ended.');
      end if;

      update public.raise_hand_events
        set resolved_at = now()
        where session_id = r.id and resolved_at is null;
    end if;

    v_ended := v_ended + 1;
  end loop;

  return v_ended;
end;
$$;

revoke all on function private.end_stale_live_sessions() from public;

-- Re-schedule idempotently (mirrors dashboard_cron / push_notifications pattern).
select cron.unschedule(jobid) from cron.job where jobname = 'end-stale-live-sessions';
select cron.schedule('end-stale-live-sessions', '*/5 * * * *',
                     $$select private.end_stale_live_sessions();$$);
