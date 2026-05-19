-- Phase 5 CP3 — Storage buckets + lockdown policy.
--
-- Buckets are private (D-117). Mobile + admin clients NEVER read these
-- buckets directly; all access goes via signed URLs issued by edge fns
-- (`content-presign-upload` for write, in-app `createSignedUrl` for read on
-- PDFs, `yt-playback-sign` for videos). Service role bypasses RLS so edge
-- fns work fine.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('study-materials',  'study-materials',  false, 52428800, array['application/pdf','image/jpeg','image/png']),
  ('profile-pictures', 'profile-pictures', false,  5242880, array['image/jpeg','image/png','image/webp']);

-- Deny-all for non-service-role traffic (authenticated + anon). Storage RLS
-- is on by default; this is the explicit positive policy that says "no" so
-- there's no ambiguity if someone adds a permissive policy later by mistake.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'deny_all_content_objects'
  ) then
    create policy "deny_all_content_objects" on storage.objects
      for all to authenticated, anon
      using (false) with check (false);
  end if;
end $$;
