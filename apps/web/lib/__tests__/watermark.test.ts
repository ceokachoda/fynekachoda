import { describe, it, expect } from "vitest";
import { formatWatermark } from "@/lib/watermark";

describe("formatWatermark", () => {
  it("uses the first name + last 4 of phone", () => {
    expect(formatWatermark("Kaustab Borah", "+91-98765-43210")).toBe(
      "Kaustab • ••3210",
    );
  });

  it("falls back to Student • ••0000 if name+phone missing", () => {
    expect(formatWatermark(null, null)).toBe("Student • ••0000");
  });

  it("zero-pads when fewer than 4 digits in phone", () => {
    expect(formatWatermark("Aarav", "12")).toBe("Aarav • ••0000");
  });

  it("uses only digits — strips spaces, dashes, plus signs", () => {
    expect(formatWatermark("Diya R", "+91 987-654-3210")).toBe(
      "Diya • ••3210",
    );
  });
});
