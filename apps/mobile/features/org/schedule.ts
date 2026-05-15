// Pure-module on purpose so jest can test it without touching react-native
// or supabase-js. Imported by useAssignedBatches.ts.

export interface ScheduleRow {
  weekday: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export interface NextSession {
  weekday: number;
  start_time: string;
  end_time: string;
  label: string;
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function pickNextSession(
  schedule: ScheduleRow[],
  now: Date = new Date(),
): NextSession | null {
  const active = schedule.filter((s) => s.is_active);
  if (active.length === 0) return null;
  const todayDow = now.getDay();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let best: { row: ScheduleRow; offset: number } | null = null;
  for (const s of active) {
    const parts = s.start_time.split(":");
    const hh = Number(parts[0] ?? 0);
    const mm = Number(parts[1] ?? 0);
    const startMin = hh * 60 + mm;
    let offset = (s.weekday - todayDow + 7) % 7;
    if (offset === 0 && startMin <= nowMin) offset = 7;
    if (!best || offset < best.offset) best = { row: s, offset };
  }
  if (!best) return null;
  return {
    weekday: best.row.weekday,
    start_time: best.row.start_time,
    end_time: best.row.end_time,
    label: `${WEEKDAY_SHORT[best.row.weekday]} ${best.row.start_time.slice(0, 5)}`,
  };
}
