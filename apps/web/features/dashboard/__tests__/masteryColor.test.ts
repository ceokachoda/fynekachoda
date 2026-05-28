import { describe, it, expect } from "vitest";
import { masteryColor } from "@/features/dashboard/useMastery";

describe("masteryColor", () => {
  it("returns red below 50", () => {
    expect(masteryColor(0)).toBe("#ef4444");
    expect(masteryColor(49)).toBe("#ef4444");
  });

  it("returns amber between 50 and 75", () => {
    expect(masteryColor(50)).toBe("#f59e0b");
    expect(masteryColor(74)).toBe("#f59e0b");
  });

  it("returns emerald at 75 and above", () => {
    expect(masteryColor(75)).toBe("#10b981");
    expect(masteryColor(100)).toBe("#10b981");
  });
});
