-- Phase 8 CP12: teacher_batch_overview(p_batch) — server-side aggregate for the
-- teacher batch dashboard (spec §9: client gets one row per date, not a full
-- date×student matrix). SECURITY DEFINER with teaches-or-admin guard.
--   attendance    : last-30-day per-date present/late % across the batch
--   topic_mastery : avg mastery per topic across the batch, weakest first
--   at_risk       : students with avg mastery < 40% OR attendance < 60%
create or replace function public.teacher_batch_overview(p_batch uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caller uuid := private.current_app_user_id();
begin
  if v_caller is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  if not private.is_admin()
     and not exists (select 1 from batch_teachers bt where bt.batch_id = p_batch and bt.teacher_id = v_caller) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'batch', (
      select jsonb_build_object('id', b.id, 'name', b.name,
               'course_code', c.code, 'course_name', c.name,
               'student_count', (select count(*) from students s where s.batch_id = b.id))
      from batches b join courses c on c.id = b.course_id
      where b.id = p_batch
    ),
    'attendance', coalesce((
      select jsonb_agg(jsonb_build_object('date', z.d, 'pct', z.pct) order by z.d)
      from (
        select (se.scheduled_start at time zone 'Asia/Kolkata')::date as d,
               round(100.0 * count(*) filter (where a.status in ('present','late')) / nullif(count(*), 0), 0) as pct
        from sessions se
        join attendance a on a.session_id = se.id
        where se.batch_id = p_batch and se.scheduled_start >= now() - interval '30 days'
        group by (se.scheduled_start at time zone 'Asia/Kolkata')::date
      ) z
    ), '[]'::jsonb),
    'topic_mastery', coalesce((
      select jsonb_agg(jsonb_build_object('topic_id', z.tid, 'topic_name', z.tname,
               'avg_mastery', z.am, 'student_count', z.n) order by z.am asc, z.tname)
      from (
        select t.id tid, t.name tname, round(avg(m.mastery_pct), 0) am, count(*) n
        from mastery m join topics t on t.id = m.topic_id
        where m.student_id in (select s.user_id from students s where s.batch_id = p_batch)
        group by t.id, t.name
      ) z
    ), '[]'::jsonb),
    'at_risk', coalesce((
      select jsonb_agg(jsonb_build_object('student_id', z.uid, 'full_name', z.fname,
               'avg_mastery', z.am, 'attendance_pct', z.ap) order by z.am asc nulls last, z.fname)
      from (
        with bs as (
          select s.user_id uid, au.full_name fname
          from students s join app_users au on au.id = s.user_id
          where s.batch_id = p_batch
        ),
        mast as (
          select student_id, avg(mastery_pct) am from mastery
          where student_id in (select uid from bs) group by student_id
        ),
        att as (
          select a.student_id,
                 100.0 * count(*) filter (where a.status in ('present','late')) / nullif(count(*), 0) ap
          from attendance a join sessions se on se.id = a.session_id
          where se.batch_id = p_batch and se.scheduled_start >= now() - interval '30 days'
          group by a.student_id
        )
        select bs.uid, bs.fname,
               case when m.am is null then null else round(m.am, 0) end am,
               case when at.ap is null then null else round(at.ap, 0) end ap
        from bs
        left join mast m on m.student_id = bs.uid
        left join att at on at.student_id = bs.uid
        where coalesce(m.am, 100) < 40 or coalesce(at.ap, 100) < 60
      ) z
    ), '[]'::jsonb)
  );
end
$$;

revoke all on function public.teacher_batch_overview(uuid) from public, anon;
grant execute on function public.teacher_batch_overview(uuid) to authenticated, service_role;
