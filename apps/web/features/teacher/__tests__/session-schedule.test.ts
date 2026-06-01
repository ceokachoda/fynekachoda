import { describe, it, expect } from "vitest";
import {
  addMinutesToIso,
  defaultScheduleFields,
  istDateTimeToIso,
  istTodayYmd,
} from "@/features/teacher/session-schedule";

describe("istDateTimeToIso", () => {
  it("interprets the date + time as IST (UTC+5:30) and returns UTC", () => {
    // 16:00 IST == 10:30 UTC
    expect(istDateTimeToIso("2026-06-02", "16:00")).toBe(
      "2026-06-02T10:30:00.000Z",
    );
  });

  it("handles a near-midnight IST time crossing the UTC day boundary", () => {
    // 02:00 IST on Jun 2 == 20:30 UTC on Jun 1
    expect(istDateTimeToIso("2026-06-02", "02:00")).toBe(
      "2026-06-01T20:30:00.000Z",
    );
  });
});

describe("addMinutesToIso", () => {
  it("adds the duration to a start ISO", () => {
    expect(addMinutesToIso("2026-06-02T10:30:00.000Z", 60)).toBe(
      "2026-06-02T11:30:00.000Z",
    );
    expect(addMinutesToIso("2026-06-02T10:30:00.000Z", 90)).toBe(
      "2026-06-02T12:00:00.000Z",
    );
  });
});

describe("defaultScheduleFields", () => {
  it("rounds up to the next 15-minute mark, expressed in IST", () => {
    // 05:07 UTC == 10:37 IST → next quarter is 05:15 UTC == 10:45 IST
    const fields = defaultScheduleFields(new Date("2026-06-01T05:07:00.000Z"));
    expect(fields.date).toBe("2026-06-01");
    expect(fields.time).toBe("10:45");
  });

  it("keeps an exact 15-minute mark unchanged", () => {
    // 05:15 UTC == 10:45 IST, already on a quarter
    const fields = defaultScheduleFields(new Date("2026-06-01T05:15:00.000Z"));
    expect(fields.time).toBe("10:45");
  });
});

describe("istTodayYmd", () => {
  it("returns the IST calendar date even when UTC is on the previous day", () => {
    // 20:00 UTC Jun 1 == 01:30 IST Jun 2
    expect(istTodayYmd(new Date("2026-06-01T20:00:00.000Z"))).toBe("2026-06-02");
  });
});
