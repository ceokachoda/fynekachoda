// Phase 4 Track 4B — pure FIFO ordering + dedup for the teacher's raise-hand
// queue. Mirrors the queue ordering the realtime hook produces, but as a
// stateless function for the test (so we don't have to render anything).

export interface RaiseHandRow {
  id: string;
  student_id: string;
  student_name: string;
  raised_at: string; // ISO
  resolved_at?: string | null;
}

export function orderQueue(rows: RaiseHandRow[]): RaiseHandRow[] {
  const live = rows.filter((r) => !r.resolved_at);
  return live
    .slice()
    .sort(
      (a, b) =>
        new Date(a.raised_at).getTime() - new Date(b.raised_at).getTime(),
    );
}

export function dropResolved(
  queue: RaiseHandRow[],
  resolvedId: string,
): RaiseHandRow[] {
  return queue.filter((h) => h.id !== resolvedId);
}

export function dropForBannedUser(
  queue: RaiseHandRow[],
  bannedStudentId: string,
): RaiseHandRow[] {
  return queue.filter((h) => h.student_id !== bannedStudentId);
}
