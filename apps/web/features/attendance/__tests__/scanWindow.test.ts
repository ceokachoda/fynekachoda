import { describe, it, expect } from "vitest";
import { scanWindow } from "@/features/attendance/useTodaySessions";

describe("scanWindow", () => {
  // Class runs 10:00 → 11:00 UTC. Window opens 15 min before and stays open
  // for 15 min after the scheduled end.
  const start = "2026-05-28T10:00:00.000Z";
  const end = "2026-05-28T11:00:00.000Z";

  it("is 'before' before the 15-min pre-window", () => {
    expect(scanWindow(start, end, new Date("2026-05-28T09:30:00.000Z").getTime())).toBe(
      "before",
    );
  });

  it("is 'open' inside the 15-min pre-window", () => {
    expect(scanWindow(start, end, new Date("2026-05-28T09:50:00.000Z").getTime())).toBe(
      "open",
    );
  });

  it("is 'open' during the class", () => {
    expect(scanWindow(start, end, new Date("2026-05-28T10:30:00.000Z").getTime())).toBe(
      "open",
    );
  });

  it("is 'open' within 15 min after class end", () => {
    expect(scanWindow(start, end, new Date("2026-05-28T11:10:00.000Z").getTime())).toBe(
      "open",
    );
  });

  it("is 'after' more than 15 min after class end", () => {
    expect(scanWindow(start, end, new Date("2026-05-28T11:30:00.000Z").getTime())).toBe(
      "after",
    );
  });
});
