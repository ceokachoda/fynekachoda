import { describe, it, expect } from "@jest/globals";
import { pickNextSession } from "./schedule";

type Row = {
  weekday: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

const SUNDAY_NOON = new Date("2026-05-17T12:00:00");
const monPm = (h = 18, m = 0): Row => ({
  weekday: 1,
  start_time: `${pad(h)}:${pad(m)}:00`,
  end_time: "21:00:00",
  is_active: true,
});
function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

describe("pickNextSession", () => {
  it("returns null when no schedule rows are given", () => {
    expect(pickNextSession([], SUNDAY_NOON)).toBeNull();
  });

  it("returns null when every row is inactive", () => {
    const rows: Row[] = [{ ...monPm(), is_active: false }];
    expect(pickNextSession(rows, SUNDAY_NOON)).toBeNull();
  });

  it("picks tomorrow's session when it is the only active one", () => {
    const next = pickNextSession([monPm(18, 0)], SUNDAY_NOON);
    expect(next?.weekday).toBe(1);
    expect(next?.label).toBe("Mon 18:00");
  });

  it("rolls today-but-already-past sessions to next week (offset 7)", () => {
    // Sunday noon, with a Sunday 9:00 schedule that has already ended.
    const earlySunday: Row = {
      weekday: 0,
      start_time: "09:00:00",
      end_time: "11:00:00",
      is_active: true,
    };
    // A Monday session would be 1 day away (offset 1) — should win over offset 7.
    const next = pickNextSession([earlySunday, monPm(18, 0)], SUNDAY_NOON);
    expect(next?.weekday).toBe(1);
  });

  it("keeps today's session when start_time is still in the future", () => {
    // Sunday noon, Sunday 18:00 schedule → today, not next week.
    const laterSunday: Row = {
      weekday: 0,
      start_time: "18:00:00",
      end_time: "20:00:00",
      is_active: true,
    };
    const next = pickNextSession([laterSunday], SUNDAY_NOON);
    expect(next?.weekday).toBe(0);
    expect(next?.label).toBe("Sun 18:00");
  });

  it("picks the earliest upcoming session among many", () => {
    const wed: Row = {
      weekday: 3,
      start_time: "06:00:00",
      end_time: "09:00:00",
      is_active: true,
    };
    const next = pickNextSession([wed, monPm(18, 0)], SUNDAY_NOON);
    // Monday (offset 1) beats Wednesday (offset 3).
    expect(next?.weekday).toBe(1);
  });

  it("ignores inactive rows when active ones are present", () => {
    const inactiveMonday: Row = { ...monPm(6, 0), is_active: false };
    const activeTuesday: Row = {
      weekday: 2,
      start_time: "18:00:00",
      end_time: "21:00:00",
      is_active: true,
    };
    const next = pickNextSession([inactiveMonday, activeTuesday], SUNDAY_NOON);
    expect(next?.weekday).toBe(2);
  });
});
