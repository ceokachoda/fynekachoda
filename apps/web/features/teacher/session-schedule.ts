// Scheduling helpers for the teacher "create class" sheet. Times are anchored
// to IST (Asia/Kolkata, fixed UTC+05:30 — India has no DST) regardless of the
// teacher's device timezone, because the institute runs on IST.

const IST_OFFSET = "+05:30";

// Combine a `YYYY-MM-DD` date and `HH:MM` time (both interpreted as IST wall
// clock) into a UTC ISO timestamp suitable for `sessions.scheduled_start`.
export function istDateTimeToIso(dateYmd: string, timeHHMM: string): string {
  return new Date(`${dateYmd}T${timeHHMM}:00${IST_OFFSET}`).toISOString();
}

export function addMinutesToIso(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60 * 1000).toISOString();
}

// Default form values: the next 15-minute mark from `now`, expressed as IST
// date + time fields for `<input type="date">` / `<input type="time">`.
export function defaultScheduleFields(now: Date = new Date()): {
  date: string;
  time: string;
} {
  const fifteenMin = 15 * 60 * 1000;
  const next = new Date(Math.ceil(now.getTime() / fifteenMin) * fifteenMin);
  const date = next.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const time = next.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return { date, time };
}

// Today's date in IST as `YYYY-MM-DD` — used as the `min` for the date input so
// a class can't be scheduled in the past by accident.
export function istTodayYmd(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}
