// Phase 4 Track 4B — pure pill-state transition map for the roster.
// Mirrors mobile D-164: tap the active pill → unmark; tap a different pill →
// correction (if currently marked) or manual-mark (if currently unmarked).

export type AttendanceStatus = "present" | "late" | "absent";

export type RosterAction =
  | { kind: "noop" }
  | { kind: "manual-mark"; status: AttendanceStatus } // currently unmarked
  | { kind: "unmark" } // tapped the active pill
  | { kind: "correction"; from: AttendanceStatus; to: AttendanceStatus };

export function nextRosterAction(
  current: AttendanceStatus | null,
  tapped: AttendanceStatus,
): RosterAction {
  if (current === null) return { kind: "manual-mark", status: tapped };
  if (current === tapped) return { kind: "unmark" };
  return { kind: "correction", from: current, to: tapped };
}
