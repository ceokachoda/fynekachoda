import { describe, expect, it } from "vitest";
import {
  computeRemainingMs,
  formatRemainingMmSs,
} from "@/features/exams/useServerTimeOffset";

describe("computeRemainingMs", () => {
  it("computes positive remaining when deadline is ahead", () => {
    const deadline = 1_000_000;
    const deviceNow = 990_000;
    const offset = 0;
    expect(computeRemainingMs(deadline, deviceNow, offset)).toBe(10_000);
  });

  it("clamps to 0 when past the deadline", () => {
    const deadline = 1_000_000;
    const deviceNow = 1_500_000;
    expect(computeRemainingMs(deadline, deviceNow, 0)).toBe(0);
  });

  it("applies a positive offset (device clock is behind server)", () => {
    // server time = deviceNow + offset; if offset > 0 (device behind), the
    // student loses NO additional time — the timer counts down with the
    // server's faster clock.
    const deadline = 1_000_000;
    const deviceNow = 950_000;
    const offset = 30_000; // server is 30s ahead of device
    // remaining = deadline - (device + offset) = 1_000_000 - 980_000 = 20_000
    expect(computeRemainingMs(deadline, deviceNow, offset)).toBe(20_000);
  });

  it("applies a negative offset (device clock is AHEAD of server, attacker)", () => {
    // Device has been wound forward 60s to cheat — server-time resync
    // corrects with a negative offset, so the timer reflects the true
    // server clock + the student still loses real time.
    const deadline = 1_000_000;
    const deviceNow = 990_000;
    const offset = -60_000; // server is 60s BEHIND device (device is fast)
    // remaining = 1_000_000 - (990_000 - 60_000) = 1_000_000 - 930_000 = 70_000
    expect(computeRemainingMs(deadline, deviceNow, offset)).toBe(70_000);
  });
});

describe("formatRemainingMmSs", () => {
  it("formats 0", () => {
    expect(formatRemainingMmSs(0)).toBe("00:00");
  });
  it("formats one second", () => {
    expect(formatRemainingMmSs(1_000)).toBe("00:01");
  });
  it("formats one minute", () => {
    expect(formatRemainingMmSs(60_000)).toBe("01:00");
  });
  it("formats nine minutes thirty seconds", () => {
    expect(formatRemainingMmSs(9 * 60_000 + 30_000)).toBe("09:30");
  });
  it("formats over ten minutes", () => {
    expect(formatRemainingMmSs(72 * 60_000 + 7_000)).toBe("72:07");
  });
  it("caps at 99:59", () => {
    expect(formatRemainingMmSs(150 * 60_000)).toBe("99:00");
  });
  it("clamps negative input to 00:00", () => {
    expect(formatRemainingMmSs(-5_000)).toBe("00:00");
  });
});
