-- Phase 5 CP2 — RLS for content_items, video_progress, pdf_progress.
--
-- Writes always go through edge functions (D-128). Reads are RLS-scoped.
-- Helpers live in `private` schema (D-146); admin policy uses
-- `private.is_admin()`, role checks use `private.has_role()`.

alter table public.content_items  enable row level security;
alter table public.video_progress enable row level security;
alter table public.pdf_progress   enable row level security;

-- Student: published items inside their course, where batch_id is NULL (course-wide)
-- or matches their batch.
create policy content_student_read on public.content_items
  for select to authenticated
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

-- Teacher: all course-wide content + content in batches they teach.
create policy content_teacher_read on public.content_items
  for select to authenticated
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

-- Admin: full RWX. All admin writes are still funneled through edge fns so
-- audit_log captures actor/before/after — RLS just permits the path.
create policy content_admin_all on public.content_items
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- Progress tables: student self-read/self-write only.
create policy vp_self_select on public.video_progress for select to authenticated
  using (student_id = private.current_app_user_id());
create policy vp_self_upsert on public.video_progress for insert to authenticated
  with check (student_id = private.current_app_user_id());
create policy vp_self_update on public.video_progress for update to authenticated
  using (student_id = private.current_app_user_id())
  with check (student_id = private.current_app_user_id());

create policy pp_self_select on public.pdf_progress for select to authenticated
  using (student_id = private.current_app_user_id());
create policy pp_self_upsert on public.pdf_progress for insert to authenticated
  with check (student_id = private.current_app_user_id());
create policy pp_self_update on public.pdf_progress for update to authenticated
  using (student_id = private.current_app_user_id())
  with check (student_id = private.current_app_user_id());

-- Admin can read progress for moderation/analytics.
create policy vp_admin_read on public.video_progress for select to authenticated
  using (private.is_admin());
create policy pp_admin_read on public.pdf_progress for select to authenticated
  using (private.is_admin());
