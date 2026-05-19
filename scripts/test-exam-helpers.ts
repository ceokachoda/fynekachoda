// Phase 7 — unit smoke for the pure helpers used by exam edge fns.
//
// Run with `pnpm test:exam`. Exit 0 on green, 1 on the first failed
// expectation.

import {
  applyMarkAllCorrectOverride,
  applyMarkNoCorrectOverride,
  computeRemainingSec,
  gradeAnswer,
  gradeAttempt,
  isAutoSubmittedAt,
  regradedCorrectOptionId,
  sanitiseSnapshotForStudent,
  shuffleStable,
  type ExamSnapshot,
} from "../apps/functions/_shared/exam-marking.ts";

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
      {
        question_id: "q1",
        selected_option_id: null,
        correct_option_id: "o1",
        outcome: "skipped",
        points: 0,
      },
    ),
  );
  ok(
    "correct → marks_correct",
    deepEq(
      gradeAnswer({ question_id: "q1", selected_option_id: "o1", correct_option_id: "o1" }, MARKS),
      {
        question_id: "q1",
        selected_option_id: "o1",
        correct_option_id: "o1",
        outcome: "correct",
        points: 4,
      },
    ),
  );
  ok(
    "wrong → marks_wrong",
    deepEq(
      gradeAnswer({ question_id: "q1", selected_option_id: "o2", correct_option_id: "o1" }, MARKS),
      {
        question_id: "q1",
        selected_option_id: "o2",
        correct_option_id: "o1",
        outcome: "wrong",
        points: -1,
      },
    ),
  );
  ok(
    "no correct option in snapshot → wrong if selected",
    gradeAnswer({ question_id: "q1", selected_option_id: "o1", correct_option_id: null }, MARKS).outcome === "wrong",
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
  ok("correct=2 wrong=1 skipped=1", attempt.correct_count === 2 && attempt.wrong_count === 1 && attempt.skipped_count === 1);
  ok("per_question length", attempt.per_question.length === 4);

  console.log("\nsanitiseSnapshotForStudent strips correct_option_id:");
  const snap: ExamSnapshot = {
    questions: [
      {
        id: "q1",
        prompt_md: "Why?",
        prompt_image_path: null,
        difficulty: "easy",
        topic_id: "t1",
        options: [
          { id: "o1", text_md: "A", image_path: null },
          { id: "o2", text_md: "B", image_path: null },
        ],
        correct_option_id: "o1",
      },
    ],
  };
  const sanitised = sanitiseSnapshotForStudent(snap);
  const sanitisedStr = JSON.stringify(sanitised);
  ok("no correct_option_id substring anywhere", !sanitisedStr.includes("correct_option_id"));
  ok("first question still has 2 options", sanitised.questions[0].options.length === 2);

  console.log("\nregradedCorrectOptionId:");
  ok(
    "change_correct uses live key",
    regradedCorrectOptionId("change_correct", "newO", "x") === "newO",
  );
  ok(
    "mark_all_correct matches whatever the student picked",
    regradedCorrectOptionId("mark_all_correct", "live", "studentPick") === "studentPick",
  );
  ok(
    "mark_no_correct returns null",
    regradedCorrectOptionId("mark_no_correct", "live", "x") === null,
  );

  console.log("\napplyMarkNoCorrectOverride:");
  const noBefore = gradeAnswer(
    { question_id: "q", selected_option_id: "o2", correct_option_id: "o1" },
    MARKS,
  );
  const noAfter = applyMarkNoCorrectOverride(noBefore, MARKS);
  ok("outcome flipped to skipped", noAfter.outcome === "skipped");
  ok("points became marks_skip", noAfter.points === MARKS.marks_skip);
  ok("correct_option_id wiped", noAfter.correct_option_id === null);

  console.log("\napplyMarkAllCorrectOverride:");
  const allBefore = gradeAnswer(
    { question_id: "q", selected_option_id: null, correct_option_id: "o1" },
    MARKS,
  );
  const allAfter = applyMarkAllCorrectOverride(allBefore, MARKS);
  ok("outcome flipped to correct even when skipped", allAfter.outcome === "correct");
  ok("points became marks_correct", allAfter.points === MARKS.marks_correct);

  console.log("\ncomputeRemainingSec:");
  const startsAt = new Date("2026-06-01T09:00:00Z");
  ok(
    "exactly at start, full duration remains",
    computeRemainingSec(new Date("2026-06-01T09:00:00Z"), startsAt, 60) === 3600,
  );
  ok(
    "30 minutes in, 30 minutes left",
    computeRemainingSec(new Date("2026-06-01T09:30:00Z"), startsAt, 60) === 1800,
  );
  ok(
    "after hard cut, 0",
    computeRemainingSec(new Date("2026-06-01T10:30:00Z"), startsAt, 60) === 0,
  );

  console.log("\nisAutoSubmittedAt:");
  ok(
    "before hard cut → false",
    !isAutoSubmittedAt(
      new Date("2026-06-01T09:59:00Z"),
      startsAt,
      60,
    ),
  );
  ok(
    "after hard cut → true",
    isAutoSubmittedAt(
      new Date("2026-06-01T10:01:00Z"),
      startsAt,
      60,
    ),
  );

  console.log("\nshuffleStable:");
  const a = ["x", "y", "z"];
  const s = shuffleStable(a);
  ok("does not mutate input", a.join(",") === "x,y,z");
  ok("same elements", s.slice().sort().join(",") === "x,y,z");
  const det1 = shuffleStable(a, () => 0);
  const det2 = shuffleStable(a, () => 0);
  ok("deterministic with fixed rng", det1.join(",") === det2.join(","));

  console.log(failures === 0 ? "\nALL TESTS PASSED" : `\nFAIL: ${failures} expectation(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
