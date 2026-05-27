-- Phase 8: the activity-feeder trigger fn is invoked only by the trigger on
-- video_progress; it must never be reachable as a PostgREST RPC. Revoking EXECUTE
-- removes it from the API surface (clears the anon/authenticated SECURITY DEFINER
-- linter findings 0028/0029). Trigger firing does not require EXECUTE on the fn.
revoke all on function public.video_progress_activity() from public, anon, authenticated;
