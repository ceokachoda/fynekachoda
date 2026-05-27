-- Phase 8 CP1: mastery + streaks tables.
-- mastery: rolling avg of last 5 submitted attempts per (student, topic), quiz+exam pooled (D-070).
-- streaks: consecutive IST-day activity streak (D-074); no freeze (D-075/D-140).
-- RLS enabled here (deny-all) so there is never an unprotected window; policies land in CP2.

create table public.mastery (
  student_id      uuid not null references public.students(user_id) on delete cascade,
  topic_id        uuid not null references public.topics(id) on delete cascade,
  mastery_pct     numeric not null default 0 check (mastery_pct between 0 and 100),
  attempt_count   int not null default 0 check (attempt_count >= 0),
  last_attempt_at timestamptz,
  updated_at      timestamptz not null default now(),
  primary key (student_id, topic_id)
);

-- Partial index serves the weak-topics scan (mastery_pct < 50). PK (student_id, topic_id)
-- already serves per-student lookups, so no separate (student_id) index is created.
create index mastery_weak_idx on public.mastery (student_id, mastery_pct) where mastery_pct < 60;

create table public.streaks (
  student_id          uuid primary key references public.students(user_id) on delete cascade,
  current_days        int not null default 0 check (current_days >= 0),
  best_days           int not null default 0 check (best_days >= 0),
  last_active         date,
  last_evaluated_date date,
  updated_at          timestamptz not null default now()
);

comment on table public.mastery is 'Phase 8: rolling avg of last 5 submitted attempts per (student, topic), quiz+exam pooled (D-070). Maintained by mastery_recompute().';
comment on table public.streaks is 'Phase 8: consecutive IST-day activity streak (D-074); no freeze (D-075/D-140). current_days resets on a missed day; best_days is sticky. last_evaluated_date is the recompute idempotency marker (D-106).';

alter table public.mastery enable row level security;
alter table public.streaks enable row level security;
