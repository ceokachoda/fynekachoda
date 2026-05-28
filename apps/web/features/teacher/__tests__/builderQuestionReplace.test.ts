// Phase 4 Track 4B — atomic question-replace plan for the exam + quiz builders
// (Phase-7 carry-over). A delete-then-insert leaves a published exam empty if
// the insert fails mid-way; the upsert-then-delete plan guarantees the exam
// never goes empty unless the teacher explicitly asks for it.

import { describe, expect, it } from "vitest";
import {
  buildExamQuestionReplacePlan,
  buildQuizQuestionReplacePlan,
  reorder,
} from "../builder-question-replace";

describe("buildExamQuestionReplacePlan", () => {
  it("orders sort_order by the input position", () => {
    const plan = buildExamQuestionReplacePlan("exam-1", ["q3", "q1", "q2"]);
    expect(plan.upsertRows).toEqual([
      { exam_id: "exam-1", question_id: "q3", sort_order: 0 },
      { exam_id: "exam-1", question_id: "q1", sort_order: 1 },
      { exam_id: "exam-1", question_id: "q2", sort_order: 2 },
    ]);
  });

  it("isEmpty=true when no questions selected", () => {
    const plan = buildExamQuestionReplacePlan("exam-1", []);
    expect(plan.isEmpty).toBe(true);
    expect(plan.upsertRows).toEqual([]);
  });

  it("deleteCondition keeps the kept set and removes everything else", () => {
    const plan = buildExamQuestionReplacePlan("exam-1", ["q1", "q2"]);
    expect(plan.deleteCondition.equals).toEqual({
      column: "exam_id",
      value: "exam-1",
    });
    expect(plan.deleteCondition.notIn).toEqual(["q1", "q2"]);
  });
});

describe("buildQuizQuestionReplacePlan", () => {
  it("mirrors the exam plan but with quiz_id column", () => {
    const plan = buildQuizQuestionReplacePlan("quiz-9", ["q1"]);
    expect(plan.upsertRows).toEqual([
      { quiz_id: "quiz-9", question_id: "q1", sort_order: 0 },
    ]);
    expect(plan.deleteCondition.equals.column).toBe("quiz_id");
  });
});

describe("reorder", () => {
  it("swaps with the next index when direction=+1", () => {
    expect(reorder(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
  });
  it("swaps with the previous index when direction=-1", () => {
    expect(reorder(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
  });
  it("no-ops at the top edge", () => {
    expect(reorder(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
  });
  it("no-ops at the bottom edge", () => {
    expect(reorder(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]);
  });
  it("returns a NEW array (does not mutate)", () => {
    const original = ["a", "b", "c"];
    const next = reorder(original, 0, 1);
    expect(next).not.toBe(original);
    expect(original).toEqual(["a", "b", "c"]);
  });
});
