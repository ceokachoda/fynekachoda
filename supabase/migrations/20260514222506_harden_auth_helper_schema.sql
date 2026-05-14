-- Phase 2 / Checkpoint 2 (harden): move auth helpers out of the public schema.
--
-- Supabase PostgREST exposes the `public` schema as RPC endpoints
-- (/rest/v1/rpc/<fn>). SECURITY DEFINER helpers placed in `public` are
-- callable by `anon` and `authenticated` over HTTP, which is flagged by
-- advisor lints 0028 / 0029. We move them to a `private` schema that is
-- not in the API allow-list, lock USAGE/EXECUTE to `authenticated`, and
-- re-point the 8 policies.
--
-- The helpers still run with the function owner's privileges (postgres)
-- and bypass RLS on the underlying tables — that is the whole point;
-- RLS policies reference them.

create schema if not exists private;

-- Defense-in-depth: even though PostgREST does not expose `private`,
-- explicitly restrict who can see / call into it.
revoke usage on schema private from public;
grant  usage on schema private to authenticated;

-- Drop policies first because they reference public.is_admin / public.current_app_user_id.
drop policy app_users_self_read   on public.app_users;
drop policy app_users_admin_all   on public.app_users;
drop policy user_roles_self_read  on public.user_roles;
drop policy user_roles_admin_all  on public.user_roles;
drop policy students_self_read    on public.students;
drop policy students_admin_all    on public.students;
drop policy teachers_self_read    on public.teachers;
drop policy teachers_admin_all    on public.teachers;

-- Drop the public-schema helpers; we recreate them in `private` with
-- search_path = private, public so cross-helper references resolve.
drop function public.is_admin();
drop function public.has_role(text);
drop function public.current_app_user_id();

create function private.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = private, public
as $$
  select id from public.app_users where auth_user_id = auth.uid();
$$;

create function private.has_role(r text)
returns boolean
language sql
stable
security definer
set search_path = private, public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = private.current_app_user_id()
      and role = r
  );
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = private, public
as $$
  select private.has_role('owner_admin') or private.has_role('staff_admin');
$$;

-- Lock execute permissions: only `authenticated` may call.
revoke execute on function private.current_app_user_id() from public;
revoke execute on function private.has_role(text)        from public;
revoke execute on function private.is_admin()            from public;

grant execute on function private.current_app_user_id() to authenticated;
grant execute on function private.has_role(text)        to authenticated;
grant execute on function private.is_admin()            to authenticated;

-- Recreate policies, now referencing the private helpers.

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
  using (private.is_admin())
  with check (private.is_admin());

-- user_roles ----------------------------------------------------------------
create policy user_roles_self_read
  on public.user_roles
  for select
  to authenticated
  using (user_id = private.current_app_user_id());

create policy user_roles_admin_all
  on public.user_roles
  for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- students ------------------------------------------------------------------
create policy students_self_read
  on public.students
  for select
  to authenticated
  using (user_id = private.current_app_user_id());

create policy students_admin_all
  on public.students
  for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- teachers ------------------------------------------------------------------
create policy teachers_self_read
  on public.teachers
  for select
  to authenticated
  using (user_id = private.current_app_user_id());

create policy teachers_admin_all
  on public.teachers
  for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());
