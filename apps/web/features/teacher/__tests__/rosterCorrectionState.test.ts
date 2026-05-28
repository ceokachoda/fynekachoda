// Phase 4 Track 4B — pill-state transitions for the roster screen. Mobile
// D-164: tapping the active pill must offer "unmark", not no-op.

import { describe, expect, it } from "vitest";
import { nextRosterAction } from "../roster-pill-state";

describe("nextRosterAction (D-164)", () => {
  it("unmarked → tap present → manual-mark present", () => {
    expect(nextRosterAction(null, "present")).toEqual({
      kind: "manual-mark",
      status: "present",
    });
  });

  it("unmarked → tap late → manual-mark late", () => {
    expect(nextRosterAction(null, "late")).toEqual({
      kind: "manual-mark",
      status: "late",
    });
  });

  it("unmarked → tap absent → manual-mark absent", () => {
    expect(nextRosterAction(null, "absent")).toEqual({
      kind: "manual-mark",
      status: "absent",
    });
  });

  it("present → tap present → unmark (D-164 active-pill toggle)", () => {
    expect(nextRosterAction("present", "present")).toEqual({ kind: "unmark" });
  });

  it("late → tap late → unmark", () => {
    expect(nextRosterAction("late", "late")).toEqual({ kind: "unmark" });
  });

  it("absent → tap absent → unmark", () => {
    expect(nextRosterAction("absent", "absent")).toEqual({ kind: "unmark" });
  });

  it("present → tap late → correction(present→late)", () => {
    expect(nextRosterAction("present", "late")).toEqual({
      kind: "correction",
      from: "present",
      to: "late",
    });
  });

  it("late → tap absent → correction(late→absent)", () => {
    expect(nextRosterAction("late", "absent")).toEqual({
      kind: "correction",
      from: "late",
      to: "absent",
    });
  });

  it("absent → tap present → correction(absent→present)", () => {
    expect(nextRosterAction("absent", "present")).toEqual({
      kind: "correction",
      from: "absent",
      to: "present",
    });
  });
});
