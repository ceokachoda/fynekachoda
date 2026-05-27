-- Phase 7 hardening — server-authoritative answer-write cut.
--
-- The student exam-answer write policies previously allowed any upsert while
-- the attempt was in-flight (submitted_at IS NULL), with no deadline check.
-- A student who set their device clock backward could keep the on-screen timer
-- alive and keep auto-saving answers past the real deadline; those answers were
-- still graded (exam-submit only flagged auto_submitted).
--
-- This adds the AUTHORITATIVE server-side cut: writes are rejected once
-- now() >= deadline_at. Pairs with the client-side server-time resync (the
-- exam screen now feeds TimerPill the live server offset). deadline_at lives on
-- exam_attempts (PK-indexed lookup → cheap at 1-2k concurrent writers).
--
-- A 30s grace absorbs network/clock jitter so an honest last-second save isn't
-- rejected (the client auto-submits at the real deadline regardless). coalesce
-- to 'infinity' means a (non-existent) null deadline never blocks a legit write.

drop policy if exists exam_answers_student_insert on public.exam_answers;
create policy exam_answers_student_insert on public.exam_answers
  for insert to authenticated
  with check (
    attempt_id in (
      select ea.id
      from public.exam_attempts ea
      where ea.student_id = private.current_app_user_id()
        and ea.submitted_at is null
        and now() < coalesce(ea.deadline_at, 'infinity'::timestamptz) + interval '30 seconds'
    )
  );

drop policy if exists exam_answers_student_update on public.exam_answers;
create policy exam_answers_student_update on public.exam_answers
  for update to authenticated
  using (
    attempt_id in (
      select ea.id
      from public.exam_attempts ea
      where ea.student_id = private.current_app_user_id()
        and ea.submitted_at is null
        and now() < coalesce(ea.deadline_at, 'infinity'::timestamptz) + interval '30 seconds'
    )
  )
  with check (
    attempt_id in (
      select ea.id
      from public.exam_attempts ea
      where ea.student_id = private.current_app_user_id()
        and ea.submitted_at is null
        and now() < coalesce(ea.deadline_at, 'infinity'::timestamptz) + interval '30 seconds'
    )
  );
