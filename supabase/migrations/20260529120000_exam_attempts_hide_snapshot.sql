-- Hide `exam_attempts.question_snapshot` from logged-in users.
--
-- The snapshot pins each question's `correct_option_id` at attempt start
-- (D-052/D-180, so live bank edits don't change in-flight grading). Postgres
-- RLS filters ROWS, not COLUMNS — and the `exam_attempts_student_read` policy
-- grants a student their own attempt row. With a table-wide SELECT grant, a
-- student could therefore read the answer key mid-exam via a direct PostgREST
-- select on `question_snapshot`. (Verified: `authenticated` held table-level
-- SELECT on all 14 columns.)
--
-- Fix: revoke the broad SELECT and re-grant SELECT on every column EXCEPT
-- `question_snapshot`. RLS row policies are unchanged. Grading + result fns run
-- as service_role (BYPASS grants — unaffected). The only legitimate non-grading
-- reader, the teacher results board, now reads the keys through the
-- `exam-answer-keys` edge fn (teacher/batch-teacher/admin scoped).
--
-- This mirrors the established pattern (e.g. `question_options.is_correct` is
-- never directly readable by students — they have no read policy there).

revoke select on public.exam_attempts from authenticated;
revoke select on public.exam_attempts from anon;

-- All columns EXCEPT question_snapshot. Students still read their own attempt's
-- status/score (post-release) and teachers read scores for analytics; nobody
-- reads the frozen answer key directly anymore.
grant select (
  id,
  exam_id,
  student_id,
  started_at,
  deadline_at,
  submitted_at,
  auto_submitted,
  tab_switch_count,
  score,
  max_score,
  correct_count,
  wrong_count,
  skipped_count
) on public.exam_attempts to authenticated;

-- `anon` has no RLS read policy on exam_attempts (can't read any row), so it
-- needs no column grant. Leaving it ungranted tightens the surface.

-- Nudge PostgREST to reload its schema cache so the new privileges take effect
-- immediately.
notify pgrst, 'reload schema';
