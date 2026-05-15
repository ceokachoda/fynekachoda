-- Phase 3 CP3: RLS for the 7 new tables + the teacher batch-scope read policy on public.students.
-- Helpers live in `private` schema per D-146 (not `public` as the phase-3 spec body shows).

-- 1. students: teacher reads students in their assigned batches.
create policy students_teacher_batch_read on public.students for select to authenticated
  using (
    private.has_role('teacher')
    and batch_id in (
      select bt.batch_id from public.batch_teachers bt
      where bt.teacher_id = private.current_app_user_id()
    )
  );

-- 2. courses + curriculum: all authenticated read; admin full control.
alter table public.courses  enable row level security;
alter table public.subjects enable row level security;
alter table public.chapters enable row level security;
alter table public.topics   enable row level security;

create policy courses_read  on public.courses  for select to authenticated using (is_active = true);
create policy subjects_read on public.subjects for select to authenticated using (true);
create policy chapters_read on public.chapters for select to authenticated using (true);
create policy topics_read   on public.topics   for select to authenticated using (true);

create policy courses_admin  on public.courses  for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy subjects_admin on public.subjects for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy chapters_admin on public.chapters for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy topics_admin   on public.topics   for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- 3. batches: student reads own; teacher reads assigned; admin all.
alter table public.batches enable row level security;

create policy batches_student_self on public.batches for select to authenticated
  using (
    id = (select batch_id from public.students where user_id = private.current_app_user_id())
  );

create policy batches_teacher_assigned on public.batches for select to authenticated
  using (
    private.has_role('teacher')
    and id in (
      select batch_id from public.batch_teachers
      where teacher_id = private.current_app_user_id()
    )
  );

create policy batches_admin on public.batches for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- 4. batch_teachers: teacher reads own rows; admin full.
alter table public.batch_teachers enable row level security;

create policy bt_teacher_self on public.batch_teachers for select to authenticated
  using (teacher_id = private.current_app_user_id());

create policy bt_admin on public.batch_teachers for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- 5. batch_schedule: mirrors batches (student own, teacher assigned, admin all).
alter table public.batch_schedule enable row level security;

create policy bs_student on public.batch_schedule for select to authenticated
  using (
    batch_id = (select batch_id from public.students where user_id = private.current_app_user_id())
  );

create policy bs_teacher on public.batch_schedule for select to authenticated
  using (
    private.has_role('teacher')
    and batch_id in (
      select batch_id from public.batch_teachers
      where teacher_id = private.current_app_user_id()
    )
  );

create policy bs_admin on public.batch_schedule for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
