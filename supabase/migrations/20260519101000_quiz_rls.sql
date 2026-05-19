-- Phase 6 CP3 — RLS for the question bank + quiz tables.
--
-- Hardest rule (spec §11): question_options.is_correct must NEVER reach the
-- student client during an active attempt. We enforce two ways:
--   1. No student SELECT policy on `questions` / `question_options` /
--      `question_solutions`. Students rely on the sanitised payload from
--      `quiz-start` (no is_correct) and the post-submit payload from
--      `quiz-submit` / `quiz-attempt-result`.
--   2. Edge fns are service-role (RLS-bypass) so the sanitisation happens in
--      code, not in policy.
-- Helpers live in `private` schema (D-146).

alter table public.questions          enable row level security;
alter table public.question_options   enable row level security;
alter table public.question_solutions enable row level security;
alter table public.quizzes            enable row level security;
alter table public.quiz_questions     enable row level security;
alter table public.quiz_attempts      enable row level security;
alter table public.quiz_answers       enable row level security;

-- ============================================================================
-- questions
-- ============================================================================
create policy questions_teacher_read on public.questions for select to authenticated
  using (private.has_role('teacher'));

create policy questions_admin_all on public.questions for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy questions_teacher_insert on public.questions for insert to authenticated
  with check (
    private.has_role('teacher')
    and created_by = private.current_app_user_id()
  );

create policy questions_teacher_update on public.questions for update to authenticated
  using (
    private.has_role('teacher')
    and created_by = private.current_app_user_id()
  )
  with check (
    private.has_role('teacher')
    and created_by = private.current_app_user_id()
  );

create policy questions_teacher_delete on public.questions for delete to authenticated
  using (
    private.has_role('teacher')
    and created_by = private.current_app_user_id()
  );

-- ============================================================================
-- question_options
-- ============================================================================
create policy question_options_teacher_read on public.question_options for select to authenticated
  using (private.has_role('teacher'));

create policy question_options_admin_all on public.question_options for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy question_options_teacher_insert on public.question_options for insert to authenticated
  with check (
    private.has_role('teacher')
    and exists (
      select 1 from public.questions q
      where q.id = question_id
        and q.created_by = private.current_app_user_id()
    )
  );

create policy question_options_teacher_update on public.question_options for update to authenticated
  using (
    private.has_role('teacher')
    and exists (
      select 1 from public.questions q
      where q.id = question_id
        and q.created_by = private.current_app_user_id()
    )
  )
  with check (
    private.has_role('teacher')
    and exists (
      select 1 from public.questions q
      where q.id = question_id
        and q.created_by = private.current_app_user_id()
    )
  );

create policy question_options_teacher_delete on public.question_options for delete to authenticated
  using (
    private.has_role('teacher')
    and exists (
      select 1 from public.questions q
      where q.id = question_id
        and q.created_by = private.current_app_user_id()
    )
  );

-- ============================================================================
-- question_solutions
-- ============================================================================
create policy question_solutions_teacher_read on public.question_solutions for select to authenticated
  using (private.has_role('teacher'));

create policy question_solutions_admin_all on public.question_solutions for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy question_solutions_teacher_insert on public.question_solutions for insert to authenticated
  with check (
    private.has_role('teacher')
    and exists (
      select 1 from public.questions q
      where q.id = question_id
        and q.created_by = private.current_app_user_id()
    )
  );

create policy question_solutions_teacher_update on public.question_solutions for update to authenticated
  using (
    private.has_role('teacher')
    and exists (
      select 1 from public.questions q
      where q.id = question_id
        and q.created_by = private.current_app_user_id()
    )
  )
  with check (
    private.has_role('teacher')
    and exists (
      select 1 from public.questions q
      where q.id = question_id
        and q.created_by = private.current_app_user_id()
    )
  );

-- ============================================================================
-- quizzes
-- ============================================================================
create policy quizzes_student_read on public.quizzes for select to authenticated
  using (
    is_published = true
    and course_id = (
      select b.course_id
      from public.students s
      join public.batches  b on b.id = s.batch_id
      where s.user_id = private.current_app_user_id()
    )
    and (
      batch_id is null
      or batch_id = (
        select batch_id from public.students
        where user_id = private.current_app_user_id()
      )
    )
  );

create policy quizzes_teacher_read on public.quizzes for select to authenticated
  using (
    private.has_role('teacher')
    and (
      batch_id is null
      or batch_id in (
        select batch_id from public.batch_teachers
        where teacher_id = private.current_app_user_id()
      )
    )
  );

create policy quizzes_admin_all on public.quizzes for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy quizzes_teacher_insert on public.quizzes for insert to authenticated
  with check (
    private.has_role('teacher')
    and created_by = private.current_app_user_id()
  );

create policy quizzes_teacher_update on public.quizzes for update to authenticated
  using (
    private.has_role('teacher')
    and created_by = private.current_app_user_id()
  )
  with check (
    private.has_role('teacher')
    and created_by = private.current_app_user_id()
  );

create policy quizzes_teacher_delete on public.quizzes for delete to authenticated
  using (
    private.has_role('teacher')
    and created_by = private.current_app_user_id()
  );

-- ============================================================================
-- quiz_questions
-- ============================================================================
-- Students see quiz_questions rows for quizzes visible to them (piggyback on
-- the quizzes_student_read shape). Exposing question_id alone is safe — the
-- student still cannot SELECT from public.questions.
create policy quiz_questions_student_read on public.quiz_questions for select to authenticated
  using (
    exists (
      select 1 from public.quizzes q
      where q.id = quiz_id
        and q.is_published = true
        and q.course_id = (
          select b.course_id
          from public.students s
          join public.batches  b on b.id = s.batch_id
          where s.user_id = private.current_app_user_id()
        )
        and (
          q.batch_id is null
          or q.batch_id = (
            select batch_id from public.students
            where user_id = private.current_app_user_id()
          )
        )
    )
  );

create policy quiz_questions_teacher_read on public.quiz_questions for select to authenticated
  using (private.has_role('teacher'));

create policy quiz_questions_admin_all on public.quiz_questions for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy quiz_questions_teacher_insert on public.quiz_questions for insert to authenticated
  with check (
    private.has_role('teacher')
    and exists (
      select 1 from public.quizzes q
      where q.id = quiz_id
        and q.created_by = private.current_app_user_id()
    )
  );

create policy quiz_questions_teacher_delete on public.quiz_questions for delete to authenticated
  using (
    private.has_role('teacher')
    and exists (
      select 1 from public.quizzes q
      where q.id = quiz_id
        and q.created_by = private.current_app_user_id()
    )
  );

-- ============================================================================
-- quiz_attempts
-- ============================================================================
create policy quiz_attempts_student_read on public.quiz_attempts for select to authenticated
  using (student_id = private.current_app_user_id());

-- A teacher sees attempts on (a) quizzes they authored, or
-- (b) by students in batches they teach.
create policy quiz_attempts_teacher_read on public.quiz_attempts for select to authenticated
  using (
    private.has_role('teacher')
    and (
      exists (
        select 1 from public.quizzes q
        where q.id = quiz_id and q.created_by = private.current_app_user_id()
      )
      or student_id in (
        select s.user_id from public.students s
        where s.batch_id in (
          select batch_id from public.batch_teachers
          where teacher_id = private.current_app_user_id()
        )
      )
    )
  );

create policy quiz_attempts_admin_all on public.quiz_attempts for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- No INSERT / UPDATE / DELETE policy for student or teacher: writes always
-- go through edge fns (service role).

-- ============================================================================
-- quiz_answers
-- ============================================================================
-- Students auto-save by upserting their own answers while the attempt is
-- in-flight (submitted_at IS NULL).
create policy quiz_answers_student_select on public.quiz_answers for select to authenticated
  using (
    attempt_id in (
      select id from public.quiz_attempts
      where student_id = private.current_app_user_id()
    )
  );

create policy quiz_answers_student_insert on public.quiz_answers for insert to authenticated
  with check (
    attempt_id in (
      select id from public.quiz_attempts
      where student_id = private.current_app_user_id()
        and submitted_at is null
    )
  );

create policy quiz_answers_student_update on public.quiz_answers for update to authenticated
  using (
    attempt_id in (
      select id from public.quiz_attempts
      where student_id = private.current_app_user_id()
        and submitted_at is null
    )
  )
  with check (
    attempt_id in (
      select id from public.quiz_attempts
      where student_id = private.current_app_user_id()
        and submitted_at is null
    )
  );

create policy quiz_answers_teacher_read on public.quiz_answers for select to authenticated
  using (
    private.has_role('teacher')
    and attempt_id in (
      select a.id from public.quiz_attempts a
      where exists (
              select 1 from public.quizzes q
              where q.id = a.quiz_id and q.created_by = private.current_app_user_id()
            )
         or a.student_id in (
              select s.user_id from public.students s
              where s.batch_id in (
                select batch_id from public.batch_teachers
                where teacher_id = private.current_app_user_id()
              )
            )
    )
  );

create policy quiz_answers_admin_all on public.quiz_answers for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
