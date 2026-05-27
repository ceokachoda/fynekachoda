-- Phase 8 CP3: mastery_recompute() — rolling avg of last 5 submitted attempts per
-- (student, topic), quiz+exam pooled (D-070). Whole-attempt percentage per spec §6,
-- clamped per-attempt to [0,100] (negative marking can drive a raw score below 0).
--
-- Three modes:
--   mastery_recompute(p_student := S)                  -> all topics S has touched
--   mastery_recompute(p_student := S, p_topic_ids := T)-> just topics T (per-submit feeder)
--   mastery_recompute(p_full := true)                  -> every (student,topic) touched in 30d (cron)
--
-- Idempotent: a pure function of the attempt history, so re-running never drifts.
create or replace function public.mastery_recompute(
  p_student   uuid default null,
  p_topic_ids uuid[] default null,
  p_full      boolean default false
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  if not p_full and p_student is null then
    raise exception 'mastery_recompute requires p_student or p_full=true';
  end if;

  with targets as (
    -- explicit student + explicit topics (per-submit feeder)
    select p_student as student_id, tid as topic_id
    from unnest(coalesce(p_topic_ids, array[]::uuid[])) as tid
    where p_student is not null and p_topic_ids is not null

    union

    -- explicit student, derive every topic they have attempted
    select p_student, sub.topic_id
    from (
      select distinct q.topic_id
      from quiz_attempts qa
      join quiz_questions qq on qq.quiz_id = qa.quiz_id
      join questions q on q.id = qq.question_id
      where qa.student_id = p_student and qa.submitted_at is not null
      union
      select distinct q.topic_id
      from exam_attempts ea
      join exam_questions eq on eq.exam_id = ea.exam_id
      join questions q on q.id = eq.question_id
      where ea.student_id = p_student and ea.submitted_at is not null
    ) sub
    where p_student is not null and p_topic_ids is null and not p_full

    union

    -- full sweep: every (student, topic) touched in the last 30 days
    select sub.student_id, sub.topic_id
    from (
      select qa.student_id, q.topic_id
      from quiz_attempts qa
      join quiz_questions qq on qq.quiz_id = qa.quiz_id
      join questions q on q.id = qq.question_id
      where qa.submitted_at is not null and qa.submitted_at >= now() - interval '30 days'
      union
      select ea.student_id, q.topic_id
      from exam_attempts ea
      join exam_questions eq on eq.exam_id = ea.exam_id
      join questions q on q.id = eq.question_id
      where ea.submitted_at is not null and ea.submitted_at >= now() - interval '30 days'
    ) sub
    where p_full
  ),
  calc as (
    select
      t.student_id,
      t.topic_id,
      coalesce(avg(greatest(0, least(100, last5.pct))), 0) as mastery_pct,
      count(last5.pct)        as attempt_count,
      max(last5.submitted_at) as last_attempt_at
    from targets t
    left join lateral (
      select p.pct, p.submitted_at
      from (
        select (qa.score / nullif(qa.max_score, 0) * 100.0)::numeric as pct, qa.submitted_at
        from quiz_attempts qa
        where qa.student_id = t.student_id and qa.submitted_at is not null
          and exists (
            select 1 from quiz_questions qq join questions q on q.id = qq.question_id
            where qq.quiz_id = qa.quiz_id and q.topic_id = t.topic_id
          )
        union all
        select (ea.score / nullif(ea.max_score, 0) * 100.0)::numeric as pct, ea.submitted_at
        from exam_attempts ea
        where ea.student_id = t.student_id and ea.submitted_at is not null
          and exists (
            select 1 from exam_questions eq join questions q on q.id = eq.question_id
            where eq.exam_id = ea.exam_id and q.topic_id = t.topic_id
          )
      ) p
      order by p.submitted_at desc
      limit 5
    ) last5 on true
    group by t.student_id, t.topic_id
  )
  insert into mastery (student_id, topic_id, mastery_pct, attempt_count, last_attempt_at, updated_at)
  select student_id, topic_id, round(mastery_pct, 2), attempt_count, last_attempt_at, now()
  from calc
  where attempt_count > 0
  on conflict (student_id, topic_id) do update
    set mastery_pct     = excluded.mastery_pct,
        attempt_count   = excluded.attempt_count,
        last_attempt_at = excluded.last_attempt_at,
        updated_at      = now();

  get diagnostics v_rows = row_count;
  return v_rows;
end
$$;

revoke all on function public.mastery_recompute(uuid, uuid[], boolean) from public, anon, authenticated;
grant execute on function public.mastery_recompute(uuid, uuid[], boolean) to service_role;
