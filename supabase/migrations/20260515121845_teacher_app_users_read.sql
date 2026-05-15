-- Phase 3 CP10 fix: teachers can read app_users rows of students in their
-- assigned batches. Without this policy, the existing
-- `students_teacher_batch_read` policy lets a teacher embed students rows
-- from `batches`, but the embedded `app_users` (for `full_name`) gets filtered
-- out by RLS — so the mobile batch-detail roster rendered "—" for every name.
-- Narrowly scoped: not co-teachers, not anyone outside the teacher's
-- assigned batches.

create policy app_users_teacher_batch_read on public.app_users for select to authenticated
  using (
    private.has_role('teacher')
    and id in (
      select s.user_id from public.students s
      where s.batch_id in (
        select bt.batch_id from public.batch_teachers bt
        where bt.teacher_id = private.current_app_user_id()
      )
    )
  );
