// Phase 10 — pure-TS unit smokes for the leaderboard composite + rank tie-breaker +
// the 11 badge condition evaluators. These mirror (and lock the contract for) the SQL
// in leaderboard_views / my_batch_leaderboard / evaluate_student_badges /
// leaderboard_weekly_rollover. The SQL is the runtime source of truth; this file +
// packages/shared/src/constants/leaderboard.ts are the spec-validated reference, and
// smoke:leaderboard-fns confirms the live SQL matches. Run: pnpm test:leaderboard

import {
  AT_RISK_COMPOSITE_THRESHOLD,
  BADGE_THRESHOLDS,
  type BadgeFacts,
  badgeEvaluators,
  clamp01,
  computeComposite,
  LEADERBOARD_WEIGHTS,
  aNorm,
  qNormFromRatios,
  rankComparator,
  type RankRow,
  sNorm,
} from "../packages/shared/src/constants/leaderboard";

let passed = 0;
let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) passed++;
  else {
    failed++;
    console.error(`  FAIL  ${msg}`);
  }
}
function eq(a: unknown, b: unknown, msg: string) {
  assert(
    JSON.stringify(a) === JSON.stringify(b),
    `${msg} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`,
  );
}
function near(a: number, b: number, msg: string, eps = 1e-9) {
  assert(Math.abs(a - b) < eps, `${msg} (got ${a}, want ${b})`);
}

console.log("\n=== composite weights (D-071 LOCKED) ===");
eq(
  LEADERBOARD_WEIGHTS.quiz + LEADERBOARD_WEIGHTS.attendance + LEADERBOARD_WEIGHTS.streak,
  1,
  "weights sum to 1.0",
);
eq([LEADERBOARD_WEIGHTS.quiz, LEADERBOARD_WEIGHTS.attendance, LEADERBOARD_WEIGHTS.streak], [0.6, 0.25, 0.15], "weights are 60/25/15");

console.log("=== computeComposite ===");
near(computeComposite(1, 1, 1), 1, "all-max = 1.0");
near(computeComposite(0, 0, 0), 0, "all-zero = 0");
near(computeComposite(0.5, 0.5, 0.5), 0.5, "all-half = 0.5");
near(computeComposite(0.567, 1, 0.233), 0.6 * 0.567 + 0.25 + 0.15 * 0.233, "matches DB sample 0.625…");
near(computeComposite(2, -1, 5), 0.6 * 1 + 0.25 * 0 + 0.15 * 1, "clamps each component to [0,1] => 0.75");
near(computeComposite(NaN, 1, 1), 0.25 + 0.15, "NaN q clamps to 0");

console.log("=== clamp01 ===");
eq(clamp01(-3), 0, "negative clamps to 0");
eq(clamp01(7), 1, ">1 clamps to 1");
eq(clamp01(0.42), 0.42, "in-range passes through");
eq(clamp01(NaN), 0, "NaN -> 0");

console.log("=== qNormFromRatios (per-attempt clamp then average) ===");
eq(qNormFromRatios([]), 0, "no attempts -> 0");
near(qNormFromRatios([1, 1]), 1, "all perfect -> 1");
near(qNormFromRatios([0.5, 1]), 0.75, "avg of 0.5 and 1 = 0.75");
near(qNormFromRatios([-0.5, 1.5]), 0.5, "per-attempt clamp: (0 + 1)/2 = 0.5");
near(qNormFromRatios([0.8]), 0.8, "single attempt");

console.log("=== aNorm (active/expected, capped, joined-mid-window fairness) ===");
near(aNorm(7, 7), 1, "full week");
near(aNorm(3, 7), 3 / 7, "3 of 7 days");
near(aNorm(10, 7), 1, "more active than expected caps at 1");
eq(aNorm(5, 0), 0, "zero expected -> 0 (guard)");
near(aNorm(2, 4), 0.5, "joined recently: 2 of 4 expected");

console.log("=== sNorm (streak / 30) ===");
near(sNorm(30), 1, "30-day streak = full credit");
near(sNorm(15), 0.5, "15 days = half");
near(sNorm(45), 1, "45 days caps at 1");
near(sNorm(0), 0, "no streak = 0");
near(sNorm(7), 7 / 30, "7-day streak");

console.log("=== rankComparator (composite > q_norm > quiz_count > full_name) ===");
const rows: (RankRow & { name: string })[] = [
  { name: "Kavya", composite: 0.74, qNorm: 0.7, quizCount: 3, fullName: "Kavya" },
  { name: "Priya", composite: 0.92, qNorm: 0.9, quizCount: 5, fullName: "Priya" },
  { name: "Aarav", composite: 0.88, qNorm: 0.8, quizCount: 4, fullName: "Aarav" },
  { name: "TieQhi", composite: 0.5, qNorm: 0.9, quizCount: 1, fullName: "TieQhi" },
  { name: "TieQlo", composite: 0.5, qNorm: 0.4, quizCount: 9, fullName: "TieQlo" },
  { name: "Zed", composite: 0.5, qNorm: 0.4, quizCount: 9, fullName: "Zed" },
];
const order = [...rows].sort(rankComparator).map((r) => r.name);
eq(order, ["Priya", "Aarav", "Kavya", "TieQhi", "TieQlo", "Zed"], "full tie-break ordering");
assert(rankComparator(rows[1], rows[2]) < 0, "higher composite ranks first");
assert(
  rankComparator(
    { composite: 0.5, qNorm: 0.9, quizCount: 1, fullName: "B" },
    { composite: 0.5, qNorm: 0.4, quizCount: 9, fullName: "A" },
  ) < 0,
  "equal composite: higher q_norm wins over quiz_count + name",
);
assert(
  rankComparator(
    { composite: 0.5, qNorm: 0.5, quizCount: 9, fullName: "Zed" },
    { composite: 0.5, qNorm: 0.5, quizCount: 4, fullName: "Aarav" },
  ) < 0,
  "equal composite + q_norm: higher quiz_count wins over name",
);
assert(
  rankComparator(
    { composite: 0.5, qNorm: 0.5, quizCount: 4, fullName: "Aarav" },
    { composite: 0.5, qNorm: 0.5, quizCount: 4, fullName: "Zed" },
  ) < 0,
  "all equal: full_name asc breaks the tie",
);

console.log("=== badge evaluators (each of 11; true + false) ===");
function facts(over: Partial<BadgeFacts>): BadgeFacts {
  return {
    submittedQuizCount: 0,
    currentStreakDays: 0,
    bestStreakDays: 0,
    activityRuns: [],
    earlyScanCount: 0,
    longestPerfectClassDayRun: 0,
    subjectMastery: [],
    weeklyRank: null,
    ...over,
  };
}

assert(badgeEvaluators.first_quiz(facts({ submittedQuizCount: 1 })), "first_quiz at 1 quiz");
assert(!badgeEvaluators.first_quiz(facts({ submittedQuizCount: 0 })), "first_quiz NOT at 0");

assert(badgeEvaluators.quiz_100(facts({ submittedQuizCount: BADGE_THRESHOLDS.quizCenturion })), "quiz_100 at 100");
assert(!badgeEvaluators.quiz_100(facts({ submittedQuizCount: 99 })), "quiz_100 NOT at 99");

assert(badgeEvaluators.streak_7(facts({ currentStreakDays: 7 })), "streak_7 at 7");
assert(!badgeEvaluators.streak_7(facts({ currentStreakDays: 6 })), "streak_7 NOT at 6");
assert(badgeEvaluators.streak_30(facts({ currentStreakDays: 30 })), "streak_30 at 30");
assert(!badgeEvaluators.streak_30(facts({ currentStreakDays: 29 })), "streak_30 NOT at 29");
assert(badgeEvaluators.streak_90(facts({ currentStreakDays: 90 })), "streak_90 at 90");
assert(!badgeEvaluators.streak_90(facts({ currentStreakDays: 89 })), "streak_90 NOT at 89");

assert(badgeEvaluators.early_bird(facts({ earlyScanCount: 5 })), "early_bird at 5 scans");
assert(!badgeEvaluators.early_bird(facts({ earlyScanCount: 4 })), "early_bird NOT at 4");

assert(badgeEvaluators.perfect_week_attendance(facts({ longestPerfectClassDayRun: 7 })), "perfect_week at 7-day run");
assert(!badgeEvaluators.perfect_week_attendance(facts({ longestPerfectClassDayRun: 6 })), "perfect_week NOT at 6");

assert(
  badgeEvaluators.mastery_80_subject(facts({ subjectMastery: [{ topicsWithMastery: 3, avgPct: 80 }] })),
  "mastery_80 at 3 topics avg 80",
);
assert(
  !badgeEvaluators.mastery_80_subject(facts({ subjectMastery: [{ topicsWithMastery: 2, avgPct: 95 }] })),
  "mastery_80 NOT with only 2 topics",
);
assert(
  !badgeEvaluators.mastery_80_subject(facts({ subjectMastery: [{ topicsWithMastery: 4, avgPct: 79 }] })),
  "mastery_80 NOT at avg 79",
);

assert(
  badgeEvaluators.comeback(facts({ currentStreakDays: 7, activityRuns: [8, 7] })),
  "comeback: current 7 + prior 8-run",
);
assert(
  !badgeEvaluators.comeback(facts({ currentStreakDays: 7, activityRuns: [7] })),
  "comeback NOT on a first-ever streak (no prior run)",
);
assert(
  !badgeEvaluators.comeback(facts({ currentStreakDays: 6, activityRuns: [8, 6] })),
  "comeback NOT while current streak < 7",
);
assert(
  !badgeEvaluators.comeback(facts({ currentStreakDays: 7, activityRuns: [5, 7] })),
  "comeback NOT when the prior run never reached 7",
);

assert(badgeEvaluators.topper_of_week(facts({ weeklyRank: 1 })), "topper at rank 1");
assert(!badgeEvaluators.topper_of_week(facts({ weeklyRank: 2 })), "topper NOT at rank 2");
assert(badgeEvaluators.runner_up_week(facts({ weeklyRank: 2 })), "runner_up at rank 2");
assert(badgeEvaluators.runner_up_week(facts({ weeklyRank: 3 })), "runner_up at rank 3");
assert(!badgeEvaluators.runner_up_week(facts({ weeklyRank: 1 })), "runner_up NOT at rank 1");
assert(!badgeEvaluators.runner_up_week(facts({ weeklyRank: 4 })), "runner_up NOT at rank 4");

console.log("=== at-risk threshold ===");
eq(AT_RISK_COMPOSITE_THRESHOLD, 0.4, "at-risk composite threshold is 0.4");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
