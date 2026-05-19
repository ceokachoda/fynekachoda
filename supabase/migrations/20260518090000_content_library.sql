-- Phase 5 CP1 — content_items + video_progress + pdf_progress.
--
-- Library hierarchy: courses → subjects → chapters → topics → content_items.
-- content_items carries denormalised course_id for cheap RLS filtering, plus
-- topic_id for navigation and an optional batch_id (NULL = course-wide; D-065).
-- D-061 PDFs live in Storage under file_path; D-060 videos carry only the
-- YouTube video id and are wrapped by `yt-playback-sign` at playback time.

create table public.content_items (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('video','pdf','note')),
  title        text not null check (char_length(title) between 1 and 200),
  description  text,
  topic_id     uuid not null references public.topics(id) on delete restrict,
  batch_id     uuid references public.batches(id) on delete cascade,
  course_id    uuid not null references public.courses(id) on delete restrict,
  yt_video_id  text,
  file_path    text,
  file_size_bytes bigint,
  mime_type    text,
  duration_sec int,
  uploaded_by  uuid not null references public.app_users(id),
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index content_topic_kind_idx on public.content_items (topic_id, kind);
create index content_course_batch_idx on public.content_items (course_id, batch_id);
create index content_course_published_idx on public.content_items (course_id, is_published);
create index content_uploaded_by_idx on public.content_items (uploaded_by);
create unique index content_yt_video_id_uniq on public.content_items (yt_video_id) where yt_video_id is not null;

alter table public.content_items add constraint content_payload_ck check (
  (kind = 'video' and yt_video_id is not null and file_path is null)
  or (kind in ('pdf','note') and file_path is not null and yt_video_id is null)
);

create or replace function public._content_items_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger content_items_updated_at_trg
  before update on public.content_items
  for each row execute function public._content_items_updated_at();

create table public.video_progress (
  student_id      uuid not null references public.students(user_id) on delete cascade,
  content_id      uuid not null references public.content_items(id) on delete cascade,
  position_sec    int not null default 0 check (position_sec >= 0),
  watched_pct     numeric(5,2) not null default 0 check (watched_pct between 0 and 100),
  last_watched_at timestamptz not null default now(),
  primary key (student_id, content_id)
);

create index video_progress_recent_idx on public.video_progress (student_id, last_watched_at desc);

create table public.pdf_progress (
  student_id  uuid not null references public.students(user_id) on delete cascade,
  content_id  uuid not null references public.content_items(id) on delete cascade,
  last_page   int not null default 1 check (last_page >= 1),
  total_pages int,
  updated_at  timestamptz not null default now(),
  primary key (student_id, content_id)
);

create index pdf_progress_recent_idx on public.pdf_progress (student_id, updated_at desc);

comment on table public.content_items is
  'Library items (videos, pdfs, notes). Writes go through edge fns only. Reads RLS-scoped by course + batch (Phase 5 spec §4).';
comment on table public.video_progress is
  'Per-student playback position. Updated every ~15s by client.';
comment on table public.pdf_progress is
  'Per-student PDF page memory.';
