// Phase 8 — pure-TS unit smokes for the mastery rolling-N + streak gaps-and-islands
// algorithms. These mirror the SQL in:
//   - 20260521131000_mastery_recompute_fn.sql (rolling avg of last 5, per-attempt clamp)
//   - 20260521131500_streak_recompute_fn.sql   (consecutive IST-day run, no freeze)
// The SQL is authoritative; this documents + locks the algorithm contract and the
// edge cases (IST boundaries, gaps, negative-marking clamp). Run: pnpm test:dashboard

let passed = 0;
let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL  ${msg}`);
  }
}
function eq(a: unknown, b: unknown, msg: string) {
  assert(JSON.stringify(a) === JSON.stringify(b), `${msg} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
}

// ---- mastery: rolling average of last 5 attempts, each clamped to [0,100] ----
function rollingMasteryPct(pctsMostRecentFirst: number[]): number {
  const last5 = pctsMostRecentFirst.slice(0, 5);
  if (last5.length === 0) return 0;
  const clamped = last5.map((p) => Math.max(0, Math.min(100, p)));
  const avg = clamped.reduce((s, x) => s + x, 0) / clamped.length;
  return Math.round(avg * 100) / 100;
}

// ---- streak: consecutive-day run ending at the latest active day, alive only if
// that day is today or yesterday; best = longest run ever. ----
function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}
function computeStreak(daysInput: string[], today: string): {
  current: number;
  best: number;
  lastActive: string | null;
} {
  const days = Array.from(new Set(daysInput)).sort();
  if (days.length === 0) return { current: 0, best: 0, lastActive: null };
  const runs: { len: number; end: string }[] = [];
  let prev: string | null = null;
  let curRun = 0;
  for (const d of days) {
    if (prev && dayDiff(prev, d) === 1) curRun += 1;
    else {
      if (prev) runs.push({ len: curRun, end: prev });
      curRun = 1;
    }
    prev = d;
  }
  if (prev) runs.push({ len: curRun, end: prev });
  const best = Math.max(...runs.map((r) => r.len));
  const lastActive = days[days.length - 1]!;
  const latestRun = runs.find((r) => r.end === lastActive)!;
  const current = dayDiff(lastActive, today) <= 1 ? latestRun.len : 0;
  return { current, best, lastActive };
}

console.log("\n=== mastery rolling-N ===");
eq(rollingMasteryPct([100, 80, 60, 40, 20]), 60, "5 attempts average");
eq(rollingMasteryPct([100, 90, 80, 70, 60, 50]), 80, "6 attempts -> last 5 only");
eq(rollingMasteryPct([]), 0, "no attempts -> 0");
eq(rollingMasteryPct([90]), 90, "single attempt");
eq(rollingMasteryPct([-25, 50]), 25, "negative marking clamps per-attempt to 0");
eq(rollingMasteryPct([150, 50]), 75, ">100 clamps per-attempt to 100");
eq(rollingMasteryPct([-100, -100]), 0, "all negative -> 0, not below 0");

console.log("=== streak gaps-and-islands (today = 2026-05-21) ===");
const T = "2026-05-21";
eq(computeStreak(["2026-05-19", "2026-05-20", "2026-05-21"], T), { current: 3, best: 3, lastActive: "2026-05-21" }, "3 consecutive ending today");
eq(computeStreak(["2026-05-20"], T), { current: 1, best: 1, lastActive: "2026-05-20" }, "yesterday only -> alive");
eq(computeStreak(["2026-05-18"], T), { current: 0, best: 1, lastActive: "2026-05-18" }, "2 days ago -> reset to 0");
eq(
  computeStreak(["2026-05-10", "2026-05-11", "2026-05-12", "2026-05-13", "2026-05-14", "2026-05-21"], T),
  { current: 1, best: 5, lastActive: "2026-05-21" },
  "old 5-run + today -> current 1, best 5 sticky",
);
eq(computeStreak(["2026-05-21", "2026-05-19"], T), { current: 1, best: 1, lastActive: "2026-05-21" }, "today + gap day");
eq(computeStreak([], T), { current: 0, best: 0, lastActive: null }, "no activity");
eq(computeStreak(["2026-05-21"], T), { current: 1, best: 1, lastActive: "2026-05-21" }, "today only");
// IST month boundary: 30 Apr + 1 May are consecutive
eq(computeStreak(["2026-04-30", "2026-05-01"], "2026-05-01"), { current: 2, best: 2, lastActive: "2026-05-01" }, "month boundary consecutive");
// dedup: duplicate day strings collapse
eq(computeStreak(["2026-05-21", "2026-05-21", "2026-05-20"], T), { current: 2, best: 2, lastActive: "2026-05-21" }, "duplicate days dedup");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
