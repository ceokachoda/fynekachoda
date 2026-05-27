-- Phase 9 CP1 — live-class chat, raise-hand, and bans.
-- sessions already carry yt_broadcast_id / yt_video_id / is_live_class / status (Phase 4).
-- RLS is enabled here (deny-all until CP2 adds policies); service-role edge fns bypass it.

create table public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  author_id   uuid not null references public.app_users(id) on delete cascade,
  author_name text not null default '',
  author_role text not null default 'student',
  kind        text not null default 'chat' check (kind in ('chat','announcement','system')),
  body        text not null check (char_length(body) between 1 and 500),
  is_deleted  boolean not null default false,
  deleted_by  uuid references public.app_users(id),
  deleted_at  timestamptz,
  posted_at   timestamptz not null default now()
);
create index chat_session_time_idx on public.chat_messages (session_id, posted_at);
create index chat_session_live_idx on public.chat_messages (session_id, posted_at) where is_deleted = false;
create index chat_author_recent_idx on public.chat_messages (session_id, author_id, posted_at);
alter table public.chat_messages enable row level security;

create table public.raise_hand_events (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  student_id  uuid not null references public.students(user_id) on delete cascade,
  raised_at   timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.app_users(id)
);
create index rh_session_idx on public.raise_hand_events (session_id, raised_at);
create index rh_student_idx on public.raise_hand_events (student_id, raised_at);
create unique index rh_one_active_per_student on public.raise_hand_events (session_id, student_id) where resolved_at is null;
alter table public.raise_hand_events enable row level security;

create table public.chat_bans (
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id    uuid not null references public.app_users(id) on delete cascade,
  banned_at  timestamptz not null default now(),
  banned_by  uuid not null references public.app_users(id),
  primary key (session_id, user_id)
);
alter table public.chat_bans enable row level security;
