// 12-hour time options on a 15-minute grid for the teacher scheduling + exam
// forms. Values stay "HH:MM" 24-hour (what the backend and Date parsing expect);
// labels are 12-hour "h:MM AM/PM" so the picker always reads naturally —
// a native <input type="time"> follows the OS locale and can render 24-hour,
// which this guarantees against.

export interface TimeSlot {
  /** 24-hour "HH:MM" — the stored value. */
  value: string;
  /** "1:30 PM" — what the teacher reads. */
  label: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

// Convert a 24-hour "HH:MM" into a 12-hour "h:MM AM/PM" label.
export function format12h(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number.parseInt(hStr ?? "", 10);
  const m = Number.parseInt(mStr ?? "", 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${period}`;
}

// All 96 quarter-hour slots in a day, labelled in 12-hour format.
export const TIME_SLOTS_15: TimeSlot[] = (() => {
  const out: TimeSlot[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const value = `${pad(h)}:${pad(m)}`;
      out.push({ value, label: format12h(value) });
    }
  }
  return out;
})();
