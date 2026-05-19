-- Phase 5 CP13 — security advisor 0011 sweep.
--
-- `_content_items_updated_at` was created in 0090000 without an explicit
-- search_path, so Postgres lints it as mutable. Re-create with the standard
-- search_path pin we use on every trigger / SECURITY DEFINER function.

create or replace function public._content_items_updated_at() returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public._content_items_updated_at() from public, anon, authenticated;
grant  execute on function public._content_items_updated_at() to service_role;
