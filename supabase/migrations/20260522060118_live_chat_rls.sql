-- Phase 9 CP2 — live-class scope helpers + RLS policies + Realtime publication.
-- Helpers live in `private` (NOT exposed via PostgREST) and are SECURITY DEFINER
-- so their internal joins over sessions/students/batch_teachers bypass those
-- tables' own RLS (no recursion). search_path pinned per D-166.

create or replace function private.can_access_session(p_session uuid)
returns boolean language sql stable security definer set search_path = private, public as $$
  select exists (
    select 1 from public.sessions s
    where s.id = p_session and (
      s.batch_id = (select st.batch_id from public.students st where st.user_id = private.current_app_user_id())
      or (private.has_role('teacher') and exists (
        select 1 from public.batch_teachers bt
        where bt.batch_id = s.batch_id and bt.teacher_id = private.current_app_user_id()))
      or private.is_admin()
    )
  );
$$;

create or replace function private.is_session_teacher(p_session uuid)
returns boolean language sql stable security definer set search_path = private, public as $$
  select exists (
    select 1 from public.sessions s
    where s.id = p_session and (
      (private.has_role('teacher') and exists (
        select 1 from public.batch_teachers bt
        where bt.batch_id = s.batch_id and bt.teacher_id = private.current_app_user_id()))
      or private.is_admin()
    )
  );
$$;

create or replace function private.is_session_live(p_session uuid)
returns boolean language sql stable security definer set search_path = private, public as $$
  select exists (select 1 from public.sessions s where s.id = p_session and s.status = 'live');
$$;

revoke execute on function private.can_access_session(uuid) from public;
revoke execute on function private.is_session_teacher(uuid) from public;
revoke execute on function private.is_session_live(uuid) from public;
grant execute on function private.can_access_session(uuid) to authenticated;
grant execute on function private.is_session_teacher(uuid) to authenticated;
grant execute on function private.is_session_live(uuid) to authenticated;

-- chat_messages: any session member reads (no is_deleted gate so soft-deletes
-- propagate over Realtime); members insert their own message while the session
-- is live and they are not banned; only teachers may post announcements;
-- 'system' is reserved for service-role inserts (yt-broadcast-stop).
create policy cm_read on public.chat_messages
  for select to authenticated
  using (private.can_access_session(session_id));

create policy cm_insert on public.chat_messages
  for insert to authenticated
  with check (
    author_id = private.current_app_user_id()
    and private.can_access_session(session_id)
    and private.is_session_live(session_id)
    and not exists (
      select 1 from public.chat_bans b
      where b.session_id = chat_messages.session_id and b.user_id = chat_messages.author_id
    )
    and (
      kind = 'chat'
      or (kind = 'announcement' and private.is_session_teacher(session_id))
    )
  );

-- raise_hand: students raise their own hand while live; teachers (and the
-- student) read; teachers (and the student) resolve.
create policy rh_insert on public.raise_hand_events
  for insert to authenticated
  with check (
    student_id = private.current_app_user_id()
    and private.can_access_session(session_id)
    and private.is_session_live(session_id)
  );

create policy rh_read on public.raise_hand_events
  for select to authenticated
  using (
    student_id = private.current_app_user_id()
    or private.is_session_teacher(session_id)
  );

create policy rh_update on public.raise_hand_events
  for update to authenticated
  using (
    student_id = private.current_app_user_id()
    or private.is_session_teacher(session_id)
  )
  with check (
    student_id = private.current_app_user_id()
    or private.is_session_teacher(session_id)
  );

-- chat_bans: a user sees their own ban (instant input-disable) and teachers see
-- the bans they manage. All WRITES go through the audited chat-ban edge fn
-- (service role) — no client write policy here on purpose (D-172).
create policy cb_read on public.chat_bans
  for select to authenticated
  using (
    user_id = private.current_app_user_id()
    or private.is_session_teacher(session_id)
  );

-- Realtime: chat + raised hands are broadcast to subscribers; chat_bans is
-- published so a banned student's client disables its input the instant the
-- ban row lands (RLS still scopes each row to who may SELECT it).
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.raise_hand_events;
alter publication supabase_realtime add table public.chat_bans;
