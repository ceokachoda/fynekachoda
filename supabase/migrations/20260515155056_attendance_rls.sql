-- Phase 4 CP2 — RLS for sessions / attendance / attendance_corrections / activity_days
--
-- Mirrors the Phase 3 batch_rls policy shape:
--   * `{table}_admin_all` — admins (owner + staff) read/write everything.
--   * `{table}_student_self` — student reads own scope (own batch / own row).
--   * `{table}_teacher_batch` — teacher reads scope through batch_teachers.
--   * NO INSERT/UPDATE/DELETE policies for `authenticated` — every write goes
--     through an edge function with service-role (D-103). attendance-qr-verify,
--     attendance-correct, session-create-ad-hoc, materialize_sessions.
--
-- Helper fns live in `private` schema (D-146): `private.is_admin()`,
-- `private.has_role(text)`, `private.current_app_user_id()`.
--
-- Cross-table joins inside policies (e.g., attendance → sessions → batch_teachers)
-- run as the policy owner (postgres) — they don't recurse through RLS again.
-- Confirmed against Phase 3's `batches_teacher_assigned` policy which uses the
-- same shape.

alter table public.sessions               enable row level security;
alter table public.attendance             enable row level security;
alter table public.attendance_corrections enable row level security;
alter table public.activity_days          enable row level security;

-- ─── sessions ──────────────────────────────────────────────────────────────

create policy sessions_admin_all on public.sessions
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy sessions_student_self on public.sessions
  for select to authenticated
  using (
    batch_id = (
      select batch_id from public.students
      where user_id = private.current_app_user_id()
    )
  );

create policy sessions_teacher_batch on public.sessions
  for select to authenticated
  using (
    private.has_role('teacher')
    and batch_id in (
      select batch_id from public.batch_teachers
      where teacher_id = private.current_app_user_id()
    )
  );

-- ─── attendance ────────────────────────────────────────────────────────────

create policy attendance_admin_all on public.attendance
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy attendance_student_self on public.attendance
  for select to authenticated
  using (student_id = private.current_app_user_id());

create policy attendance_teacher_batch on public.attendance
  for select to authenticated
  using (
    private.has_role('teacher')
    and session_id in (
      select s.id
      from public.sessions s
      join public.batch_teachers bt on bt.batch_id = s.batch_id
      where bt.teacher_id = private.current_app_user_id()
    )
  );

-- ─── attendance_corrections ────────────────────────────────────────────────

create policy attendance_corrections_admin_all on public.attendance_corrections
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy attendance_corrections_teacher_batch on public.attendance_corrections
  for select to authenticated
  using (
    private.has_role('teacher')
    and attendance_id in (
      select a.id
      from public.attendance a
      join public.sessions s on s.id = a.session_id
      join public.batch_teachers bt on bt.batch_id = s.batch_id
      where bt.teacher_id = private.current_app_user_id()
    )
  );

-- ─── activity_days ─────────────────────────────────────────────────────────

create policy activity_days_admin_all on public.activity_days
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy activity_days_student_self on public.activity_days
  for select to authenticated
  using (student_id = private.current_app_user_id());
