import { describe, expect, it } from "vitest";
import {
  computeStatuses,
  countAnswered,
  countFlagged,
  unansweredIndices,
  type AnswerLike,
} from "@/features/quiz/attemptHelpers";

const Q = (id: string) => ({ id });

function makeAnswers(
  rows: Array<[string, Partial<AnswerLike>]>,
): Map<string, AnswerLike> {
  const m = new Map<string, AnswerLike>();
  for (const [id, patch] of rows) {
    m.set(id, {
      selected_option_id: null,
      is_flagged: false,
      ...patch,
    });
  }
  return m;
}

describe("computeStatuses", () => {
  const qs = [Q("q1"), Q("q2"), Q("q3"), Q("q4")];

  it("returns all unanswered with an empty answer map", () => {
    expect(computeStatuses(qs, new Map())).toEqual([
      "unanswered",
      "unanswered",
      "unanswered",
      "unanswered",
    ]);
  });

  it("marks answered, flagged_unanswered, flagged_answered correctly", () => {
    const answers = makeAnswers([
      ["q1", { selected_option_id: "o1" }],
      ["q2", { is_flagged: true }],
      ["q3", { selected_option_id: "o7", is_flagged: true }],
      // q4 untouched
    ]);
    expect(computeStatuses(qs, answers)).toEqual([
      "answered",
      "flagged_unanswered",
      "flagged_answered",
      "unanswered",
    ]);
  });
});

describe("countAnswered + countFlagged", () => {
  it("counts only entries with a non-null selected_option_id", () => {
    const answers = makeAnswers([
      ["q1", { selected_option_id: "o1" }],
      ["q2", { is_flagged: true }],
      ["q3", { selected_option_id: "o2", is_flagged: true }],
    ]);
    expect(countAnswered(answers)).toBe(2);
  });

  it("counts only flagged entries", () => {
    const answers = makeAnswers([
      ["q1", { is_flagged: true }],
      ["q2", { selected_option_id: "o7" }],
      ["q3", { selected_option_id: "o8", is_flagged: true }],
    ]);
    expect(countFlagged(answers)).toBe(2);
  });
});

describe("unansweredIndices", () => {
  it("returns 0-based indices of unanswered questions, preserving order", () => {
    const qs = [Q("q1"), Q("q2"), Q("q3"), Q("q4")];
    const answers = makeAnswers([
      ["q1", { selected_option_id: "a" }],
      // q2 not set
      ["q3", { selected_option_id: "c" }],
      // q4 set but with explicit null (rare; should count as unanswered)
      ["q4", { selected_option_id: null, is_flagged: true }],
    ]);
    expect(unansweredIndices(qs, answers)).toEqual([1, 3]);
  });

  it("returns the empty array when every question is answered", () => {
    const qs = [Q("q1"), Q("q2")];
    const answers = makeAnswers([
      ["q1", { selected_option_id: "a" }],
      ["q2", { selected_option_id: "b" }],
    ]);
    expect(unansweredIndices(qs, answers)).toEqual([]);
  });
});
