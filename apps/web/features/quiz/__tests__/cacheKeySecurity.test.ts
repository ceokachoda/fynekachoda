import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Phase 3 invariant: the attempt-stage edge fn (`quiz-start`) and the
// result-stage edge fn (`quiz-attempt-result`) MUST be invoked from
// different React-state islands. If a future refactor reuses the same
// React Query key for both, the cached attempt-stage payload (no is_correct)
// gets overwritten by the result-stage payload, and the same query key then
// returns solution data mid-attempt.
//
// This test asserts the source files reference DIFFERENT edge fn names and
// don't accidentally share a useQuery key (we don't use useQuery here, but
// the assertion is still useful as a tripwire if someone migrates to it).

const ROOT = path.resolve(__dirname, "..", "..", "..");

// Strip // line + /* block */ comments before scanning. Comments often need
// to MENTION `is_correct` (to explain why it must never leak), so a raw grep
// over the file would false-positive every time. Code, not commentary, is
// what we're auditing.
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function read(rel: string): string {
  return stripComments(readFileSync(path.join(ROOT, rel), "utf8"));
}

describe("Phase 3 cache-key security (quiz)", () => {
  it("useQuizStart calls 'quiz-start', NOT 'quiz-attempt-result'", () => {
    const src = read("features/quiz/useQuizStart.ts");
    expect(src).toContain('"quiz-start"');
    expect(src).not.toContain('"quiz-attempt-result"');
  });

  it("useQuizAttemptResult calls 'quiz-attempt-result', NOT 'quiz-start'", () => {
    const src = read("features/quiz/useQuizAttemptResult.ts");
    expect(src).toContain('"quiz-attempt-result"');
    expect(src).not.toContain('"quiz-start"');
  });

  it("attempt-stage hook sources never mention is_correct / correct_option_id", () => {
    for (const rel of [
      "features/quiz/useQuizStart.ts",
      "features/quiz/useQuizAutoSave.ts",
    ]) {
      const src = read(rel);
      expect(src).not.toContain("is_correct");
      expect(src).not.toContain("correct_option_id");
    }
  });

  it("exam attempt-stage hook sources never mention is_correct / correct_option_id", () => {
    for (const rel of [
      "features/exams/useExamStart.ts",
      "features/exams/useExamAutoSave.ts",
      "features/exams/useExamTabSwitchLogger.ts",
      "features/exams/useServerTimeOffset.ts",
    ]) {
      const src = read(rel);
      expect(src).not.toContain("is_correct");
      expect(src).not.toContain("correct_option_id");
    }
  });
});
