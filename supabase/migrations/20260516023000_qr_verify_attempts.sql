-- Phase 4 CP5 — rate-limit support for `attendance-qr-verify` (D-115: 2 verify
-- attempts / second / teacher).
--
-- Mirrors the CP4 `qr_sign_attempts` pattern but keyed on teacher only. Min
-- interval defaults to 500 ms, giving the documented 2-per-second steady
-- state. One row per teacher gets refreshed on every accepted verify.

create table public.qr_verify_attempts (
  teacher_id         uuid primary key references public.app_users(id) on delete cascade,
  last_verified_at   timestamptz not null default now()
);

alter table public.qr_verify_attempts enable row level security;

create policy qr_verify_attempts_admin_all on public.qr_verify_attempts
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create or replace function public.try_qr_verify_rate_limit(
  p_teacher_id uuid,
  p_min_interval interval default interval '500 milliseconds'
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rows int;
begin
  insert into public.qr_verify_attempts (teacher_id, last_verified_at)
  values (p_teacher_id, now())
  on conflict (teacher_id) do update
    set last_verified_at = now()
    where qr_verify_attempts.last_verified_at < now() - p_min_interval;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

revoke all on function public.try_qr_verify_rate_limit(uuid, interval) from public, anon, authenticated;
grant execute on function public.try_qr_verify_rate_limit(uuid, interval) to service_role;
