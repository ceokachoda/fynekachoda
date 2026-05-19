-- Phase 5 CP7 — generic vault accessor used by `yt-playback-sign`.
--
-- Mirrors the QR pattern (20260515160529_qr_secret_accessor.sql) but is
-- domain-generic — any service-role caller can read any named secret.
-- EXECUTE is locked to service_role; advisor lints 0028/0029 don't fire
-- because anon/authenticated cannot execute it.

create or replace function public.get_vault_secret(name text)
returns text
language sql
security definer
stable
set search_path = vault, public
as $$
  select decrypted_secret
  from vault.decrypted_secrets ds
  where ds.name = get_vault_secret.name
$$;

revoke execute on function public.get_vault_secret(text) from public;
revoke execute on function public.get_vault_secret(text) from anon;
revoke execute on function public.get_vault_secret(text) from authenticated;
grant  execute on function public.get_vault_secret(text) to   service_role;

comment on function public.get_vault_secret(text) is
  'Service-role-only RPC: reads a named secret from vault.decrypted_secrets. Used by yt-playback-sign for PLAYBACK_SIGN_SECRET_V1.';
