-- Phase 4 CP3 — RPC accessor for QR HMAC secrets in Supabase Vault.
--
-- D-030 (rotating QR with HMAC-signed token) and D-104 (HMAC secrets rotated
-- quarterly with 24h grace). Secrets live in `vault.secrets` (encrypted at
-- rest by Supabase Vault). Edge functions need to read them but PostgREST
-- doesn't expose the `vault` schema directly, so we route through a single
-- SECURITY DEFINER RPC fn with EXECUTE locked to `service_role` only.
--
-- WHY HERE NOT `private` SCHEMA (cf. D-146): PostgREST only routes RPCs from
-- schemas listed in `db.api.schemas` (default: `public`, `graphql_public`).
-- Service-role calls `admin.rpc('get_qr_secret', { name })` from edge fns;
-- that requires the fn be in `public`. Advisor lints 0028 / 0029 only fire
-- when `anon` or `authenticated` can execute the fn — we REVOKE from PUBLIC
-- and grant only to `service_role`, so neither lint applies.
--
-- The secret VALUES are NOT in this migration. They are inserted via an
-- out-of-band `vault.create_secret(...)` call so the hex bytes never live in
-- a committed file. See CP3 acceptance ledger for the call shape.

create or replace function public.get_qr_secret(name text)
returns text
language sql
security definer
stable
set search_path = vault, public
as $$
  select decrypted_secret
  from vault.decrypted_secrets ds
  where ds.name = get_qr_secret.name
$$;

revoke execute on function public.get_qr_secret(text) from public;
revoke execute on function public.get_qr_secret(text) from anon;
revoke execute on function public.get_qr_secret(text) from authenticated;
grant  execute on function public.get_qr_secret(text) to   service_role;

comment on function public.get_qr_secret(text) is
  'Service-role-only RPC that reads a named secret from vault.decrypted_secrets. Used by attendance-qr-sign + attendance-qr-verify (D-030, D-104).';
