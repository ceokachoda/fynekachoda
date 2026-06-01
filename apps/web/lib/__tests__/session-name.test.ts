import { describe, it, expect } from "vitest";
import { sessionDisplayName } from "@/lib/session-name";

describe("sessionDisplayName", () => {
  it("prefers the teacher-given title", () => {
    expect(sessionDisplayName("Mole concept revision", "Chemistry")).toBe(
      "Mole concept revision",
    );
  });

  it("falls back to the subject name when there is no title", () => {
    expect(sessionDisplayName(null, "Physics")).toBe("Physics");
    expect(sessionDisplayName(undefined, "Physics")).toBe("Physics");
    expect(sessionDisplayName("   ", "Physics")).toBe("Physics");
  });

  it("falls back to 'Class' when both are empty", () => {
    expect(sessionDisplayName(null, null)).toBe("Class");
    expect(sessionDisplayName("", "")).toBe("Class");
    expect(sessionDisplayName("  ", undefined)).toBe("Class");
  });

  it("trims surrounding whitespace on the title", () => {
    expect(sessionDisplayName("  Doubt class  ", null)).toBe("Doubt class");
  });
});
