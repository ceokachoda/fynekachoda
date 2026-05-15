-- Phase 3 CP2: students.batch_id becomes NOT NULL + FK + index.
-- Backfills existing rows to the "Default Batch (rename me)" seeded in CP1.

update public.students
set batch_id = (select id from public.batches where name = 'Default Batch (rename me)' limit 1)
where batch_id is null;

alter table public.students
  alter column batch_id set not null,
  add constraint students_batch_id_fkey
    foreign key (batch_id) references public.batches(id) on delete restrict;

create index students_batch_id_idx on public.students (batch_id);
