-- Phase 8 CP6: feed activity_days when a student watches >=50% of a video
-- (the video half of the D-074 active-day rule). video_progress is upserted
-- directly by the client under RLS, so the trigger fn is SECURITY DEFINER to
-- insert into activity_days (students have no direct INSERT there). Idempotent
-- via the activity_days PK (student_id, day).
create or replace function public.video_progress_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.watched_pct >= 50 then
    insert into activity_days (student_id, day)
    values (new.student_id, (coalesce(new.last_watched_at, now()) at time zone 'Asia/Kolkata')::date)
    on conflict (student_id, day) do nothing;
  end if;
  return new;
end
$$;

create trigger video_progress_activity_trg
after insert or update of watched_pct on public.video_progress
for each row execute function public.video_progress_activity();
