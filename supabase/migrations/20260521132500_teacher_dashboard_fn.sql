-- Phase 8 (CP11 backend): teacher_dashboard(p_teacher) — single-round-trip JSON for the
-- teacher home. SECURITY DEFINER with own-or-admin guard. NEXT = soonest live/scheduled
-- session in the teacher's batches; PENDING = exams awaiting manual result release (with a
-- submitted attempt) + raised_hands (Phase 9 -> 0); TODAY = IST-today sessions for the
-- teacher's batches. Offline-score-pending has no schedule source and is deferred (Phase 11).
create or replace function public.teacher_dashboard(p_teacher uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caller uuid := private.current_app_user_id();
  v_today  date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if v_caller is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  if p_teacher <> v_caller and not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'next', (
      select jsonb_build_object('session_id', s.id, 'subject', coalesce(sub.name,'Class'),
               'batch', b.name, 'start', s.scheduled_start, 'status', s.status,
               'starts_in_sec', floor(extract(epoch from (s.scheduled_start - now()))))
      from sessions s
      join batches b on b.id = s.batch_id
      left join subjects sub on sub.id = s.subject_id
      where s.batch_id in (select batch_id from batch_teachers where teacher_id = p_teacher)
        and s.status in ('scheduled','live')
        and s.scheduled_end >= now()
      order by (s.status = 'live') desc, s.scheduled_start asc
      limit 1
    ),
    'pending', jsonb_build_object(
      'exams_awaiting_release', coalesce((
        select jsonb_agg(jsonb_build_object('exam_id', e.id, 'title', e.title, 'batch', b.name,
                 'submitted_count', (select count(*) from exam_attempts ea
                                     where ea.exam_id = e.id and ea.submitted_at is not null))
                 order by e.starts_at desc)
        from exams e join batches b on b.id = e.batch_id
        where e.batch_id in (select batch_id from batch_teachers where teacher_id = p_teacher)
          and e.is_published and e.result_release = 'manual' and e.results_released_at is null
          and exists (select 1 from exam_attempts ea where ea.exam_id = e.id and ea.submitted_at is not null)
      ), '[]'::jsonb),
      'raised_hands', 0
    ),
    'today', coalesce((
      select jsonb_agg(jsonb_build_object('session_id', s.id, 'subject', coalesce(sub.name,'Class'),
               'batch', b.name, 'start', s.scheduled_start, 'end', s.scheduled_end, 'status', s.status)
               order by s.scheduled_start)
      from sessions s
      join batches b on b.id = s.batch_id
      left join subjects sub on sub.id = s.subject_id
      where s.batch_id in (select batch_id from batch_teachers where teacher_id = p_teacher)
        and (s.scheduled_start at time zone 'Asia/Kolkata')::date = v_today
    ), '[]'::jsonb)
  );
end
$$;

revoke all on function public.teacher_dashboard(uuid) from public, anon;
grant execute on function public.teacher_dashboard(uuid) to authenticated, service_role;
