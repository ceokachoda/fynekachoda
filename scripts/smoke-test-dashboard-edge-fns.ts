// Phase 8 — edge-fn / RPC HTTP smoke for the dashboard surface.
//
// Verifies over HTTP (ephemeral p8fn-* fixtures, cleaned up at the end):
//   - student_dashboard / teacher_dashboard / teacher_batch_overview RPCs
//   - student_dashboard(other) is rejected over REST
//   - mastery-recompute + streak-recompute require an admin role (403 for student)
//   - mastery-recompute actually upserts a mastery row from a submitted attempt
//
// Run: pnpm smoke:dashboard-fns

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
async function fn(name: string, body: unknown, jwt: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST", headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) as Record<string, unknown> };
}
async function rpc(name: string, body: unknown, jwt: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => null) as Record<string, unknown> | null };
}
async function call(name: string, body: unknown, jwt: string, allow: number[] = []) {
  const r = await fn(name, body, jwt);
  if (r.status !== 200 && !allow.includes(r.status)) die(`setup ${name}: ${r.status} ${JSON.stringify(r.data)}`);
  return r;
}

async function main() {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const ownerJwt = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
  const ts = Date.now();

  // --- setup
  const course = (await call("curriculum-mutate", { op: "create_course", payload: { code: `P8FN_${ts}`, name: `FN ${ts}` } }, ownerJwt)).data.row as { id: string };
  const subject = (await call("curriculum-mutate", { op: "create_subject", payload: { course_id: course.id, name: "S", sort_order: 0 } }, ownerJwt)).data.row as { id: string };
  const chapter = (await call("curriculum-mutate", { op: "create_chapter", payload: { subject_id: subject.id, name: "C", sort_order: 0 } }, ownerJwt)).data.row as { id: string };
  const topicId = ((await call("curriculum-mutate", { op: "create_topic", payload: { chapter_id: chapter.id, name: "T", sort_order: 0 } }, ownerJwt)).data.row as { id: string }).id;
  const batch = (await call("batch-mutate", { op: "create_batch", payload: { course_id: course.id, name: `P8FN_${ts}`, starts_on: new Date().toISOString().slice(0, 10), capacity: 10 } }, ownerJwt)).data.row as { id: string };
  const teacher = (await call("auth-bootstrap", { role: "teacher", full_name: `p8fn teach ${ts}`, email: `p8fn-teach-${ts}@fynestudy.example.com`, subjects: ["x"] }, ownerJwt)).data as Acct;
  await call("batch-mutate", { op: "assign_teacher", batch_id: batch.id, teacher_id: teacher.user_id }, ownerJwt);
  const stu = (await call("auth-bootstrap", { role: "student", full_name: `p8fn stu ${ts}`, email: `p8fn-stu-${ts}@fynestudy.example.com`, parent_consent_method: "verbal", batch_id: batch.id }, ownerJwt)).data as Acct;
  const stu2 = (await call("auth-bootstrap", { role: "student", full_name: `p8fn stu2 ${ts}`, email: `p8fn-stu2-${ts}@fynestudy.example.com`, parent_consent_method: "verbal", batch_id: batch.id }, ownerJwt)).data as Acct;
  await admin.from("app_users").update({ must_change_password: false }).in("id", [teacher.user_id, stu.user_id, stu2.user_id]);

  // a question + published quiz + a submitted attempt for `stu` -> drives mastery
  const q = await admin.from("questions").insert({ topic_id: topicId, prompt_md: "Q", difficulty: "easy", created_by: teacher.user_id }).select("id").single();
  if (q.error) die(`question: ${q.error.message}`);
  await admin.from("question_options").insert([
    { question_id: q.data.id, text_md: "a", is_correct: true, sort_order: 0 },
    { question_id: q.data.id, text_md: "b", is_correct: false, sort_order: 1 },
  ]);
  const quiz = await admin.from("quizzes").insert({ title: "FN quiz", topic_id: topicId, course_id: course.id, batch_id: batch.id, is_published: true, created_by: teacher.user_id }).select("id").single();
  if (quiz.error) die(`quiz: ${quiz.error.message}`);
  await admin.from("quiz_questions").insert({ quiz_id: quiz.data.id, question_id: q.data.id, sort_order: 0 });
  await admin.from("quiz_attempts").insert({
    quiz_id: quiz.data.id, student_id: stu.user_id,
    started_at: new Date(Date.now() - 600000).toISOString(), submitted_at: new Date().toISOString(),
    score: 2, max_score: 4, correct_count: 1, wrong_count: 1, skipped_count: 0, is_practice: true,
  });

  const stuJwt = await signIn(stu.email, stu.initial_password);
  const teacherJwt = await signIn(teacher.email, teacher.initial_password);

  console.log("\n=== dashboard RPCs ===");
  const sd = await rpc("student_dashboard", { p_student: stu.user_id }, stuJwt);
  ok(sd.status === 200 && !!sd.data && "next_card" in (sd.data as object) && "streak" in (sd.data as object), "student_dashboard(self) RPC -> 200 with slices");
  const sdOther = await rpc("student_dashboard", { p_student: stu2.user_id }, stuJwt);
  ok(sdOther.status !== 200, `student_dashboard(other) rejected (status ${sdOther.status})`);
  const td = await rpc("teacher_dashboard", { p_teacher: teacher.user_id }, teacherJwt);
  ok(td.status === 200 && !!td.data && "pending" in (td.data as object), "teacher_dashboard RPC -> 200");
  const bo = await rpc("teacher_batch_overview", { p_batch: batch.id }, teacherJwt);
  ok(bo.status === 200 && !!bo.data && "at_risk" in (bo.data as object), "teacher_batch_overview RPC -> 200");

  console.log("=== recompute edge fns (admin-gated) ===");
  const mrAdmin = await fn("mastery-recompute", { student_id: stu.user_id }, ownerJwt);
  ok(mrAdmin.status === 200 && mrAdmin.data.ok === true, "mastery-recompute as admin -> 200");
  const mrStudent = await fn("mastery-recompute", { student_id: stu.user_id }, stuJwt);
  ok(mrStudent.status === 403, "mastery-recompute as student -> 403");
  const mrBad = await fn("mastery-recompute", {}, ownerJwt);
  ok(mrBad.status === 400, "mastery-recompute with no target -> 400");
  const srAdmin = await fn("streak-recompute", {}, ownerJwt);
  ok(srAdmin.status === 200 && srAdmin.data.ok === true, "streak-recompute as admin -> 200");
  const srStudent = await fn("streak-recompute", {}, stuJwt);
  ok(srStudent.status === 403, "streak-recompute as student -> 403");

  console.log("=== recompute actually wrote mastery ===");
  const m = await admin.from("mastery").select("mastery_pct, attempt_count").eq("student_id", stu.user_id).eq("topic_id", topicId).maybeSingle();
  ok(!m.error && !!m.data && Number(m.data.mastery_pct) === 50 && m.data.attempt_count === 1, "mastery row upserted: 50% from one 2/4 attempt");

  // --- cleanup
  console.log("=== cleanup ===");
  const ids = [teacher.user_id, stu.user_id, stu2.user_id];
  const qaIds = (await admin.from("quiz_attempts").select("id").in("student_id", ids)).data?.map((r: { id: string }) => r.id) ?? [];
  if (qaIds.length) await admin.from("quiz_answers").delete().in("attempt_id", qaIds);
  await admin.from("quiz_attempts").delete().in("student_id", ids);
  await admin.from("mastery").delete().in("student_id", ids);
  await admin.from("streaks").delete().in("student_id", ids);
  await admin.from("batch_teachers").delete().in("teacher_id", ids);
  await admin.from("students").delete().in("user_id", ids);
  await admin.from("teachers").delete().in("user_id", ids);
  await admin.from("user_roles").delete().in("user_id", ids);
  await admin.from("audit_log").delete().in("actor_user_id", ids);
  await admin.from("quizzes").delete().eq("course_id", course.id);
  await admin.from("questions").delete().eq("topic_id", topicId);
  await admin.from("batches").delete().eq("id", batch.id);
  await admin.from("courses").delete().eq("id", course.id);
  for (const a of [teacher, stu, stu2]) {
    await admin.from("app_users").delete().eq("id", a.user_id);
    try { await admin.auth.admin.deleteUser(a.auth_user_id); } catch { /* ignore */ }
  }
  ok(true, "cleaned up ephemeral fixtures");

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

interface Acct { user_id: string; auth_user_id: string; email: string; initial_password: string; }

main().catch((e) => { console.error(e); process.exit(1); });
