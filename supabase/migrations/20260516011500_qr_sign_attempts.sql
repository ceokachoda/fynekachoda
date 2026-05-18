-- Phase 4 CP4 — rate-limit support for `attendance-qr-sign` (D-115: 1 sign /
-- 5s per student per session).
--
-- One row per `(session_id, student_id)` holds the timestamp of the last
-- accepted sign call. `public.try_qr_sign_rate_limit` does an atomic
-- insert-or-conditional-update and returns whether the attempt was accepted.
-- The row is created on first sign and refreshed on each subsequent accepted
-- sign. ON DELETE CASCADE on both FKs cleans up when a session or student is
-- removed; nothing else queries this table.
--
-- The RPC lives in `public` (not `private`) so the edge fn can reach it via
-- PostgREST — same pattern as `public.get_qr_secret` (Phase 4 CP3). EXECUTE
-- is REVOKEd from anon/authenticated and GRANTed only to service_role.

create table public.qr_sign_attempts (
  session_id      uuid not null references public.sessions(id) on delete cascade,
  student_id      uuid not null references public.students(user_id) on delete cascade,
  last_signed_at  timestamptz not null default now(),
  primary key (session_id, student_id)
);

alter table public.qr_sign_attempts enable row level security;

create policy qr_sign_attempts_admin_all on public.qr_sign_attempts
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create or replace function public.try_qr_sign_rate_limit(
  p_session_id uuid,
  p_student_id uuid,
  p_min_interval interval default interval '5 seconds'
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rows int;
begin
  insert into public.qr_sign_attempts (session_id, student_id, last_signed_at)
  values (p_session_id, p_student_id, now())
  on conflict (session_id, student_id) do update
    set last_signed_at = now()
    where qr_sign_attempts.last_signed_at < now() - p_min_interval;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

revoke all on function public.try_qr_sign_rate_limit(uuid, uuid, interval) from public, anon, authenticated;
grant execute on function public.try_qr_sign_rate_limit(uuid, uuid, interval) to service_role;
