-- Phase 2 / Checkpoint 3: audit_log skeleton.
--
-- Every privileged write (edge fn / admin server action) is responsible for
-- inserting one row here describing what changed, who changed it, and the
-- before/after snapshots. No INSERT/UPDATE/DELETE policies — writes happen
-- via the service-role key (edge fns), which bypasses RLS. Admins can read.

create table public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.app_users(id),
  actor_role    text,
  action        text not null,
  entity_table  text not null,
  entity_id     text,
  before_data   jsonb,
  after_data    jsonb,
  ip_address    inet,
  user_agent    text,
  occurred_at   timestamptz not null default now()
);

create index audit_log_occurred_at_idx on public.audit_log (occurred_at desc);
create index audit_log_entity_idx      on public.audit_log (entity_table, entity_id);

alter table public.audit_log enable row level security;

create policy audit_log_admin_read
  on public.audit_log
  for select
  to authenticated
  using (private.is_admin());
