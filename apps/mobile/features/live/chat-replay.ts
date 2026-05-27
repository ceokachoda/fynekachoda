// Phase 9 — pure chat-replay math (no React / RN imports on purpose so the
// Node test harness can import it directly).
//
// During recording playback the wrapped player reports its current time in
// VIDEO seconds (already scaled by playback speed), so replay is simply:
//   offset = posted_at - session.started_at   (clamped to >= 0)
//   show every message whose offset <= player's current time.
// No separate tick-rate is needed — a faster speed advances currentTime faster,
// which reveals messages faster, exactly as the spec wants.

export function computeReplayOffsetSec(postedAt: string, startedAt: string): number {
  const offset = (Date.parse(postedAt) - Date.parse(startedAt)) / 1000;
  return offset > 0 ? offset : 0;
}

// Attach an offsetSec (relative to started_at) to each message, sorted ascending.
export function withReplayOffsets<T extends { posted_at: string }>(
  messages: T[],
  startedAt: string,
): Array<T & { offsetSec: number }> {
  return messages
    .map((m) => ({ ...m, offsetSec: computeReplayOffsetSec(m.posted_at, startedAt) }))
    .sort((a, b) => a.offsetSec - b.offsetSec);
}

// Messages that should be visible at the given player time (in seconds).
export function messagesUpTo<T extends { offsetSec: number }>(
  items: T[],
  currentSec: number,
): T[] {
  return items.filter((m) => m.offsetSec <= currentSec + 0.001);
}

// Count of messages revealed strictly between two player times — used to detect
// when to auto-scroll the replay list.
export function countBetween<T extends { offsetSec: number }>(
  items: T[],
  fromSec: number,
  toSec: number,
): number {
  return items.filter((m) => m.offsetSec > fromSec + 0.001 && m.offsetSec <= toSec + 0.001).length;
}
