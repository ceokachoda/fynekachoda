-- Phase 9 post-QA hardening (2026-05-27) — raise-hand moderation gaps.
--
-- The original live_chat_rls (20260522060118) closed the chat-post vector for a
-- banned student (cm_insert) but left two raise-hand holes:
--
--  1. rh_insert had NO chat_bans exclusion, so a muted/banned student could still
--     raise their hand and appear in the teacher's queue — a moderation bypass
--     (a ban is meant to silence ALL of their interaction, not just chat text).
--     The rh_one_active_per_student unique index already caps it to one row, so
--     impact was bounded, but it still contradicts the moderation intent.
--
--  2. rh_update let a student write ANY column on their own row, including
--     resolved_by → a student could attribute a resolution to another user
--     (attribution-integrity). We now constrain the student branch so resolved_by
--     must be null or themselves; teachers retain full update (they set
--     resolved_by = themselves on resolve). The client's lower() only sets
--     resolved_at, so this does not affect normal use.

drop policy if exists rh_insert on public.raise_hand_events;
create policy rh_insert on public.raise_hand_events
  for insert to authenticated
  with check (
    student_id = private.current_app_user_id()
    and private.can_access_session(session_id)
    and private.is_session_live(session_id)
    and not exists (
      select 1 from public.chat_bans b
      where b.session_id = raise_hand_events.session_id
        and b.user_id = raise_hand_events.student_id
    )
  );

drop policy if exists rh_update on public.raise_hand_events;
create policy rh_update on public.raise_hand_events
  for update to authenticated
  using (
    student_id = private.current_app_user_id()
    or private.is_session_teacher(session_id)
  )
  with check (
    private.is_session_teacher(session_id)
    or (
      student_id = private.current_app_user_id()
      and (resolved_by is null or resolved_by = private.current_app_user_id())
    )
  );
