-- Phase 4 CP1 — sessions + attendance + corrections + activity_days
--
-- D-030 (rotating QR) + D-031 (replay protection via unique(session_id,student_id))
-- D-033 / D-034 (scan window + status bands enforced server-side in qr-verify)
-- D-037 (ad-hoc sessions first-class — sessions.is_ad_hoc)
-- D-038 (corrections require reason + audit row)
-- D-074 (activity_days = streak feeder, populated by attendance-qr-verify + manual marks)
--
-- RLS is intentionally NOT enabled here — lands in CP2 (separate migration so the
-- "apply structure, then policies" sequence stays auditable). The base advisor lints
-- after this migration will flag rls_disabled_in_public on all four tables; that is
-- expected and resolved in the next migration.

create table public.sessions (
  id              uuid primary key default gen_random_uuid(),
  batch_id        uuid not null references public.batches(id) on delete cascade,
  subject_id      uuid references public.subjects(id),
  scheduled_start timestamptz not null,
  scheduled_end   timestamptz not null,
  is_ad_hoc       boolean not null default false,
  is_live_class   boolean not null default false,
  yt_broadcast_id text,
  yt_video_id     text,
  status          text not null default 'scheduled'
                  check (status in ('scheduled','live','ended','cancelled')),
  started_at      timestamptz,
  ended_at        timestamptz,
  created_by      uuid references public.app_users(id),
  created_at      timestamptz not null default now(),
  constraint sessions_time_window_chk check (scheduled_end > scheduled_start)
);

create index sessions_batch_time_idx on public.sessions (batch_id, scheduled_start);
create index sessions_status_time_idx on public.sessions (status, scheduled_start)
  where status in ('scheduled','live');

create table public.attendance (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.sessions(id) on delete cascade,
  student_id   uuid not null references public.students(user_id) on delete cascade,
  status       text not null check (status in ('present','late','absent')),
  method       text not null check (method in ('qr','manual','correction')),
  marked_at    timestamptz not null default now(),
  marked_by    uuid references public.app_users(id),
  qr_token_jti text,
  notes        text,
  unique (session_id, student_id)
);

create index attendance_student_marked_idx on public.attendance (student_id, marked_at desc);
create index attendance_session_idx        on public.attendance (session_id);

create table public.attendance_corrections (
  id            uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendance(id) on delete cascade,
  prev_status   text not null check (prev_status in ('present','late','absent')),
  new_status    text not null check (new_status in ('present','late','absent')),
  reason        text not null check (length(btrim(reason)) > 0),
  changed_by    uuid not null references public.app_users(id),
  changed_at    timestamptz not null default now()
);

create index attendance_corrections_attendance_idx on public.attendance_corrections (attendance_id);

create table public.activity_days (
  student_id uuid not null references public.students(user_id) on delete cascade,
  day        date not null,
  primary key (student_id, day)
);

comment on table public.sessions is
  'One occurrence of a batch meeting — materialized from batch_schedule (CP7) or ad-hoc (D-037).';
comment on table public.attendance is
  'One row per (session, student). UNIQUE constraint is the replay-protection enforcer (D-031).';
comment on table public.attendance_corrections is
  'Audit trail per attendance status change. Reason required (D-038).';
comment on table public.activity_days is
  'Streak feeder (D-074): one row per day a student had a meaningful action.';
