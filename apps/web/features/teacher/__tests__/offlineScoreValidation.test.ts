// Phase 4 Track 4B — offline-score-upsert input validation.

import { describe, expect, it } from "vitest";
import {
  offlineScoreFormSchema,
  validateScoreEntries,
} from "../offline-score-validation";

const goodForm = {
  batchId: "11111111-2222-3333-4444-555555555555",
  testName: "Weekly Test 12",
  testDate: "2026-05-28",
  maxScore: 100,
  subjectId: null,
};

describe("offlineScoreFormSchema", () => {
  it("accepts a fully-formed valid input", () => {
    expect(() => offlineScoreFormSchema.parse(goodForm)).not.toThrow();
  });

  it("rejects an empty test name", () => {
    expect(() =>
      offlineScoreFormSchema.parse({ ...goodForm, testName: "" }),
    ).toThrow();
  });

  it("rejects a non-YYYY-MM-DD date", () => {
    expect(() =>
      offlineScoreFormSchema.parse({ ...goodForm, testDate: "28/05/2026" }),
    ).toThrow();
  });

  it("rejects maxScore <= 0", () => {
    expect(() =>
      offlineScoreFormSchema.parse({ ...goodForm, maxScore: 0 }),
    ).toThrow();
  });

  it("rejects maxScore > 1000", () => {
    expect(() =>
      offlineScoreFormSchema.parse({ ...goodForm, maxScore: 1001 }),
    ).toThrow();
  });
});

describe("validateScoreEntries", () => {
  const rosterIds = ["s1", "s2", "s3"];

  it("skips empty + missing entries (only saves filled ones)", () => {
    const v = validateScoreEntries(
      rosterIds,
      { s1: "85", s2: "", s3: "" },
      {},
      100,
    );
    expect(v.ok).toBe(true);
    expect(v.entries).toEqual([{ student_id: "s1", score: 85 }]);
  });

  it("flags non-numeric scores", () => {
    const v = validateScoreEntries(
      rosterIds,
      { s1: "abc" },
      {},
      100,
    );
    expect(v.ok).toBe(false);
    expect(v.errors[0]).toContain("isn't a number");
  });

  it("flags scores outside [0, max]", () => {
    const v = validateScoreEntries(
      rosterIds,
      { s1: "150" },
      {},
      100,
    );
    expect(v.ok).toBe(false);
    expect(v.errors[0]).toContain("outside [0, 100]");
  });

  it("flags negative scores", () => {
    const v = validateScoreEntries(
      rosterIds,
      { s1: "-1" },
      {},
      100,
    );
    expect(v.ok).toBe(false);
    expect(v.errors[0]).toContain("outside");
  });

  it("attaches a non-empty notes string to its entry", () => {
    const v = validateScoreEntries(
      rosterIds,
      { s1: "90" },
      { s1: "Strong on calculus" },
      100,
    );
    expect(v.entries[0]).toEqual({
      student_id: "s1",
      score: 90,
      notes: "Strong on calculus",
    });
  });

  it("drops empty/whitespace-only notes", () => {
    const v = validateScoreEntries(
      rosterIds,
      { s1: "90" },
      { s1: "   " },
      100,
    );
    expect(v.entries[0]).toEqual({ student_id: "s1", score: 90 });
  });
});
