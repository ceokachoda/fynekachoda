-- Phase 7 CP2 — RLS for exams + exam_questions + exam_attempts + exam_answers
-- + offline_test_scores.
--
-- Toughest rule: exam_questions.question_id may be joined to questions /
-- question_options, but Phase 6 already blocks student SELECT on those
-- tables — so the only way `is_correct` could leak is via the edge fn
-- (which sanitises). exam_attempts.question_snapshot includes
-- `correct_option_id` server-side; students reach the row only after
-- submission via `exam-attempt-result` (which strips it again, returning
-- option-level `is_correct` boolean by design — post-submit reveal is OK
-- per spec §8).
--
-- Helpers live in `private` schema (D-146). Writes go through edge fns
-- using service-role; teacher/admin reads stay in PostgREST.

alter table public.exams                enable row level security;
alter table public.exam_questions       enable row level security;
alter table public.exam_attempts        enable row level security;
alter table public.exam_answers         enable row level security;
alter table public.offline_test_scores  enable row level security;

-- ============================================================================
-- exams
-- ============================================================================

-- Student of the batch sees published exams once now is within the 24h
-- pre-window per spec §4 ("Visible 24h before start"). We only enforce
-- "is_published = true" at the policy layer; the 24h gate lives in the
-- edge fn (so admin overrides + manual publish remain in one place).
create policy exams_student_read on public.exams for select to authenticated
  using (
    is_published = true
    and batch_id = (
      select batch_id from public.students
      where user_id = private.current_app_user_id()
    )
  );

create policy exams_teacher_read on public.exams for select to authenticated
  using (
    private.has_role('teacher')
    and batch_id in (
      select batch_id from public.batch_teachers
      where teacher_id = private.current_app_user_id()
    )
  );

create policy exams_teacher_insert on public.exams for insert to authenticated
  with check (
    private.has_role('teacher')
    and created_by = private.current_app_user_id()
    and batch_id in (
      select batch_id from public.batch_teachers
      where teacher_id = private.current_app_user_id()
    )
  );

create policy exams_teacher_update on public.exams for update to authenticated
  using (
    private.has_role('teacher')
    and created_by = private.current_app_user_id()
  )
  with check (
    private.has_role('teacher')
    and created_by = private.current_app_user_id()
  );

create policy exams_teacher_delete on public.exams for delete to authenticated
  using (
    private.has_role('teacher')
    and created_by = private.current_app_user_id()
  );

create policy exams_admin_all on public.exams for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- ============================================================================
-- exam_questions
-- ============================================================================

-- Students CAN see exam_questions rows for exams in their batch — the
-- payload is just (exam_id, question_id, sort_order). Exposing question_id
-- alone is safe because student SELECT on `questions` / `question_options`
-- is blocked (Phase 6 RLS).
create policy exam_questions_student_read on public.exam_questions for select to authenticated
  using (
    exists (
      select 1 from public.exams e
      where e.id = exam_id
        and e.is_published = true
        and e.batch_id = (
          select batch_id from public.students
          where user_id = private.current_app_user_id()
        )
    )
  );

create policy exam_questions_teacher_read on public.exam_questions for select to authenticated
  using (private.has_role('teacher'));

create policy exam_questions_teacher_write on public.exam_questions for all to authenticated
  using (
    private.has_role('teacher')
    and exists (
      select 1 from public.exams e
      where e.id = exam_id and e.created_by = private.current_app_user_id()
    )
  )
  with check (
    private.has_role('teacher')
    and exists (
      select 1 from public.exams e
      where e.id = exam_id and e.created_by = private.current_app_user_id()
    )
  );

create policy exam_questions_admin_all on public.exam_questions for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- ============================================================================
-- exam_attempts
-- ============================================================================

create policy exam_attempts_student_read on public.exam_attempts for select to authenticated
  using (student_id = private.current_app_user_id());

-- Teacher sees attempts for any exam they own OR for any student in a
-- batch they teach.
create policy exam_attempts_teacher_read on public.exam_attempts for select to authenticated
  using (
    private.has_role('teacher')
    and (
      exists (
        select 1 from public.exams e
        where e.id = exam_id and e.created_by = private.current_app_user_id()
      )
      or exists (
        select 1 from public.exams e
        join public.batch_teachers bt
          on bt.batch_id = e.batch_id
         and bt.teacher_id = private.current_app_user_id()
        where e.id = exam_id
      )
    )
  );

create policy exam_attempts_admin_all on public.exam_attempts for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- No INSERT / UPDATE / DELETE policy for student or teacher: writes always
-- go through `exam-start`, `exam-tab-switch`, `exam-submit`, `exam-regrade`
-- (service role).

-- ============================================================================
-- exam_answers
-- ============================================================================

-- Student auto-saves their answers via PostgREST while the attempt is
-- in-flight. Once submitted_at IS NOT NULL the WITH CHECK fails and
-- further upserts are rejected.
create policy exam_answers_student_select on public.exam_answers for select to authenticated
  using (
    attempt_id in (
      select id from public.exam_attempts
      where student_id = private.current_app_user_id()
    )
  );

create policy exam_answers_student_insert on public.exam_answers for insert to authenticated
  with check (
    attempt_id in (
      select id from public.exam_attempts
      where student_id = private.current_app_user_id()
        and submitted_at is null
    )
  );

create policy exam_answers_student_update on public.exam_answers for update to authenticated
  using (
    attempt_id in (
      select id from public.exam_attempts
      where student_id = private.current_app_user_id()
        and submitted_at is null
    )
  )
  with check (
    attempt_id in (
      select id from public.exam_attempts
      where student_id = private.current_app_user_id()
        and submitted_at is null
    )
  );

create policy exam_answers_teacher_read on public.exam_answers for select to authenticated
  using (
    private.has_role('teacher')
    and attempt_id in (
      select a.id from public.exam_attempts a
      where exists (
              select 1 from public.exams e
              where e.id = a.exam_id and e.created_by = private.current_app_user_id()
            )
         or exists (
              select 1 from public.exams e
              join public.batch_teachers bt
                on bt.batch_id = e.batch_id
               and bt.teacher_id = private.current_app_user_id()
              where e.id = a.exam_id
            )
    )
  );

create policy exam_answers_admin_all on public.exam_answers for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- ============================================================================
-- offline_test_scores
-- ============================================================================

create policy ots_student_read on public.offline_test_scores for select to authenticated
  using (student_id = private.current_app_user_id());

create policy ots_teacher_read on public.offline_test_scores for select to authenticated
  using (
    private.has_role('teacher')
    and batch_id in (
      select batch_id from public.batch_teachers
      where teacher_id = private.current_app_user_id()
    )
  );

create policy ots_teacher_insert on public.offline_test_scores for insert to authenticated
  with check (
    private.has_role('teacher')
    and entered_by = private.current_app_user_id()
    and batch_id in (
      select batch_id from public.batch_teachers
      where teacher_id = private.current_app_user_id()
    )
  );

create policy ots_teacher_update on public.offline_test_scores for update to authenticated
  using (
    private.has_role('teacher')
    and entered_by = private.current_app_user_id()
  )
  with check (
    private.has_role('teacher')
    and entered_by = private.current_app_user_id()
  );

create policy ots_teacher_delete on public.offline_test_scores for delete to authenticated
  using (
    private.has_role('teacher')
    and entered_by = private.current_app_user_id()
  );

create policy ots_admin_all on public.offline_test_scores for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
