-- Phase 10 CP7 — private badge-assets bucket (svg + png, 100 KB). Badge icons are
-- fetched by the mobile UI via short-lived signed URLs from the `badge-icon-sign`
-- edge fn — NEVER a public URL. The global `deny_all_content_objects` storage policy
-- (Phase 5) already blocks all anon/authenticated direct access to storage.objects,
-- so this bucket inherits the deny-all baseline; service-role (the sign fn + upload
-- script) bypasses RLS.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('badge-assets', 'badge-assets', false, 102400, array['image/svg+xml','image/png'])
on conflict (id) do nothing;
