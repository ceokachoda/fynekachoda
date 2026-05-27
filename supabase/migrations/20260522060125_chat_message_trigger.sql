-- Phase 9 CP2 — chat BEFORE-INSERT trigger.
-- (1) Denormalizes the trustworthy author_name + author_role onto every row so
--     clients never join app_users (students can't read batch-mates' rows) and
--     can't spoof their displayed identity.
-- (2) Enforces the 5-messages-per-30s rate limit for kind='chat' (announcements
--     and service-role 'system' messages are exempt).
-- SECURITY DEFINER + pinned search_path (D-166). EXECUTE revoked from all client
-- roles (D-189) — triggers fire regardless of caller EXECUTE privilege.

create or replace function private.chat_message_before_insert()
returns trigger language plpgsql security definer set search_path = private, public as $$
declare
  v_count integer;
  v_name  text;
  v_role  text;
begin
  select full_name into v_name from public.app_users where id = NEW.author_id;
  NEW.author_name := coalesce(nullif(btrim(coalesce(v_name, '')), ''), 'Member');

  if exists (select 1 from public.user_roles where user_id = NEW.author_id and role in ('owner_admin','staff_admin')) then
    v_role := 'admin';
  elsif exists (select 1 from public.user_roles where user_id = NEW.author_id and role = 'teacher') then
    v_role := 'teacher';
  else
    v_role := 'student';
  end if;
  NEW.author_role := v_role;

  if NEW.kind = 'chat' then
    select count(*) into v_count
    from public.chat_messages
    where session_id = NEW.session_id
      and author_id = NEW.author_id
      and kind = 'chat'
      and posted_at > now() - interval '30 seconds';
    if v_count >= 5 then
      raise exception 'Sending messages too fast - please slow down.';
    end if;
  end if;

  return NEW;
end;
$$;

create trigger chat_message_before_insert
  before insert on public.chat_messages
  for each row execute function private.chat_message_before_insert();

revoke execute on function private.chat_message_before_insert() from public;
revoke execute on function private.chat_message_before_insert() from anon;
revoke execute on function private.chat_message_before_insert() from authenticated;
