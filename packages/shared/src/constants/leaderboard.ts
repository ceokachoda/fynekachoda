// Phase 10 — Leaderboard & gamification tunables.
//
// SINGLE SOURCE OF TRUTH for the TS side: imported by the mobile "How is this
// calculated?" modal + leaderboard hooks, and by the pure-TS unit tests
// (scripts/test-leaderboard-helpers.ts). The SQL leaderboard_weekly /
// leaderboard_alltime views, my_batch_leaderboard, evaluate_student_badges and
// leaderboard_weekly_rollover encode the SAME numbers (SQL cannot import TS) — keep
// them in sync. The unit tests re-implement the formulas here against the spec so any
// drift between this file and the spec is caught; smoke:leaderboard-fns confirms the
// SQL matches by reading the live RPC.
//
// D-071 composite weights are LOCKED.

export const LEADERBOARD_WEIGHTS = {
  quiz: 0.6, // Q — normalized quiz + exam score
  attendance: 0.25, // A — activity-day fraction over expected days
  streak: 0.15, // S — current streak / 30, capped at 1
} as const;

// Windows + caps (spec §3.2 / §3.6).
export const LEADERBOARD_WINDOWS = {
  weeklyQuizDays: 7,
  weeklyExpectedDays: 7, // weekly A denominator (capped by days-since-join for fairness)
  alltimeQuizDays: 180,
  streakFullCreditDays: 30, // S reaches 1.0 here
} as const;

// At-risk threshold for the teacher batch dashboard (CP12; composite is on a 0..1 scale).
export const AT_RISK_COMPOSITE_THRESHOLD = 0.4;

// Badge earning thresholds (spec §5.1 / D-077). evaluate_student_badges encodes these.
export const BADGE_THRESHOLDS = {
  quizCenturion: 100,
  streakWeek: 7,
  streakMarathon: 30,
  streakIron: 90,
  earlyBirdScans: 5,
  perfectWeekClassDays: 7,
  masterySubjectPct: 80,
  masterySubjectMinTopics: 3,
  comebackStreakDays: 7,
} as const;

export function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

// composite — each component already normalized to [0,1] before weighting.
export function computeComposite(
  qNorm: number,
  aNorm: number,
  sNorm: number,
): number {
  return (
    LEADERBOARD_WEIGHTS.quiz * clamp01(qNorm) +
    LEADERBOARD_WEIGHTS.attendance * clamp01(aNorm) +
    LEADERBOARD_WEIGHTS.streak * clamp01(sNorm)
  );
}

// Normalizers mirroring the SQL views.
export function qNormFromRatios(ratios: number[]): number {
  if (ratios.length === 0) return 0;
  const avg = ratios.reduce((s, r) => s + clamp01(r), 0) / ratios.length;
  return clamp01(avg);
}
export function aNorm(activeDays: number, expectedDays: number): number {
  if (expectedDays <= 0) return 0;
  return clamp01(activeDays / expectedDays);
}
export function sNorm(currentStreakDays: number): number {
  return clamp01(currentStreakDays / LEADERBOARD_WINDOWS.streakFullCreditDays);
}

// Leaderboard tie-breaker (spec §3.5): composite desc, q_norm desc, quiz count desc,
// full_name asc. Returns < 0 when `a` should rank above `b`.
export interface RankRow {
  composite: number;
  qNorm: number;
  quizCount: number;
  fullName: string;
}
export function rankComparator(a: RankRow, b: RankRow): number {
  if (b.composite !== a.composite) return b.composite - a.composite;
  if (b.qNorm !== a.qNorm) return b.qNorm - a.qNorm;
  if (b.quizCount !== a.quizCount) return b.quizCount - a.quizCount;
  return a.fullName.localeCompare(b.fullName);
}

// ── Badge condition evaluators (pure mirrors of evaluate_student_badges SQL) ──────
// The unit tests lock the contract for each of the 11 badges against these.
export interface BadgeFacts {
  submittedQuizCount: number;
  currentStreakDays: number;
  bestStreakDays: number;
  // consecutive activity-day run lengths, oldest → newest (last entry = current run).
  activityRuns: number[];
  earlyScanCount: number; // present/late scans recorded before scheduled_start
  longestPerfectClassDayRun: number; // longest run of class-days all present/late
  subjectMastery: { topicsWithMastery: number; avgPct: number }[];
  weeklyRank: number | null; // only set in the weekly-rollover context
}

export type BadgeCode =
  | "first_quiz"
  | "quiz_100"
  | "streak_7"
  | "streak_30"
  | "streak_90"
  | "early_bird"
  | "perfect_week_attendance"
  | "mastery_80_subject"
  | "comeback"
  | "topper_of_week"
  | "runner_up_week";

export const badgeEvaluators: Record<BadgeCode, (f: BadgeFacts) => boolean> = {
  first_quiz: (f) => f.submittedQuizCount >= 1,
  quiz_100: (f) => f.submittedQuizCount >= BADGE_THRESHOLDS.quizCenturion,
  streak_7: (f) => f.currentStreakDays >= BADGE_THRESHOLDS.streakWeek,
  streak_30: (f) => f.currentStreakDays >= BADGE_THRESHOLDS.streakMarathon,
  streak_90: (f) => f.currentStreakDays >= BADGE_THRESHOLDS.streakIron,
  early_bird: (f) => f.earlyScanCount >= BADGE_THRESHOLDS.earlyBirdScans,
  perfect_week_attendance: (f) =>
    f.longestPerfectClassDayRun >= BADGE_THRESHOLDS.perfectWeekClassDays,
  mastery_80_subject: (f) =>
    f.subjectMastery.some(
      (s) =>
        s.topicsWithMastery >= BADGE_THRESHOLDS.masterySubjectMinTopics &&
        s.avgPct >= BADGE_THRESHOLDS.masterySubjectPct,
    ),
  // comeback: a *current* 7+ streak AND an earlier (now-broken) run that also hit 7+.
  // Never fires on a first-ever streak (no prior run). Risks-table guard.
  comeback: (f) => {
    if (f.currentStreakDays < BADGE_THRESHOLDS.comebackStreakDays) return false;
    if (f.activityRuns.length < 2) return false;
    const prior = f.activityRuns.slice(0, -1);
    return prior.some((len) => len >= BADGE_THRESHOLDS.comebackStreakDays);
  },
  // Awarded only by the weekly rollover (rank context); never by the per-student feeder.
  topper_of_week: (f) => f.weeklyRank === 1,
  runner_up_week: (f) => f.weeklyRank === 2 || f.weeklyRank === 3,
};
