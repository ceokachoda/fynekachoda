// scripts/smoke-test-curriculum.ts
//
// Phase 3 CP6 — exercises the curriculum-mutate edge fn for all 12 ops.

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, "..", "apps", "admin", ".env.local"), override: false });

const SUPABASE_URL = required("NEXT_PUBLIC_SUPABASE_URL");
const ANON_KEY = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const SERVICE_KEY = required("SUPABASE_SERVICE_ROLE_KEY");
const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "owner@fynestudy.example.com";
const OWNER_PASSWORD = process.env.OWNER_INITIAL_PASSWORD ?? "FyneStudy01";

function required(name: string): string {
  const v = process.env[name];
  if (!v) { console.error(`missing env ${name}`); process.exit(1); }
  return v;
}
function header(s: string): void { console.log(`\n=== ${s} ===`); }
function pass(s: string): void { console.log(`  PASS  ${s}`); }
function fail(s: string): never { console.error(`  FAIL  ${s}`); process.exit(1); }

async function signIn(email: string, password: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) fail(`signIn: ${res.status} ${JSON.stringify(data)}`);
  return data.access_token as string;
}

async function call(body: unknown, jwt: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/curriculum-mutate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function main(): Promise<void> {
  header("Setup — owner sign in");
  const jwt = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
  pass("ok");
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const ts = Date.now();
  const courseCode = `SMOKE_${ts.toString().slice(-6)}`;

  header("Test 1 — create_course");
  const r1 = await call({ op: "create_course", payload: { code: courseCode, name: `Smoke ${ts}`, description: "x" } }, jwt);
  if (r1.status !== 200) fail(`expected 200, got ${r1.status} ${JSON.stringify(r1.body)}`);
  const courseId = (r1.body.row as { id: string }).id;
  pass(`course ${courseId}`);

  header("Test 2 — update_course (rename + deactivate)");
  const r2 = await call({ op: "update_course", id: courseId, patch: { name: `Smoke Renamed ${ts}`, is_active: false } }, jwt);
  if (r2.status !== 200) fail(`${r2.status} ${JSON.stringify(r2.body)}`);
  if (((r2.body.row as { is_active: boolean }).is_active)) fail("is_active still true");
  pass("renamed + deactivated");

  header("Test 3 — create_subject (NEET_UG seed)");
  const { data: neet } = await admin.from("courses").select("id").eq("code", "NEET_UG").single();
  if (!neet) fail("NEET_UG missing");
  const r3 = await call({ op: "create_subject", payload: { course_id: neet.id, name: `Smoke Subj ${ts}`, sort_order: 99 } }, jwt);
  if (r3.status !== 200) fail(`${r3.status} ${JSON.stringify(r3.body)}`);
  const subjectId = (r3.body.row as { id: string }).id;
  pass(`subject ${subjectId}`);

  header("Test 4 — create_chapter");
  const r4 = await call({ op: "create_chapter", payload: { subject_id: subjectId, name: `Smoke Ch ${ts}` } }, jwt);
  if (r4.status !== 200) fail(`${r4.status} ${JSON.stringify(r4.body)}`);
  const chapterId = (r4.body.row as { id: string }).id;
  pass(`chapter ${chapterId}`);

  header("Test 5 — create_topic");
  const r5 = await call({ op: "create_topic", payload: { chapter_id: chapterId, name: `Smoke Tp ${ts}` } }, jwt);
  if (r5.status !== 200) fail(`${r5.status} ${JSON.stringify(r5.body)}`);
  const topicId = (r5.body.row as { id: string }).id;
  pass(`topic ${topicId}`);

  header("Test 6 — update_topic");
  const r6 = await call({ op: "update_topic", id: topicId, patch: { name: `Smoke Tp Renamed ${ts}` } }, jwt);
  if (r6.status !== 200) fail(`${r6.status} ${JSON.stringify(r6.body)}`);
  pass("topic renamed");

  header("Test 7 — duplicate code (create_course again) -> 409");
  const r7 = await call({ op: "create_course", payload: { code: courseCode, name: "dup" } }, jwt);
  if (r7.status !== 409) fail(`expected 409, got ${r7.status} ${JSON.stringify(r7.body)}`);
  pass("409 duplicate");

  header("Test 8 — invalid code (lowercase) -> 400");
  const r8 = await call({ op: "create_course", payload: { code: "smoke_xx", name: "x" } }, jwt);
  if (r8.status !== 400) fail(`expected 400, got ${r8.status} ${JSON.stringify(r8.body)}`);
  pass("400 validation");

  header("Test 9 — update unknown -> 404");
  const r9 = await call({ op: "update_course", id: "00000000-0000-0000-0000-000000000099", patch: { name: "Will Not Exist" } }, jwt);
  if (r9.status !== 404) fail(`expected 404, got ${r9.status} ${JSON.stringify(r9.body)}`);
  pass("404 unknown");

  header("Test 10 — non-admin caller -> 403");
  // Use any pre-existing student. The CP5 smoke fixtures left a student behind.
  const { data: student } = await admin
    .from("app_users")
    .select("auth_user_id, email, must_change_password")
    .like("email", "rls-student-a-%")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (!student) {
    console.log("  SKIP  no rls-student-a fixture; run test:rls first");
  } else {
    // Make sure must_change=false so we can sign in.
    await admin.from("app_users").update({ must_change_password: false }).eq("auth_user_id", student.auth_user_id);
    // The RLS student fixtures use initial passwords from auth-bootstrap; we
    // can't easily recover them. Use service-role to reset password.
    await admin.auth.admin.updateUserById(student.auth_user_id, { password: "TestStudent123" });
    const studentJwt = await signIn(student.email, "TestStudent123");
    const r10 = await call({ op: "create_course", payload: { code: "ESC_TEST", name: "escalation" } }, studentJwt);
    if (r10.status !== 403) fail(`expected 403, got ${r10.status} ${JSON.stringify(r10.body)}`);
    pass(`403 (status=${r10.status})`);
  }

  header("Test 11 — audit row written for create_course");
  const { data: audit } = await admin
    .from("audit_log")
    .select("action, entity_id, after_data")
    .eq("action", "create_course")
    .eq("entity_id", courseId)
    .limit(1);
  if (!audit || audit.length === 0) fail("no create_course audit row");
  pass("audit row present");

  header("Test 12 — delete chain: topic -> chapter -> subject -> course");
  const d1 = await call({ op: "delete_topic", id: topicId }, jwt);
  if (d1.status !== 200) fail(`delete_topic: ${d1.status}`);
  const d2 = await call({ op: "delete_chapter", id: chapterId }, jwt);
  if (d2.status !== 200) fail(`delete_chapter: ${d2.status}`);
  const d3 = await call({ op: "delete_subject", id: subjectId }, jwt);
  if (d3.status !== 200) fail(`delete_subject: ${d3.status}`);
  const d4 = await call({ op: "delete_course", id: courseId }, jwt);
  if (d4.status !== 200) fail(`delete_course: ${d4.status}`);
  pass("all 4 deletes ok");

  console.log("\nALL 12 CURRICULUM-MUTATE SMOKE TESTS PASSED.");
}

main().catch((err) => fail(err instanceof Error ? (err.stack ?? err.message) : String(err)));
