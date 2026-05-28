import { describe, it, expect } from "vitest";
import { computeStatus } from "@/features/exams/useStudentExams";

const baseExam = {
  id: "e1",
  title: "Mock",
  starts_at: "2026-05-28T10:00:00.000Z",
  duration_min: 60,
  is_published: true,
  results_released_at: null,
  result_release: "manual" as const,
  exam_attempts: [],
};

describe("computeStatus", () => {
  it("scheduled before start", () => {
    expect(
      computeStatus(baseExam, "stu", new Date("2026-05-28T09:30:00.000Z").getTime()),
    ).toBe("scheduled");
  });

  it("live while open", () => {
    expect(
      computeStatus(baseExam, "stu", new Date("2026-05-28T10:30:00.000Z").getTime()),
    ).toBe("live");
  });

  it("ended after duration with no attempt", () => {
    expect(
      computeStatus(baseExam, "stu", new Date("2026-05-28T11:30:00.000Z").getTime()),
    ).toBe("ended");
  });

  it("results_pending after submit on manual-release", () => {
    const e = {
      ...baseExam,
      exam_attempts: [
        {
          id: "a1",
          submitted_at: "2026-05-28T10:45:00Z",
          score: 8,
          max_score: 10,
          student_id: "stu",
        },
      ],
    };
    expect(computeStatus(e, "stu")).toBe("results_pending");
  });

  it("results_released immediately on instant-release", () => {
    const e = {
      ...baseExam,
      result_release: "instant" as const,
      exam_attempts: [
        {
          id: "a1",
          submitted_at: "2026-05-28T10:45:00Z",
          score: 8,
          max_score: 10,
          student_id: "stu",
        },
      ],
    };
    expect(computeStatus(e, "stu")).toBe("results_released");
  });

  it("results_released once results_released_at is set", () => {
    const e = {
      ...baseExam,
      results_released_at: "2026-05-28T12:00:00Z",
      exam_attempts: [
        {
          id: "a1",
          submitted_at: "2026-05-28T10:45:00Z",
          score: 8,
          max_score: 10,
          student_id: "stu",
        },
      ],
    };
    expect(computeStatus(e, "stu")).toBe("results_released");
  });

  it("ignores other students' attempts", () => {
    const e = {
      ...baseExam,
      exam_attempts: [
        {
          id: "a1",
          submitted_at: "2026-05-28T10:45:00Z",
          score: 8,
          max_score: 10,
          student_id: "OTHER",
        },
      ],
    };
    expect(
      computeStatus(e, "stu", new Date("2026-05-28T09:30:00.000Z").getTime()),
    ).toBe("scheduled");
  });
});
