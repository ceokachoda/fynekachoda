-- Phase 6 CP7 — private `exam-images` bucket for question prompts + option
-- images (D-058). Phase 7 graded exams will reuse the same bucket.
--
-- Limits: 5 MB per image, jpeg/png/webp only. Bucket is `public=false`
-- (D-117). The deny-all storage policy from
-- `20260518091000_storage_content_buckets.sql` (`deny_all_content_objects`)
-- already covers this bucket — non-service-role traffic gets 403. Edge fns
-- sign upload URLs via `quiz-image-presign` and read URLs via `quiz-start` /
-- `quiz-submit` / `quiz-attempt-result`.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('exam-images', 'exam-images', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
