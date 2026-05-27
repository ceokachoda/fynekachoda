-- Phase 8 CP2: RLS for mastery + streaks.
-- Writes happen only through SECURITY DEFINER recompute fns / service role, so no
-- student/teacher write policies are needed. Helpers live in `private` (D-146).
-- Multiple permissive SELECT policies match the established project-wide pattern.

-- mastery
create policy mastery_self on public.mastery for select to authenticated
  using (student_id = private.current_app_user_id());

create policy mastery_teacher on public.mastery for select to authenticated
  using (
    private.has_role('teacher')
    and student_id in (
      select s.user_id from public.students s
      where s.batch_id in (
        select bt.batch_id from public.batch_teachers bt
        where bt.teacher_id = private.current_app_user_id()
      )
    )
  );

create policy mastery_admin on public.mastery for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- streaks
create policy streaks_self on public.streaks for select to authenticated
  using (student_id = private.current_app_user_id());

create policy streaks_teacher on public.streaks for select to authenticated
  using (
    private.has_role('teacher')
    and student_id in (
      select s.user_id from public.students s
      where s.batch_id in (
        select bt.batch_id from public.batch_teachers bt
        where bt.teacher_id = private.current_app_user_id()
      )
    )
  );

create policy streaks_admin on public.streaks for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
