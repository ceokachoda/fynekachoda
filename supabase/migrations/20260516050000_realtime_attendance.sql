-- Phase 4 CP8 — enable Postgres CDC broadcasts for `public.attendance` via
-- the `supabase_realtime` publication.
--
-- Spec §5.8: the teacher's roster live tick comes from `attendance` INSERT
-- events streamed through Postgres CDC (no manual edge-fn broadcast call
-- needed). Authorization is handled by the teacher's own RLS policies —
-- Realtime evaluates the calling JWT's row visibility before forwarding the
-- event, so `attendance_teacher_batch` (CP2) cleanly gates cross-batch leak.

alter publication supabase_realtime add table public.attendance;
