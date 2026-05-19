import { formatWatermark } from "./watermark";

describe("formatWatermark", () => {
  it("uses first name + last 4 of phone", () => {
    expect(formatWatermark("Aarav Sharma", "+91 98765 43210")).toBe(
      "Aarav • ••3210",
    );
  });
  it("falls back to ••0000 when phone is missing", () => {
    expect(formatWatermark("Priya", null)).toBe("Priya • ••0000");
  });
  it("falls back to ••0000 when phone has < 4 digits", () => {
    expect(formatWatermark("Riya", "1-2")).toBe("Riya • ••0000");
  });
  it("falls back to 'Student' when fullName is empty", () => {
    expect(formatWatermark("", "9999999999")).toBe("Student • ••9999");
    expect(formatWatermark(null, undefined)).toBe("Student • ••0000");
  });
  it("ignores non-digits inside the phone number", () => {
    expect(formatWatermark("Devansh Kumar", "(123) 456-7890 ext 5")).toBe(
      "Devansh • ••8905",
    );
  });
});
