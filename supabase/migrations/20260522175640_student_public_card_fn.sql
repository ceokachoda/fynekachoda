-- Phase 10 CP8 — public profile card for a tapped leaderboard row. Exposes ONLY
-- name + batch + current streak + earned badges (no other PII, per spec §3.3 + the
-- Phase-10 privacy rule). SECURITY DEFINER + same-batch / teacher-of-batch / admin
-- guard (D-186): a student may only view a card for someone in their own batch.
create or replace function public.student_public_card(p_student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_me         uuid := private.current_app_user_id();
  v_my_batch   uuid;
  v_their_batch uuid;
begin
  if v_me is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  select batch_id into v_my_batch    from public.students where user_id = v_me;
  select batch_id into v_their_batch from public.students where user_id = p_student;
  if v_their_batch is null then
    raise exception 'not a student' using errcode = '42501';
  end if;
  if not (
    private.is_admin()
    or (v_my_batch is not null and v_my_batch = v_their_batch)
    or (private.has_role('teacher') and exists (
          select 1 from public.batch_teachers bt
          where bt.teacher_id = v_me and bt.batch_id = v_their_batch))
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'full_name', (select full_name from public.app_users where id = p_student),
    'batch_name', (select b.name from public.batches b where b.id = v_their_batch),
    'streak', coalesce((select current_days from public.streaks where student_id = p_student), 0),
    'badges', coalesce((
      select jsonb_agg(jsonb_build_object('code', bd.code, 'name', bd.name, 'icon_path', bd.icon_path)
             order by be.earned_at desc)
      from public.badge_earnings be join public.badges bd on bd.id = be.badge_id
      where be.student_id = p_student
    ), '[]'::jsonb)
  );
end
$function$;

revoke all on function public.student_public_card(uuid) from public, anon;
grant execute on function public.student_public_card(uuid) to authenticated, service_role;
