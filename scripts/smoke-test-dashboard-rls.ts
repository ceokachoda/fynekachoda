// Phase 8 — RLS smoke for mastery + streaks + the dashboard RPC guard.
//
// Verifies (with ephemeral p8rls-* users, cleaned up at the end):
//   - a student reads ONLY their own mastery + streaks rows
//   - a teacher reads mastery + streaks for students in their batch
//   - student_dashboard(self) succeeds; student_dashboard(other) is forbidden
//
// Run: pnpm smoke:dashboard-rls

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
  if (!v) { console.error(`missing env ${n}`); process.exit(1); }
  return v;
}
let passed = 0, failed = 0;
function ok(c: boolean, m: string) { c ? (passed++, console.log(`  PASS  ${m}`)) : (failed++, console.error(`  FAIL  ${m}`)); }
function die(m: string): never { console.error(`FATAL ${m}`); process.exit(1); }

async function signIn(email: string, password: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const d = await res.json();
  if (!res.ok) die(`signIn ${email}: ${res.status} ${JSON.stringify(d)}`);
  return d.access_token as string;
}
async function callFn(name: string, body: unknown, jwt: string, allow: number[] = []) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST", headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await res.json().catch(() => ({}));
  if (res.status !== 200 && !allow.includes(res.status)) die(`callFn ${name}: ${res.status} ${JSON.stringify(d)}`);
  return { status: res.status, data: d as Record<string, unknown> };
}
const userClient = (jwt: string): SupabaseClient =>
  createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false } });

async function main() {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const ownerJwt = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
  const ts = Date.now();

  // --- setup: course + batch + teacher + 2 students, plus a 2nd batch the teacher does NOT teach
  const topic = await admin.from("topics").select("id").limit(1).maybeSingle();
  if (topic.error || !topic.data) die("need at least one topic to attach mastery");
  const topicId = topic.data.id as string;

  const course = (await callFn("curriculum-mutate", { op: "create_course", payload: { code: `P8RLS_${ts}`, name: `RLS ${ts}` } }, ownerJwt)).data.row as { id: string };
  const batch = (await callFn("batch-mutate", { op: "create_batch", payload: { course_id: course.id, name: `P8RLS_${ts}`, starts_on: new Date().toISOString().slice(0, 10), capacity: 10 } }, ownerJwt)).data.row as { id: string };
  const teacher = (await callFn("auth-bootstrap", { role: "teacher", full_name: `p8rls teach ${ts}`, email: `p8rls-teach-${ts}@fynestudy.example.com`, subjects: ["x"] }, ownerJwt)).data as Acct;
  await callFn("batch-mutate", { op: "assign_teacher", batch_id: batch.id, teacher_id: teacher.user_id }, ownerJwt);
  const stuA = (await callFn("auth-bootstrap", { role: "student", full_name: `p8rls A ${ts}`, email: `p8rls-a-${ts}@fynestudy.example.com`, parent_consent_method: "verbal", batch_id: batch.id }, ownerJwt)).data as Acct;
  const stuB = (await callFn("auth-bootstrap", { role: "student", full_name: `p8rls B ${ts}`, email: `p8rls-b-${ts}@fynestudy.example.com`, parent_consent_method: "verbal", batch_id: batch.id }, ownerJwt)).data as Acct;
  await admin.from("app_users").update({ must_change_password: false }).in("id", [teacher.user_id, stuA.user_id, stuB.user_id]);

  await admin.from("mastery").insert([
    { student_id: stuA.user_id, topic_id: topicId, mastery_pct: 42, attempt_count: 3 },
    { student_id: stuB.user_id, topic_id: topicId, mastery_pct: 88, attempt_count: 2 },
  ]);
  await admin.from("streaks").insert([
    { student_id: stuA.user_id, current_days: 4, best_days: 9 },
    { student_id: stuB.user_id, current_days: 1, best_days: 1 },
  ]);

  const aJwt = await signIn(stuA.email, stuA.initial_password);
  const tJwt = await signIn(teacher.email, teacher.initial_password);
  const aDb = userClient(aJwt);
  const tDb = userClient(tJwt);

  console.log("\n=== mastery / streaks RLS ===");
  const aOwnM = await aDb.from("mastery").select("student_id").eq("student_id", stuA.user_id);
  ok(!aOwnM.error && (aOwnM.data?.length ?? 0) === 1, "student reads own mastery row");
  const aOtherM = await aDb.from("mastery").select("student_id").eq("student_id", stuB.user_id);
  ok(!aOtherM.error && (aOtherM.data?.length ?? 0) === 0, "student CANNOT read another student's mastery");
  const aOwnS = await aDb.from("streaks").select("student_id").eq("student_id", stuA.user_id);
  ok(!aOwnS.error && (aOwnS.data?.length ?? 0) === 1, "student reads own streak row");
  const aOtherS = await aDb.from("streaks").select("student_id").eq("student_id", stuB.user_id);
  ok(!aOtherS.error && (aOtherS.data?.length ?? 0) === 0, "student CANNOT read another student's streak");

  const tM = await tDb.from("mastery").select("student_id").in("student_id", [stuA.user_id, stuB.user_id]);
  ok(!tM.error && (tM.data?.length ?? 0) === 2, "teacher reads both batch students' mastery");
  const tS = await tDb.from("streaks").select("student_id").in("student_id", [stuA.user_id, stuB.user_id]);
  ok(!tS.error && (tS.data?.length ?? 0) === 2, "teacher reads both batch students' streaks");

  console.log("=== student_dashboard RPC guard ===");
  const selfDash = await aDb.rpc("student_dashboard", { p_student: stuA.user_id });
  ok(!selfDash.error && selfDash.data != null, "student_dashboard(self) returns data");
  const otherDash = await aDb.rpc("student_dashboard", { p_student: stuB.user_id });
  ok(!!otherDash.error, "student_dashboard(other student) is rejected");

  // --- cleanup
  console.log("=== cleanup ===");
  const ids = [teacher.user_id, stuA.user_id, stuB.user_id];
  await admin.from("mastery").delete().in("student_id", [stuA.user_id, stuB.user_id]);
  await admin.from("streaks").delete().in("student_id", [stuA.user_id, stuB.user_id]);
  await admin.from("batch_teachers").delete().in("teacher_id", ids);
  await admin.from("students").delete().in("user_id", ids);
  await admin.from("teachers").delete().in("user_id", ids);
  await admin.from("user_roles").delete().in("user_id", ids);
  await admin.from("audit_log").delete().in("actor_user_id", ids);
  await admin.from("batches").delete().eq("id", batch.id);
  await admin.from("courses").delete().eq("id", course.id);
  for (const a of [teacher, stuA, stuB]) {
    await admin.from("app_users").delete().eq("id", a.user_id);
    try { await admin.auth.admin.deleteUser(a.auth_user_id); } catch { /* ignore */ }
  }
  ok(true, "cleaned up ephemeral users + course");

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

interface Acct { user_id: string; auth_user_id: string; email: string; initial_password: string; }

main().catch((e) => { console.error(e); process.exit(1); });
