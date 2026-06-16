-- Push notifications infrastructure (2026-06-15).
--
-- Adds device-token storage for Expo (mobile) + Web Push (PWA), a per-session
-- "reminder sent" marker, and a 1-minute pg_cron job that pings the
-- `push-class-reminders` edge fn so students get a "class starting soon" nudge.
--
-- Writes to both token tables go through edge fns (push-register /
-- push-unregister) using the service-role key; RLS only lets a user SELECT their
-- own rows (CLAUDE.md: every user-data table has RLS on; privileged writes via
-- edge fns). Secret VALUES (VAPID keys, cron secret, fn base URL) are NOT in
-- this file — they are stored in Supabase Vault out-of-band so nothing secret is
-- ever committed (same pattern as the QR / playback accessors).

-- 1. Expo push tokens (mobile) ------------------------------------------------
create table if not exists public.device_push_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.app_users(id) on delete cascade,
  expo_push_token text not null unique,
  platform      text,                 -- 'ios' | 'android'
  device_name   text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);
create index if not exists device_push_tokens_user_active_idx
  on public.device_push_tokens (user_id) where is_active;

alter table public.device_push_tokens enable row level security;

-- SELECT-own only. All writes are service-role (edge fns) — no insert/update/
-- delete policy means authenticated callers cannot write directly.
drop policy if exists device_push_tokens_self_read on public.device_push_tokens;
create policy device_push_tokens_self_read on public.device_push_tokens
  for select to authenticated
  using (user_id = private.current_app_user_id());

comment on table public.device_push_tokens is
  'Expo push tokens, one row per (device install). Written only by push-register/push-unregister edge fns; RLS = SELECT own.';

-- 2. Web Push subscriptions (PWA) ---------------------------------------------
create table if not exists public.web_push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.app_users(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists web_push_subscriptions_user_active_idx
  on public.web_push_subscriptions (user_id) where is_active;

alter table public.web_push_subscriptions enable row level security;

drop policy if exists web_push_subscriptions_self_read on public.web_push_subscriptions;
create policy web_push_subscriptions_self_read on public.web_push_subscriptions
  for select to authenticated
  using (user_id = private.current_app_user_id());

comment on table public.web_push_subscriptions is
  'Browser Web Push subscriptions (endpoint + p256dh + auth). Written only by push-register/push-unregister edge fns; RLS = SELECT own.';

-- 3. Per-session "starting soon" reminder marker (idempotency) ----------------
alter table public.sessions
  add column if not exists reminder_sent_at timestamptz;

comment on column public.sessions.reminder_sent_at is
  'Set by push-class-reminders when the ~10-min "class starting soon" push has been sent. NULL = not yet reminded. Makes the cron idempotent.';

-- 4. Async HTTP so the cron job can call the edge fn --------------------------
create extension if not exists pg_net;

-- 5. Cron -> edge-fn bridge ----------------------------------------------------
-- SECURITY DEFINER so it can read Vault + call net.* . Null-checks the secrets
-- so it safely no-ops until they are provisioned. EXECUTE revoked from app
-- roles (only the cron runner / postgres owner invoke it).
create or replace function private.dispatch_class_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base_url text;
  v_secret   text;
  v_apikey   text;
  v_req_id   bigint;
begin
  select decrypted_secret into v_base_url
    from vault.decrypted_secrets where name = 'PUSH_FN_BASE_URL' limit 1;
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'PUSH_CRON_SECRET' limit 1;
  select decrypted_secret into v_apikey
    from vault.decrypted_secrets where name = 'PUSH_FN_APIKEY' limit 1;
  if v_base_url is null or v_secret is null or v_apikey is null then
    return;  -- not provisioned yet; nothing to do.
  end if;

  -- `apikey` lets the request through the Functions gateway; `X-Cron-Secret`
  -- is the actual auth the edge fn checks (verify_jwt is off there).
  select net.http_post(
           url     := v_base_url || '/push-class-reminders',
           headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'apikey', v_apikey,
                        'X-Cron-Secret', v_secret
                      ),
           body    := '{}'::jsonb,
           timeout_milliseconds := 8000
         ) into v_req_id;
end;
$$;

revoke all on function private.dispatch_class_reminders() from public;

-- Re-schedule idempotently (mirrors dashboard_cron pattern).
select cron.unschedule(jobid) from cron.job where jobname = 'push-class-reminders';
select cron.schedule('push-class-reminders', '* * * * *',
                     $$select private.dispatch_class_reminders();$$);
