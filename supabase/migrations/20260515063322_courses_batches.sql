-- Phase 3 CP1: courses, curriculum tree, batches, batch_teachers, batch_schedule.
-- Seeds 4 default courses + their canonical subject lists (D-012)
-- + one "Default Batch (rename me)" so Phase 3 CP2 can backfill students.batch_id NOT NULL.

create table public.courses (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.subjects (
  id         uuid primary key default gen_random_uuid(),
  course_id  uuid not null references public.courses(id) on delete cascade,
  name       text not null,
  sort_order int not null default 0,
  unique (course_id, name)
);

create table public.chapters (
  id         uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  name       text not null,
  sort_order int not null default 0,
  unique (subject_id, name)
);

create table public.topics (
  id         uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  name       text not null,
  sort_order int not null default 0,
  unique (chapter_id, name)
);

create table public.batches (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses(id) on delete restrict,
  name         text not null unique,
  starts_on    date not null,
  ends_on      date,
  capacity     int  not null default 80 check (capacity > 0),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create table public.batch_teachers (
  batch_id   uuid not null references public.batches(id) on delete cascade,
  teacher_id uuid not null references public.teachers(user_id) on delete cascade,
  primary key (batch_id, teacher_id)
);

create table public.batch_schedule (
  id         uuid primary key default gen_random_uuid(),
  batch_id   uuid not null references public.batches(id) on delete cascade,
  weekday    int  not null check (weekday between 0 and 6),
  start_time time not null,
  end_time   time not null check (end_time > start_time),
  subject_id uuid references public.subjects(id),
  is_active  boolean not null default true
);

create index batch_teachers_teacher_idx on public.batch_teachers (teacher_id);
create index batch_schedule_batch_idx on public.batch_schedule (batch_id);
create index batches_course_idx on public.batches (course_id);

insert into public.courses (code, name) values
  ('JEE_MAIN', 'JEE Main'),
  ('JEE_ADV',  'JEE Advanced'),
  ('NEET_UG',  'NEET UG'),
  ('CUET_UG',  'CUET UG');

insert into public.subjects (course_id, name, sort_order)
select c.id, s.name, s.ord
from public.courses c
join (values
  ('JEE_MAIN', 'Physics',      1),
  ('JEE_MAIN', 'Chemistry',    2),
  ('JEE_MAIN', 'Mathematics',  3),
  ('JEE_ADV',  'Physics',      1),
  ('JEE_ADV',  'Chemistry',    2),
  ('JEE_ADV',  'Mathematics',  3),
  ('NEET_UG',  'Physics',      1),
  ('NEET_UG',  'Chemistry',    2),
  ('NEET_UG',  'Biology',      3),
  ('CUET_UG',  'English',      1),
  ('CUET_UG',  'General Test', 2)
) as s(course_code, name, ord)
  on s.course_code = c.code;

insert into public.batches (course_id, name, starts_on, capacity)
select id, 'Default Batch (rename me)', current_date, 80
from public.courses
where code = 'NEET_UG'
limit 1;
