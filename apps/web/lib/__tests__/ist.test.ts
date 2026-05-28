import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  greetingForIst,
  istYmd,
  formatIstTime,
  lastNIstDates,
} from "@/lib/ist";

describe("ist helpers", () => {
  beforeAll(() => {
    // Pin to 2026-05-28T07:30:00Z (= 13:00 IST → afternoon).
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-28T07:30:00.000Z"));
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it("returns Good afternoon at 13:00 IST", () => {
    expect(greetingForIst()).toBe("Good afternoon");
  });

  it("istYmd uses IST date, not UTC", () => {
    // 2026-05-27T23:00:00Z = 04:30 IST on 2026-05-28
    expect(istYmd(new Date("2026-05-27T23:00:00.000Z"))).toBe("2026-05-28");
  });

  it("formatIstTime renders 12-hour AM/PM", () => {
    expect(formatIstTime(new Date("2026-05-28T07:30:00.000Z"))).toBe("1:00 PM");
    expect(formatIstTime(new Date("2026-05-28T00:00:00.000Z"))).toBe("5:30 AM");
  });

  it("lastNIstDates returns N IST-dated days ending today", () => {
    const days = lastNIstDates(3);
    expect(days).toHaveLength(3);
    expect(days[2]).toBe("2026-05-28");
  });

  it("greeting changes by hour-of-day", () => {
    vi.setSystemTime(new Date("2026-05-28T01:00:00.000Z")); // 06:30 IST
    expect(greetingForIst()).toBe("Good morning");
    vi.setSystemTime(new Date("2026-05-28T13:00:00.000Z")); // 18:30 IST
    expect(greetingForIst()).toBe("Good evening");
    vi.setSystemTime(new Date("2026-05-28T19:00:00.000Z")); // 00:30 IST next day
    expect(greetingForIst()).toBe("Hi");
  });
});
