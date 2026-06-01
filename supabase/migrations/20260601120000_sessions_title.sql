-- Add an optional teacher-given class name (`title`) to sessions.
--
-- Context: offline (ad-hoc) classes were always created with subject_id=null,
-- so they showed to students/teachers as the generic "Class". Teachers now name
-- a class when scheduling it (ad-hoc + live both flow through
-- session-create-ad-hoc). The column is nullable because materialized recurring
-- sessions (public.materialize_sessions) carry no title and fall back to the
-- subject name or "Class" at the display layer. Requiredness is enforced in the
-- create UI; the edge fn accepts it as optional for backward compatibility with
-- already-shipped clients.

alter table public.sessions
  add column title text;

alter table public.sessions
  add constraint sessions_title_len_chk
  check (title is null or char_length(btrim(title)) between 1 and 120);

comment on column public.sessions.title is
  'Optional teacher-given class name shown to students + teachers. Falls back to the subject name, then "Class", when null. Set for ad-hoc/live sessions created via session-create-ad-hoc; null for materialized recurring sessions.';
