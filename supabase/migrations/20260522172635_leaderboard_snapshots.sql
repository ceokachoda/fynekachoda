-- Phase 10 CP5 — weekly leaderboard snapshots (historical "best week" source + the
-- topper/runner-up award ledger). One row per (batch, week). The UNIQUE
-- (batch_id, period_start) is the rollover idempotency guard (D-106) AND covers the
-- batch_id FK (leading column). Reads: admin-all + teacher-of-batch (NO student read,
-- NO client write — only the SECURITY DEFINER rollover/service role writes it).

create table public.leaderboard_snapshots (
  id           uuid primary key default gen_random_uuid(),
  batch_id     uuid not null references public.batches(id) on delete cascade,
  period_start date not null,
  period_end   date not null,
  rankings     jsonb not null,  -- [{student_id, full_name, composite, rank}]
  created_at   timestamptz not null default now(),
  unique (batch_id, period_start)
);

alter table public.leaderboard_snapshots enable row level security;

create policy ls_admin on public.leaderboard_snapshots
  for select to authenticated using (private.is_admin());

create policy ls_teacher on public.leaderboard_snapshots
  for select to authenticated
  using (
    private.has_role('teacher')
    and exists (
      select 1 from public.batch_teachers bt
      where bt.batch_id = leaderboard_snapshots.batch_id
        and bt.teacher_id = private.current_app_user_id()
    )
  );
