-- Phase 2 / Checkpoint 1: Identity schema.
-- Tables: app_users, user_roles, students, teachers + updated_at trigger.
-- No RLS yet (CP2 enables it). No audit_log yet (CP3). No batch FK yet (Phase 3).

create extension if not exists pgcrypto;

create table public.app_users (
  id                   uuid primary key default gen_random_uuid(),
  auth_user_id         uuid not null unique references auth.users(id) on delete cascade,
  full_name            text not null,
  email                text not null unique,
  phone                text,
  dob                  date,
  gender               text check (gender in ('male', 'female', 'other', 'prefer_not')),
  avatar_path          text,
  is_active            boolean not null default true,
  suspended_at         timestamptz,
  suspended_reason     text,
  must_change_password boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.user_roles (
  user_id    uuid not null references public.app_users(id) on delete cascade,
  role       text not null check (role in ('student', 'teacher', 'staff_admin', 'owner_admin')),
  granted_at timestamptz not null default now(),
  granted_by uuid references public.app_users(id),
  primary key (user_id, role)
);

create index user_roles_role_idx on public.user_roles (role);

create table public.students (
  user_id                uuid primary key references public.app_users(id) on delete cascade,
  batch_id               uuid,
  enrollment_no          text unique,
  school_name            text,
  board                  text,
  current_class          text,
  address                text,
  parent_phone_1         text,
  parent_phone_2         text,
  parent_consent_at      timestamptz,
  parent_consent_method  text check (parent_consent_method in ('verbal', 'written', 'form')),
  parent_consent_by      uuid references public.app_users(id),
  joined_at              timestamptz not null default now(),
  graduated_at           timestamptz
);

create table public.teachers (
  user_id  uuid primary key references public.app_users(id) on delete cascade,
  subjects text[] not null default array[]::text[],
  bio      text
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger app_users_set_updated_at
  before update on public.app_users
  for each row
  execute function public.set_updated_at();
