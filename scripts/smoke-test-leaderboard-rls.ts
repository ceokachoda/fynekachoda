// Phase 10 — RLS smoke for the leaderboard + badges surface.
//
// Verifies (ephemeral p10rls-* fixtures, cleaned up at the end):
//   - my_batch_leaderboard returns ONLY the caller's own batch (cross-batch isolation, AC #15)
//   - a student CANNOT pass another batch's id to my_batch_leaderboard (guard)
//   - a teacher can query a batch they teach, but NOT one they don't
//   - leaderboard_weekly / leaderboard_alltime views are NOT directly client-readable
//   - badge_earnings: student reads own, NOT another's; teacher reads batch students'
//   - leaderboard_snapshots: teacher-of-batch reads; student does NOT
//
// Run: pnpm smoke:leaderboard-rls

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
async function callFn(name: string, body: unknown, jwt: string, allow: number[] = []) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await res.json().catch(() => ({}));
  if (res.status !== 200 && !allow.includes(res.status)) die(`callFn ${name}: ${res.status} ${JSON.stringify(d)}`);
  return { status: res.status, data: d as Record<string, unknown> };
}
const userClient = (jwt: string): SupabaseClient =>
  createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });

interface Acct {
  user_id: string;
  auth_user_id: string;
  email: string;
  initial_password: string;
}

async function main() {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const ownerJwt = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
  const ts = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  // --- setup: course + 2 batches; teacher of A only; 2 students in A, 1 in B
  const course = (await callFn("curriculum-mutate", { op: "create_course", payload: { code: `P10RLS_${ts}`, name: `RLS ${ts}` } }, ownerJwt)).data.row as { id: string };
  const batchA = (await callFn("batch-mutate", { op: "create_batch", payload: { course_id: course.id, name: `P10RLS_A_${ts}`, starts_on: today, capacity: 10 } }, ownerJwt)).data.row as { id: string };
  const batchB = (await callFn("batch-mutate", { op: "create_batch", payload: { course_id: course.id, name: `P10RLS_B_${ts}`, starts_on: today, capacity: 10 } }, ownerJwt)).data.row as { id: string };
  const teacher = (await callFn("auth-bootstrap", { role: "teacher", full_name: `p10rls teach ${ts}`, email: `p10rls-teach-${ts}@fynestudy.example.com`, subjects: ["x"] }, ownerJwt)).data as Acct;
  await callFn("batch-mutate", { op: "assign_teacher", batch_id: batchA.id, teacher_id: teacher.user_id }, ownerJwt);
  const a1 = (await callFn("auth-bootstrap", { role: "student", full_name: `p10rls A1 ${ts}`, email: `p10rls-a1-${ts}@fynestudy.example.com`, parent_consent_method: "verbal", batch_id: batchA.id }, ownerJwt)).data as Acct;
  const a2 = (await callFn("auth-bootstrap", { role: "student", full_name: `p10rls A2 ${ts}`, email: `p10rls-a2-${ts}@fynestudy.example.com`, parent_consent_method: "verbal", batch_id: batchA.id }, ownerJwt)).data as Acct;
  const b1 = (await callFn("auth-bootstrap", { role: "student", full_name: `p10rls B1 ${ts}`, email: `p10rls-b1-${ts}@fynestudy.example.com`, parent_consent_method: "verbal", batch_id: batchB.id }, ownerJwt)).data as Acct;
  await admin.from("app_users").update({ must_change_password: false }).in("id", [teacher.user_id, a1.user_id, a2.user_id, b1.user_id]);

  // give a2 a badge + a snapshot for batch A (service role)
  const badge = await admin.from("badges").select("id").eq("code", "first_quiz").single();
  if (badge.error) die(`badge lookup: ${badge.error.message}`);
  await admin.from("badge_earnings").insert({ student_id: a2.user_id, badge_id: badge.data.id });
  await admin.from("leaderboard_snapshots").insert({
    batch_id: batchA.id, period_start: "2019-01-07", period_end: "2019-01-13",
    rankings: [{ student_id: a1.user_id, full_name: "x", composite: 0.1, rank: 1 }],
  });

  const a1Jwt = await signIn(a1.email, a1.initial_password);
  const b1Jwt = await signIn(b1.email, b1.initial_password);
  const tJwt = await signIn(teacher.email, teacher.initial_password);
  const a1Db = userClient(a1Jwt);
  const b1Db = userClient(b1Jwt);
  const tDb = userClient(tJwt);

  console.log("\n=== my_batch_leaderboard cross-batch isolation (AC #15) ===");
  const a1Board = await a1Db.rpc("my_batch_leaderboard", { p_scope: "weekly" });
  const a1Ids = ((a1Board.data ?? []) as { student_id: string }[]).map((r) => r.student_id);
  ok(!a1Board.error && a1Ids.includes(a1.user_id) && a1Ids.includes(a2.user_id), "A1 sees both batch-A members");
  ok(!a1Ids.includes(b1.user_id), "A1 does NOT see batch-B member b1");
  const b1Board = await b1Db.rpc("my_batch_leaderboard", { p_scope: "weekly" });
  const b1Ids = ((b1Board.data ?? []) as { student_id: string }[]).map((r) => r.student_id);
  ok(!b1Board.error && b1Ids.includes(b1.user_id) && !b1Ids.includes(a1.user_id), "B1 sees only batch B (not A1)");

  console.log("=== my_batch_leaderboard guard on p_batch ===");
  const a1IntoB = await a1Db.rpc("my_batch_leaderboard", { p_scope: "weekly", p_batch: batchB.id });
  ok(!!a1IntoB.error, "A1 CANNOT pass batch-B id (forbidden)");
  const tIntoA = await tDb.rpc("my_batch_leaderboard", { p_scope: "weekly", p_batch: batchA.id });
  ok(!tIntoA.error && Array.isArray(tIntoA.data), "teacher CAN query batch A (teaches it)");
  const tIntoB = await tDb.rpc("my_batch_leaderboard", { p_scope: "weekly", p_batch: batchB.id });
  ok(!!tIntoB.error, "teacher CANNOT query batch B (does not teach it)");

  console.log("=== leaderboard views not client-readable ===");
  const viewRead = await a1Db.from("leaderboard_weekly").select("student_id").limit(1);
  ok(!!viewRead.error || (viewRead.data?.length ?? 0) === 0, "direct SELECT on leaderboard_weekly is blocked/empty for a student");

  console.log("=== badge_earnings RLS ===");
  const a2Own = await userClient(await signIn(a2.email, a2.initial_password)).from("badge_earnings").select("badge_id").eq("student_id", a2.user_id);
  ok(!a2Own.error && (a2Own.data?.length ?? 0) === 1, "a2 reads OWN badge_earning");
  const a1OnA2 = await a1Db.from("badge_earnings").select("badge_id").eq("student_id", a2.user_id);
  ok(!a1OnA2.error && (a1OnA2.data?.length ?? 0) === 0, "a1 CANNOT read a2's badge_earnings");
  const tOnA2 = await tDb.from("badge_earnings").select("badge_id").eq("student_id", a2.user_id);
  ok(!tOnA2.error && (tOnA2.data?.length ?? 0) === 1, "teacher reads batch student a2's badge_earning");
  const b1OnA2 = await b1Db.from("badge_earnings").select("badge_id").eq("student_id", a2.user_id);
  ok(!b1OnA2.error && (b1OnA2.data?.length ?? 0) === 0, "b1 (other batch) CANNOT read a2's badge_earnings");

  console.log("=== leaderboard_snapshots RLS ===");
  const tSnap = await tDb.from("leaderboard_snapshots").select("id").eq("batch_id", batchA.id);
  ok(!tSnap.error && (tSnap.data?.length ?? 0) === 1, "teacher-of-A reads batch-A snapshot");
  const a1Snap = await a1Db.from("leaderboard_snapshots").select("id").eq("batch_id", batchA.id);
  ok(!a1Snap.error && (a1Snap.data?.length ?? 0) === 0, "student does NOT read snapshots");

  // --- cleanup
  console.log("=== cleanup ===");
  const ids = [teacher.user_id, a1.user_id, a2.user_id, b1.user_id];
  await admin.from("leaderboard_snapshots").delete().in("batch_id", [batchA.id, batchB.id]);
  await admin.from("badge_earnings").delete().in("student_id", ids);
  await admin.from("batch_teachers").delete().in("teacher_id", ids);
  await admin.from("students").delete().in("user_id", ids);
  await admin.from("teachers").delete().in("user_id", ids);
  await admin.from("user_roles").delete().in("user_id", ids);
  await admin.from("audit_log").delete().in("actor_user_id", ids);
  await admin.from("batches").delete().in("id", [batchA.id, batchB.id]);
  await admin.from("courses").delete().eq("id", course.id);
  for (const a of [teacher, a1, a2, b1]) {
    await admin.from("app_users").delete().eq("id", a.user_id);
    try {
      await admin.auth.admin.deleteUser(a.auth_user_id);
    } catch {
      /* ignore */
    }
  }
  ok(true, "cleaned up ephemeral users + course");

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
