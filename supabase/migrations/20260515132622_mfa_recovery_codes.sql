-- Phase 3 CP11: TOTP recovery codes (closes Phase 2 §14 AC #3 "partial").
-- Stores SHA-256 hashes of admin-only recovery codes. Plaintext is shown to
-- the user once at enrollment and never persisted. Consuming a code marks
-- used_at and triggers a server-side delete of the user's TOTP factor — the
-- user re-enrolls and receives a fresh batch.

create table public.mfa_recovery_codes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.app_users(id) on delete cascade,
  code_hash   text not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index mfa_recovery_codes_user_idx on public.mfa_recovery_codes (user_id);
create unique index mfa_recovery_codes_user_hash_uniq
  on public.mfa_recovery_codes (user_id, code_hash);

alter table public.mfa_recovery_codes enable row level security;

-- Self-read: a user can see their own hashed rows (used as a sanity check from
-- the admin UI: "you have N unused codes left"). They cannot see plaintext —
-- only their own hashes — so this is information-equivalent to nothing for
-- anyone but the user themselves.
create policy mfa_recovery_self_read on public.mfa_recovery_codes
  for select to authenticated
  using (user_id = private.current_app_user_id());

-- Admin all: owner_admin can view + delete (e.g., during a future "Reset MFA"
-- flow). Edge functions bypass RLS via service-role; this policy exists for
-- future admin UI surface.
create policy mfa_recovery_admin_all on public.mfa_recovery_codes
  for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
