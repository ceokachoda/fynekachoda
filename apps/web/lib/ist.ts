// IST (UTC+05:30) date helpers — server times come back as UTC; everything the
// student sees is rendered in IST (D-074). Keep this layer thin so the rest of
// the codebase deals in plain Date / string and gets formatting for free.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function toIst(d: Date | string): Date {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Date(date.getTime() + IST_OFFSET_MS);
}

export function istYmd(d: Date | string): string {
  const ist = toIst(d);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const day = String(ist.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatIstTime(d: Date | string): string {
  const ist = toIst(d);
  const h = ist.getUTCHours();
  const m = String(ist.getUTCMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${ampm}`;
}

export function formatIstDay(d: Date | string): string {
  const ist = toIst(d);
  const today = istYmd(new Date());
  const target = istYmd(ist);
  if (today === target) return "Today";
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (istYmd(yesterday) === target) return "Yesterday";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${ist.getUTCDate()} ${months[ist.getUTCMonth()]}`;
}

export function istStartOfDay(d: Date = new Date()): Date {
  const ist = toIst(d);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - IST_OFFSET_MS);
}

export function istEndOfDay(d: Date = new Date()): Date {
  const start = istStartOfDay(d);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

export function lastNIstDates(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    out.push(istYmd(d));
  }
  return out;
}

export function formatIstWeekdayDate(d: Date = new Date()): string {
  const ist = toIst(d);
  const weekdays = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${weekdays[ist.getUTCDay()]}, ${ist.getUTCDate()} ${months[ist.getUTCMonth()]}`;
}

export function greetingForIst(d: Date = new Date()): string {
  const h = toIst(d).getUTCHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  if (h >= 17 && h < 22) return "Good evening";
  return "Hi";
}
