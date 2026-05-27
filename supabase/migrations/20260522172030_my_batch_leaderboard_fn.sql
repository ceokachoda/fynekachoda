-- Phase 10 CP3 — batch leaderboard RPC (the ONLY client path to the views).
--
-- SECURITY DEFINER + internal own-batch / teacher-of-batch / admin guard (D-186):
-- the views have SELECT revoked from clients, so this fn (owner = postgres) is the
-- mitigated, RPC-callable surface. Tie-breaker EXACTLY per spec §3.5:
--   composite desc, q_norm desc, quiz_count desc, full_name asc.
-- Returns name + last-2 phone (D-073) only — no other PII. set search_path=public.
-- p_batch=null => caller's own batch (student path). p_batch set => teacher/admin path.

create or replace function public.my_batch_leaderboard(
  p_scope text default 'weekly',
  p_batch uuid default null
)
returns table (
  student_id  uuid,
  full_name   text,
  phone_last2 text,
  q_norm      numeric,
  a_norm      numeric,
  s_norm      numeric,
  quiz_count  int,
  composite   numeric,
  rank        int,
  is_me       boolean
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_me    uuid := private.current_app_user_id();
  v_batch uuid;
  v_scope text := case when lower(coalesce(p_scope, 'weekly')) = 'alltime' then 'alltime' else 'weekly' end;
begin
  if v_me is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  if p_batch is null then
    select s.batch_id into v_batch from public.students s where s.user_id = v_me;
    if v_batch is null then
      raise exception 'caller is not a student in a batch' using errcode = '42501';
    end if;
  else
    v_batch := p_batch;
    if not (
      private.is_admin()
      or exists (select 1 from public.students s where s.user_id = v_me and s.batch_id = v_batch)
      or (private.has_role('teacher') and exists (
            select 1 from public.batch_teachers bt
            where bt.teacher_id = v_me and bt.batch_id = v_batch))
    ) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;

  return query
  with board as (
    select lb.student_id, lb.q_norm, lb.a_norm, lb.s_norm, lb.quiz_count, lb.composite
    from (
      select * from public.leaderboard_weekly  where v_scope = 'weekly'
      union all
      select * from public.leaderboard_alltime where v_scope = 'alltime'
    ) lb
    where lb.batch_id = v_batch
  ),
  ranked as (
    select b.student_id, au.full_name,
           case when au.phone is not null and length(au.phone) >= 2
                then right(au.phone, 2) else null end as phone_last2,
           b.q_norm, b.a_norm, b.s_norm, b.quiz_count, b.composite,
           rank() over (order by b.composite desc, b.q_norm desc, b.quiz_count desc, au.full_name asc) as rnk
    from board b
    join public.app_users au on au.id = b.student_id
  )
  select r.student_id, r.full_name, r.phone_last2,
         r.q_norm, r.a_norm, r.s_norm, r.quiz_count, r.composite,
         r.rnk::int, (r.student_id = v_me)
  from ranked r
  order by r.rnk asc, r.full_name asc;
end
$function$;

revoke all on function public.my_batch_leaderboard(text, uuid) from public, anon;
grant execute on function public.my_batch_leaderboard(text, uuid) to authenticated, service_role;
