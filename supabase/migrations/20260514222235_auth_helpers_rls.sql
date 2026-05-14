-- Phase 2 / Checkpoint 2: Auth helpers + RLS baseline.
--
-- Helper functions resolve the calling JWT (auth.uid()) to a public.app_users
-- row and answer role questions. They are SECURITY DEFINER + STABLE +
-- search_path-pinned so they can be called from inside RLS policies without
-- recursion and without search_path-confusion attacks.
--
-- RLS rules in this migration:
--   - authenticated user sees only their own row(s)
--   - admin (owner_admin OR staff_admin) sees / mutates everything
--   - anonymous sees nothing (no policy applies)
--   - service-role bypasses RLS by Supabase default (edge fns do privileged writes)
-- Teacher batch-scope read on `students` is intentionally deferred to Phase 3
-- where `batch_teachers` exists.

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.app_users where auth_user_id = auth.uid();
$$;

create or replace function public.has_role(r text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = public.current_app_user_id()
      and role = r
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('owner_admin') or public.has_role('staff_admin');
$$;

-- Harden the CP1 trigger fn (advisor lint 0011 — function_search_path_mutable).
alter function public.set_updated_at() set search_path = public;

alter table public.app_users  enable row level security;
alter table public.user_roles enable row level security;
alter table public.students   enable row level security;
alter table public.teachers   enable row level security;

-- app_users -----------------------------------------------------------------
create policy app_users_self_read
  on public.app_users
  for select
  to authenticated
  using (auth_user_id = auth.uid());

create policy app_users_admin_all
  on public.app_users
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- user_roles ----------------------------------------------------------------
create policy user_roles_self_read
  on public.user_roles
  for select
  to authenticated
  using (user_id = public.current_app_user_id());

create policy user_roles_admin_all
  on public.user_roles
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- students ------------------------------------------------------------------
create policy students_self_read
  on public.students
  for select
  to authenticated
  using (user_id = public.current_app_user_id());

create policy students_admin_all
  on public.students
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- teachers ------------------------------------------------------------------
create policy teachers_self_read
  on public.teachers
  for select
  to authenticated
  using (user_id = public.current_app_user_id());

create policy teachers_admin_all
  on public.teachers
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
