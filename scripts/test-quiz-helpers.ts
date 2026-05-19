// Phase 6 — unit smoke for the pure helpers used by quiz edge fns.
//
// Run with `pnpm test:quiz`. Exit 0 on green, 1 on the first failed
// expectation.

import {
  containsMath,
  gradeAnswer,
  gradeAttempt,
  MATH_DELIMITER_REGEX,
  reconcileOrder,
  shuffleStable,
} from "../apps/functions/_shared/quiz-marking.ts";

let failures = 0;
function ok(name: string, pass: boolean, detail?: unknown) {
  if (pass) {
    console.log("  ✓", name);
  } else {
    console.log("  ✗", name, detail !== undefined ? detail : "");
    failures++;
  }
}

function deepEq<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const MARKS = { marks_correct: 4, marks_wrong: -1, marks_skip: 0 };

function main() {
  console.log("gradeAnswer:");
  ok(
    "skipped → marks_skip",
    deepEq(
      gradeAnswer({ question_id: "q1", selected_option_id: null, correct_option_id: "o1" }, MARKS),
      { question_id: "q1", outcome: "skipped", points: 0 },
    ),
  );
  ok(
    "correct → marks_correct",
    deepEq(
      gradeAnswer({ question_id: "q1", selected_option_id: "o1", correct_option_id: "o1" }, MARKS),
      { question_id: "q1", outcome: "correct", points: 4 },
    ),
  );
  ok(
    "wrong (option mismatch) → marks_wrong",
    deepEq(
      gradeAnswer({ question_id: "q1", selected_option_id: "o2", correct_option_id: "o1" }, MARKS),
      { question_id: "q1", outcome: "wrong", points: -1 },
    ),
  );
  ok(
    "no correct option in bank counts as wrong if anything selected",
    deepEq(
      gradeAnswer({ question_id: "q1", selected_option_id: "o1", correct_option_id: null }, MARKS),
      { question_id: "q1", outcome: "wrong", points: -1 },
    ),
  );

  console.log("\ngradeAttempt (4-q mixed):");
  const attempt = gradeAttempt(
    [
      { question_id: "a", selected_option_id: "a1", correct_option_id: "a1" }, // +4
      { question_id: "b", selected_option_id: "b2", correct_option_id: "b1" }, // -1
      { question_id: "c", selected_option_id: null, correct_option_id: "c1" }, //  0
      { question_id: "d", selected_option_id: "d1", correct_option_id: "d1" }, // +4
    ],
    MARKS,
  );
  ok("score", attempt.score === 7, attempt.score);
  ok("max_score", attempt.max_score === 16, attempt.max_score);
  ok("correct_count", attempt.correct_count === 2, attempt.correct_count);
  ok("wrong_count", attempt.wrong_count === 1, attempt.wrong_count);
  ok("skipped_count", attempt.skipped_count === 1, attempt.skipped_count);
  ok("per_question length", attempt.per_question.length === 4);

  console.log("\ngradeAttempt (0/0 + non-default marks):");
  const zero = gradeAttempt([], MARKS);
  ok("empty score", zero.score === 0 && zero.max_score === 0);
  const pos = gradeAttempt(
    [
      { question_id: "x", selected_option_id: null, correct_option_id: "x1" },
    ],
    { marks_correct: 1, marks_wrong: 0, marks_skip: 0 },
  );
  ok("skip with 0 penalty", pos.score === 0 && pos.max_score === 1);

  console.log("\ncontainsMath / MATH_DELIMITER_REGEX:");
  ok("$x$ inline", containsMath("Let $x = 2$"));
  ok("$$ block", containsMath("$$\\int e^{-x^2}dx$$"));
  ok("\\( ... \\)", containsMath("Solve \\( a + b \\) for…"));
  ok("\\[ ... \\]", containsMath("Limit:\\[ \\lim x \\to 0 \\]"));
  ok("no math at all", !containsMath("Just plain text without any math."));
  ok("dollar amount only", !containsMath("It costs $ today"));
  ok("regex exported", MATH_DELIMITER_REGEX.test("$y$"));

  console.log("\nshuffleStable:");
  const arr = ["a", "b", "c", "d"];
  const copy = shuffleStable(arr);
  ok("does not mutate input", arr.join(",") === "a,b,c,d");
  ok("same length", copy.length === 4);
  ok("same elements", copy.slice().sort().join(",") === "a,b,c,d");
  // Deterministic with constant rng.
  const det1 = shuffleStable(arr, () => 0); // always pick j = 0
  const det2 = shuffleStable(arr, () => 0);
  ok("deterministic with fixed rng", det1.join(",") === det2.join(","));

  console.log("\nreconcileOrder:");
  ok(
    "saved kept intact when subset of canonical",
    deepEq(
      reconcileOrder(["b", "a"], ["a", "b", "c"]),
      ["b", "a", "c"],
    ),
  );
  ok(
    "removed ids dropped",
    deepEq(
      reconcileOrder(["a", "b", "x"], ["a", "b"]),
      ["a", "b"],
    ),
  );
  ok(
    "no saved → canonical pass-through",
    deepEq(reconcileOrder(undefined, ["a", "b"]), ["a", "b"]),
  );
  ok(
    "empty canonical → empty",
    deepEq(reconcileOrder(["a"], []), []),
  );

  console.log(
    failures === 0
      ? "\nALL TESTS PASSED"
      : `\nFAIL: ${failures} expectation(s) failed`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();
