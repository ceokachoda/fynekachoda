// Phase 10 — edge-fn / RPC HTTP smoke for the leaderboard + badges surface.
//
// Verifies over HTTP (ephemeral p10fn-* fixtures, cleaned up at the end):
//   - badge-evaluate awards the right badges per engineered scenario (9 non-rank badges)
//   - badge-evaluate is admin-gated (student -> 403) + validates input (-> 400) + idempotent
//   - leaderboard-weekly-rollover awards topper(#1) + runner-up(#2/#3), snapshots, and is
//     idempotent on re-run; admin-gated (student -> 403)
//   - my_batch_leaderboard RPC returns the caller's batch board (200)
//   - badge-icon-sign returns 11 signed badge-asset URLs (200)
//
// Run: pnpm smoke:leaderboard-fns

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, "..", "apps", "admin", ".env.local"), override: false });

const SUPABASE_URL = req("NEXT_PUBLIC_SUPABASE_URL");
const ANON_KEY = req("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const SERVICE_KEY = req("SUPABASE_SERVICE_ROLE_KEY");
const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "owner@fynestudy.example.com";
const OWNER_PASSWORD = process.env.OWNER_INITIAL_PASSWORD ?? "FyneStudy01";

function req(n: string): string {
  const v = process.env[n];
  if (!v) {
    console.error(`missing env ${n}`);
    process.exit(1);
  }
  return v;
}
let passed = 0,
  failed = 0;
function ok(c: boolean, m: string) {
  c ? (passed++, console.log(`  PASS  ${m}`)) : (failed++, console.error(`  FAIL  ${m}`));
}
function die(m: string): never {
  console.error(`FATAL ${m}`);
  process.exit(1);
}

async function signIn(email: string, password: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const d = await res.json();
  if (!res.ok) die(`signIn ${email}: ${res.status} ${JSON.stringify(d)}`);
  return d.access_token as string;
}
async function fn(name: string, body: unknown, jwt: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}
async function rpc(name: string, body: unknown, jwt: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: (await res.json().catch(() => null)) as unknown };
}
async function call(name: string, body: unknown, jwt: string, allow: number[] = []) {
  const r = await fn(name, body, jwt);
  if (r.status !== 200 && !allow.includes(r.status)) die(`setup ${name}: ${r.status} ${JSON.stringify(r.data)}`);
  return r;
}

interface Acct {
  user_id: string;
  auth_user_id: string;
  email: string;
  initial_password: string;
}

const iso = (d: Date) => d.toISOString();
const istDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

async function main() {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const ownerJwt = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
  const ts = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  // --- curriculum: 1 subject, 1 chapter, 3 topics
  const course = (await call("curriculum-mutate", { op: "create_course", payload: { code: `P10FN_${ts}`, name: `FN ${ts}` } }, ownerJwt)).data.row as { id: string };
  const subject = (await call("curriculum-mutate", { op: "create_subject", payload: { course_id: course.id, name: "Physics", sort_order: 0 } }, ownerJwt)).data.row as { id: string };
  const chapter = (await call("curriculum-mutate", { op: "create_chapter", payload: { subject_id: subject.id, name: "Mechanics", sort_order: 0 } }, ownerJwt)).data.row as { id: string };
  const topics: string[] = [];
  for (let i = 0; i < 3; i++) {
    topics.push(((await call("curriculum-mutate", { op: "create_topic", payload: { chapter_id: chapter.id, name: `T${i}`, sort_order: i } }, ownerJwt)).data.row as { id: string }).id);
  }

  // --- batches: B (badge scenarios) + R (rollover)
  const batchB = (await call("batch-mutate", { op: "create_batch", payload: { course_id: course.id, name: `P10FN_B_${ts}`, starts_on: today, capacity: 20 } }, ownerJwt)).data.row as { id: string };
  const batchR = (await call("batch-mutate", { op: "create_batch", payload: { course_id: course.id, name: `P10FN_R_${ts}`, starts_on: today, capacity: 20 } }, ownerJwt)).data.row as { id: string };

  const mkStudent = async (tag: string, batchId: string) =>
    (await call("auth-bootstrap", { role: "student", full_name: `p10fn ${tag} ${ts}`, email: `p10fn-${tag}-${ts}@fynestudy.example.com`, parent_consent_method: "verbal", batch_id: batchId }, ownerJwt)).data as Acct;

  const sb1 = await mkStudent("sb1", batchB.id); // first_quiz + quiz_100
  const sb2 = await mkStudent("sb2", batchB.id); // streak_7/30/90 + comeback
  const sb3 = await mkStudent("sb3", batchB.id); // early_bird + perfect_week
  const sb4 = await mkStudent("sb4", batchB.id); // mastery_80_subject
  const r1 = await mkStudent("r1", batchR.id); // rollover topper
  const r2 = await mkStudent("r2", batchR.id); // rollover runner-up
  const r3 = await mkStudent("r3", batchR.id); // composite 0 (no award)
  const allStudents = [sb1, sb2, sb3, sb4, r1, r2, r3];
  await admin.from("app_users").update({ must_change_password: false }).in("id", allStudents.map((s) => s.user_id));

  // a published quiz to hang quiz_attempts off of
  const quiz = await admin.from("quizzes").insert({ title: `FN quiz ${ts}`, topic_id: topics[0], course_id: course.id, batch_id: batchB.id, is_published: true, created_by: sb1.user_id }).select("id").single();
  if (quiz.error) die(`quiz: ${quiz.error.message}`);
  const quizId = quiz.data.id as string;

  // SB1: 100 submitted practice quizzes -> first_quiz + quiz_100
  const hundred = Array.from({ length: 100 }, (_, i) => ({
    quiz_id: quizId, student_id: sb1.user_id,
    started_at: iso(new Date(Date.now() - (40 + i) * 86400000 - 600000)),
    submitted_at: iso(new Date(Date.now() - (40 + i) * 86400000)),
    score: 5, max_score: 10, correct_count: 1, wrong_count: 1, skipped_count: 0, is_practice: true,
  }));
  {
    const r = await admin.from("quiz_attempts").insert(hundred);
    if (r.error) die(`sb1 100 attempts: ${r.error.message}`);
  }

  // SB2: streak 90 (direct) + activity_days prior-7-run + current-7-run -> streak_* + comeback
  {
    const r = await admin.from("streaks").upsert({ student_id: sb2.user_id, current_days: 90, best_days: 90, last_active: today, last_evaluated_date: today }, { onConflict: "student_id" });
    if (r.error) die(`sb2 streak: ${r.error.message}`);
    const days: { student_id: string; day: string }[] = [];
    for (let i = 0; i < 7; i++) days.push({ student_id: sb2.user_id, day: istDay(new Date(Date.now() - (40 - i) * 86400000)) }); // prior run D-40..D-34
    for (let i = 0; i < 7; i++) days.push({ student_id: sb2.user_id, day: istDay(new Date(Date.now() - (6 - i) * 86400000)) }); // current run D-6..D0
    const r2d = await admin.from("activity_days").upsert(days, { onConflict: "student_id,day", ignoreDuplicates: true });
    if (r2d.error) die(`sb2 activity_days: ${r2d.error.message}`);
  }

  // SB3: 7 consecutive class-days, present + early scan -> early_bird + perfect_week
  {
    const sessRows = Array.from({ length: 7 }, (_, i) => {
      const start = new Date(Date.now() - (7 - i) * 86400000);
      start.setHours(12, 0, 0, 0);
      return { batch_id: batchB.id, subject_id: subject.id, scheduled_start: iso(start), scheduled_end: iso(new Date(start.getTime() + 90 * 60000)), status: "ended" };
    });
    const sess = await admin.from("sessions").insert(sessRows).select("id, scheduled_start");
    if (sess.error) die(`sb3 sessions: ${sess.error.message}`);
    const att = (sess.data as { id: string; scheduled_start: string }[]).map((s) => ({
      session_id: s.id, student_id: sb3.user_id, status: "present", method: "manual",
      marked_at: iso(new Date(new Date(s.scheduled_start).getTime() - 5 * 60000)), // 5 min EARLY
    }));
    const r = await admin.from("attendance").insert(att);
    if (r.error) die(`sb3 attendance: ${r.error.message}`);
  }

  // SB4: 3 topics of one subject, avg mastery 85 -> mastery_80_subject
  {
    const rows = [80, 85, 90].map((pct, i) => ({ student_id: sb4.user_id, topic_id: topics[i], mastery_pct: pct, attempt_count: 3, updated_at: iso(new Date()) }));
    const r = await admin.from("mastery").insert(rows);
    if (r.error) die(`sb4 mastery: ${r.error.message}`);
  }

  // R1 / R2: recent submitted quiz attempts -> composite > 0 for the rollover
  {
    const r = await admin.from("quiz_attempts").insert([
      { quiz_id: quizId, student_id: r1.user_id, started_at: iso(new Date(Date.now() - 600000)), submitted_at: iso(new Date()), score: 9, max_score: 10, correct_count: 9, wrong_count: 1, skipped_count: 0, is_practice: true },
      { quiz_id: quizId, student_id: r2.user_id, started_at: iso(new Date(Date.now() - 600000)), submitted_at: iso(new Date()), score: 4, max_score: 10, correct_count: 4, wrong_count: 6, skipped_count: 0, is_practice: true },
    ]);
    if (r.error) die(`R attempts: ${r.error.message}`);
  }

  // ── badge-evaluate scenarios (admin) ─────────────────────────────────────────
  console.log("\n=== badge-evaluate per unlock scenario ===");
  const ev = async (acct: Acct) => (await fn("badge-evaluate", { student_id: acct.user_id, triggers: ["quiz_submit"] }, ownerJwt));
  const has = (data: Record<string, unknown>, code: string) => Array.isArray(data.awarded) && (data.awarded as string[]).includes(code);

  const e1 = await ev(sb1);
  ok(e1.status === 200 && has(e1.data, "first_quiz") && has(e1.data, "quiz_100"), "SB1 -> first_quiz + quiz_100");
  const e2 = await ev(sb2);
  ok(e2.status === 200 && has(e2.data, "streak_7") && has(e2.data, "streak_30") && has(e2.data, "streak_90") && has(e2.data, "comeback"), "SB2 -> streak_7/30/90 + comeback");
  const e3 = await ev(sb3);
  ok(e3.status === 200 && has(e3.data, "early_bird") && has(e3.data, "perfect_week_attendance"), "SB3 -> early_bird + perfect_week_attendance");
  const e4 = await ev(sb4);
  ok(e4.status === 200 && has(e4.data, "mastery_80_subject"), "SB4 -> mastery_80_subject");

  console.log("=== badge-evaluate idempotency + gating ===");
  const e1again = await ev(sb1);
  ok(e1again.status === 200 && Array.isArray(e1again.data.awarded) && (e1again.data.awarded as string[]).length === 0, "re-eval SB1 awards nothing new (idempotent)");
  const sb1Jwt = await signIn(sb1.email, sb1.initial_password);
  const evStudent = await fn("badge-evaluate", { student_id: sb1.user_id }, sb1Jwt);
  ok(evStudent.status === 403, "badge-evaluate as student -> 403");
  const evBad = await fn("badge-evaluate", {}, ownerJwt);
  ok(evBad.status === 400, "badge-evaluate without student_id -> 400");

  // ── leaderboard-weekly-rollover ──────────────────────────────────────────────
  console.log("=== leaderboard-weekly-rollover ===");
  const period = "2019-03-04";
  const ro1 = await fn("leaderboard-weekly-rollover", { period_start: period, batch_id: batchR.id }, ownerJwt);
  ok(ro1.status === 200 && ro1.data.batches_processed === 1, "rollover (admin) processed 1 batch");
  const snap = await admin.from("leaderboard_snapshots").select("rankings").eq("batch_id", batchR.id).eq("period_start", period).maybeSingle();
  ok(!snap.error && !!snap.data, "snapshot row inserted for batch R");
  const earned = async (uid: string, code: string) => {
    const b = await admin.from("badges").select("id").eq("code", code).single();
    const e = await admin.from("badge_earnings").select("student_id").eq("student_id", uid).eq("badge_id", b.data!.id).maybeSingle();
    return !e.error && !!e.data;
  };
  ok(await earned(r1.user_id, "topper_of_week"), "R1 (#1) got topper_of_week");
  ok(await earned(r2.user_id, "runner_up_week"), "R2 (#2) got runner_up_week");
  ok(!(await earned(r3.user_id, "topper_of_week")) && !(await earned(r3.user_id, "runner_up_week")), "R3 (composite 0) got nothing");

  const ro2 = await fn("leaderboard-weekly-rollover", { period_start: period, batch_id: batchR.id }, ownerJwt);
  ok(ro2.status === 200 && ro2.data.batches_processed === 0, "rollover re-run is idempotent (0 batches)");
  const roStudent = await fn("leaderboard-weekly-rollover", {}, sb1Jwt);
  ok(roStudent.status === 403, "rollover as student -> 403");

  // ── my_batch_leaderboard RPC + badge-icon-sign ───────────────────────────────
  console.log("=== my_batch_leaderboard RPC + badge-icon-sign ===");
  const board = await rpc("my_batch_leaderboard", { p_scope: "weekly" }, sb1Jwt);
  ok(board.status === 200 && Array.isArray(board.data), "my_batch_leaderboard RPC -> 200 array");
  const icons = await fn("badge-icon-sign", {}, sb1Jwt);
  const iconMap = (icons.data.icons ?? {}) as Record<string, string>;
  ok(icons.status === 200 && Object.keys(iconMap).length === 11, "badge-icon-sign -> 11 icons");
  ok(typeof iconMap.first_quiz === "string" && iconMap.first_quiz.includes("badge-assets"), "icon URL points at badge-assets bucket");

  // --- cleanup
  console.log("=== cleanup ===");
  const ids = allStudents.map((s) => s.user_id);
  const sessIds = (await admin.from("sessions").select("id").in("batch_id", [batchB.id, batchR.id])).data?.map((r: { id: string }) => r.id) ?? [];
  if (sessIds.length) await admin.from("attendance").delete().in("session_id", sessIds);
  await admin.from("sessions").delete().in("batch_id", [batchB.id, batchR.id]);
  await admin.from("leaderboard_snapshots").delete().in("batch_id", [batchB.id, batchR.id]);
  await admin.from("badge_earnings").delete().in("student_id", ids);
  await admin.from("quiz_attempts").delete().in("student_id", ids);
  await admin.from("mastery").delete().in("student_id", ids);
  await admin.from("activity_days").delete().in("student_id", ids);
  await admin.from("streaks").delete().in("student_id", ids);
  await admin.from("quizzes").delete().eq("id", quizId);
  await admin.from("students").delete().in("user_id", ids);
  await admin.from("user_roles").delete().in("user_id", ids);
  await admin.from("audit_log").delete().in("actor_user_id", ids);
  await admin.from("batches").delete().in("id", [batchB.id, batchR.id]);
  await admin.from("courses").delete().eq("id", course.id);
  for (const a of allStudents) {
    await admin.from("app_users").delete().eq("id", a.user_id);
    try {
      await admin.auth.admin.deleteUser(a.auth_user_id);
    } catch {
      /* ignore */
    }
  }
  ok(true, "cleaned up ephemeral fixtures");

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
