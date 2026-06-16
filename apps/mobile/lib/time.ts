// Format a wall-clock hour+minute as a 12-hour "h:MM AM/PM" label. The
// institute runs on IST and teachers expect a 12-hour clock, so the time
// pickers and slot grids render through this instead of raw 24-hour padding.
export function time12h(h: number, m: number): string {
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = m < 10 ? `0${m}` : `${m}`;
  return `${h12}:${mm} ${period}`;
}
