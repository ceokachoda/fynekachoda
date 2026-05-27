-- Phase 10 CP10 — wire the dashboard's live `rank` (was hard-null) + `recent_badges`
-- (was '[]') slices. Deliberate Phase-8-surface change, in Phase 10 scope. The fn is
-- SECURITY DEFINER (postgres) so it reads the client-locked leaderboard_weekly view.
-- All other slices unchanged from Phase 8.
create or replace function public.student_dashboard(p_student uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_caller uuid := private.current_app_user_id();
  v_batch  uuid;
  v_course uuid;
  v_today  date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if v_caller is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  if p_student <> v_caller and not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select s.batch_id, b.course_id into v_batch, v_course
  from students s join batches b on b.id = s.batch_id
  where s.user_id = p_student;

  return jsonb_build_object(
    'next_card', coalesce(
      (select jsonb_build_object('type','live_class','priority',1,'session_id',s.id,
                'subject',coalesce(sub.name,'Live Class'),'action','join_live')
       from sessions s left join subjects sub on sub.id = s.subject_id
       where s.batch_id = v_batch and s.status = 'live' and s.is_live_class
       order by s.scheduled_start asc limit 1),
      (select jsonb_build_object('type','exam','priority',2,'exam_id',e.id,'title',e.title,'action','start_exam',
                'ends_in_sec', greatest(0, floor(extract(epoch from (e.starts_at + make_interval(mins => e.duration_min) - now())))))
       from exams e
       where e.batch_id = v_batch and e.is_published
         and e.starts_at <= now() and now() < e.starts_at + make_interval(mins => e.duration_min)
         and not exists (select 1 from exam_attempts ea
                         where ea.exam_id = e.id and ea.student_id = p_student and ea.submitted_at is not null)
       order by e.starts_at asc limit 1),
      (select jsonb_build_object('type','upcoming_session','priority',3,'session_id',s.id,
                'subject',coalesce(sub.name,'Class'),'action','join_lobby',
                'starts_in_sec', floor(extract(epoch from (s.scheduled_start - now()))))
       from sessions s left join subjects sub on sub.id = s.subject_id
       where s.batch_id = v_batch and s.status = 'scheduled'
         and s.scheduled_start > now() and s.scheduled_start <= now() + interval '30 minutes'
       order by s.scheduled_start asc limit 1),
      (select jsonb_build_object('type','attendance','priority',4,'session_id',s.id,
                'subject',coalesce(sub.name,'Class'),'action','mark_attendance')
       from sessions s left join subjects sub on sub.id = s.subject_id
       where s.batch_id = v_batch and s.status in ('scheduled','live')
         and s.scheduled_start <= now() and s.scheduled_end >= now()
         and not exists (select 1 from attendance a where a.session_id = s.id and a.student_id = p_student)
       order by s.scheduled_start asc limit 1),
      (select jsonb_build_object('type','recording','priority',5,'content_id',c.id,'title',c.title,'action','watch_replay')
       from content_items c
       where c.kind = 'video' and c.is_published and c.course_id = v_course
         and (c.batch_id is null or c.batch_id = v_batch)
         and not exists (select 1 from video_progress vp where vp.content_id = c.id and vp.student_id = p_student)
       order by c.created_at desc limit 1),
      (select jsonb_build_object('type','weak_topic','priority',6,'topic_id',m.topic_id,
                'topic_name',t.name,'quiz_id',q.id,'mastery',m.mastery_pct,'action','practice')
       from mastery m
       join topics t on t.id = m.topic_id
       join lateral (
         select qq.id from quizzes qq
         where qq.topic_id = m.topic_id and qq.is_published and qq.course_id = v_course
           and (qq.batch_id is null or qq.batch_id = v_batch)
         order by qq.created_at desc limit 1
       ) q on true
       where m.student_id = p_student and m.mastery_pct < 50 and m.attempt_count >= 2
       order by m.mastery_pct asc limit 1),
      jsonb_build_object('type','browse','priority',7,'action','browse_library')
    ),
    'stats', jsonb_build_object(
      'attendance_pct', coalesce((
        select round(100.0 * count(*) filter (where a.status in ('present','late')) / nullif(count(*),0), 0)
        from sessions s
        left join attendance a on a.session_id = s.id and a.student_id = p_student
        where s.batch_id = v_batch and s.status <> 'cancelled'
          and s.scheduled_start >= now() - interval '30 days' and s.scheduled_start < now()
      ), 0),
      'mastery_pct', coalesce((
        select round(avg(mastery_pct), 0) from mastery where student_id = p_student and attempt_count >= 1
      ), 0),
      'rank', (
        select z.rnk from (
          select lw.student_id,
                 rank() over (order by lw.composite desc, lw.q_norm desc, lw.quiz_count desc, au.full_name asc) as rnk
          from leaderboard_weekly lw
          join app_users au on au.id = lw.student_id
          where lw.batch_id = v_batch
        ) z where z.student_id = p_student
      )
    ),
    'today', coalesce((
      select jsonb_agg(jsonb_build_object(
               'session_id', s.id, 'subject', coalesce(sub.name,'Class'),
               'start', s.scheduled_start, 'end', s.scheduled_end,
               'status', coalesce(a.status,
                          case when s.status = 'live' then 'live'
                               when s.status = 'cancelled' then 'cancelled'
                               when s.scheduled_end < now() then 'missed'
                               else 'upcoming' end)
             ) order by s.scheduled_start)
      from sessions s
      left join subjects sub on sub.id = s.subject_id
      left join attendance a on a.session_id = s.id and a.student_id = p_student
      where s.batch_id = v_batch
        and (s.scheduled_start at time zone 'Asia/Kolkata')::date = v_today
    ), '[]'::jsonb),
    'weak_topics', coalesce((
      select jsonb_agg(jsonb_build_object('topic_id', sub.topic_id, 'topic_name', sub.topic_name,
               'mastery', sub.mastery_pct, 'quiz_id', sub.quiz_id) order by sub.mastery_pct asc)
      from (
        select m.topic_id, t.name as topic_name, m.mastery_pct,
          (select q.id from quizzes q
           where q.topic_id = m.topic_id and q.is_published and q.course_id = v_course
             and (q.batch_id is null or q.batch_id = v_batch)
           order by q.created_at desc limit 1) as quiz_id
        from mastery m join topics t on t.id = m.topic_id
        where m.student_id = p_student and m.mastery_pct < 50 and m.attempt_count >= 2
        order by m.mastery_pct asc limit 3
      ) sub
    ), '[]'::jsonb),
    'continue', coalesce((
      select jsonb_agg(jsonb_build_object('content_id', z.content_id, 'title', z.title,
               'watched_pct', z.watched_pct, 'position_sec', z.position_sec) order by z.last_watched_at desc)
      from (
        select vp.content_id, c.title, vp.watched_pct, vp.position_sec, vp.last_watched_at
        from video_progress vp join content_items c on c.id = vp.content_id
        where vp.student_id = p_student and vp.watched_pct < 95 and c.kind = 'video' and c.is_published
        order by vp.last_watched_at desc limit 3
      ) z
    ), '[]'::jsonb),
    'streak', coalesce((
      select jsonb_build_object('current_days', current_days, 'best_days', best_days)
      from streaks where student_id = p_student
    ), jsonb_build_object('current_days', 0, 'best_days', 0)),
    'recent_badges', coalesce((
      select jsonb_agg(jsonb_build_object(
               'code', b.code, 'name', b.name, 'icon_path', b.icon_path, 'earned_at', be.earned_at)
             order by be.earned_at desc)
      from (
        select badge_id, earned_at from badge_earnings
        where student_id = p_student order by earned_at desc limit 3
      ) be
      join badges b on b.id = be.badge_id
    ), '[]'::jsonb)
  );
end
$function$;
