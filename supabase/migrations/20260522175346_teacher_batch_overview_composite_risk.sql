-- Phase 10 CP12 — teacher at-risk list now uses the REAL composite (< 0.4), replacing
-- the Phase 8 simplified "mastery<40 OR attendance<60". Deliberate Phase-8-surface
-- change, in Phase 10 scope. composite comes from the leaderboard_weekly view (read as
-- owner via SECURITY DEFINER). 0.4 mirrors AT_RISK_COMPOSITE_THRESHOLD in
-- packages/shared/src/constants/leaderboard.ts. avg_mastery + attendance_pct kept for
-- context in the mobile AtRiskList. Only at-risk students who are active are listed.
create or replace function public.teacher_batch_overview(p_batch uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
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
               'composite', round(z.composite, 2), 'avg_mastery', z.am, 'attendance_pct', z.ap)
               order by z.composite asc, z.fname)
      from (
        with bs as (
          select s.user_id uid, au.full_name fname
          from students s join app_users au on au.id = s.user_id
          where s.batch_id = p_batch and au.is_active = true
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
               coalesce(lw.composite, 0) as composite,
               case when m.am is null then null else round(m.am, 0) end am,
               case when at.ap is null then null else round(at.ap, 0) end ap
        from bs
        left join leaderboard_weekly lw on lw.student_id = bs.uid
        left join mast m on m.student_id = bs.uid
        left join att at on at.student_id = bs.uid
        where coalesce(lw.composite, 0) < 0.4
      ) z
    ), '[]'::jsonb)
  );
end
$function$;
