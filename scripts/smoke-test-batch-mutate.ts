// scripts/smoke-test-batch-mutate.ts
// Phase 3 CP7 — exercises batch-mutate edge fn for all 8 ops.

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, "..", "apps", "admin", ".env.local"), override: false });

const SUPABASE_URL = need("NEXT_PUBLIC_SUPABASE_URL");
const ANON_KEY = need("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const SERVICE_KEY = need("SUPABASE_SERVICE_ROLE_KEY");
const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "owner@fynestudy.example.com";
const OWNER_PASSWORD = process.env.OWNER_INITIAL_PASSWORD ?? "FyneStudy01";

function need(name: string): string {
  const v = process.env[name];
  if (!v) { console.error(`missing env ${name}`); process.exit(1); }
  return v;
}
function header(s: string): void { console.log(`\n=== ${s} ===`); }
function pass(s: string): void { console.log(`  PASS  ${s}`); }
function fail(s: string): never { console.error(`  FAIL  ${s}`); process.exit(1); }

async function signIn(email: string, pw: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: pw }),
  });
  const d = await res.json();
  if (!res.ok) fail(`signIn: ${res.status} ${JSON.stringify(d)}`);
  return d.access_token as string;
}

async function call(body: unknown, jwt: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/batch-mutate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function main(): Promise<void> {
  const jwt = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const ts = Date.now();

  header("Setup — pick NEET_UG course id");
  const { data: course } = await admin.from("courses").select("id").eq("code", "NEET_UG").single();
  if (!course) fail("NEET_UG missing");
  const courseId = course.id;
  pass(`course=${courseId}`);

  header("Test 1 — create_batch");
  const r1 = await call({
    op: "create_batch",
    payload: { course_id: courseId, name: `BM Smoke ${ts}`, starts_on: new Date().toISOString().slice(0,10), capacity: 5 },
  }, jwt);
  if (r1.status !== 200) fail(`${r1.status} ${JSON.stringify(r1.body)}`);
  const batchId = (r1.body.row as { id: string }).id;
  pass(`batch ${batchId}`);

  header("Test 2 — update_batch (rename + reduce capacity)");
  const r2 = await call({ op: "update_batch", id: batchId, patch: { name: `BM Smoke Renamed ${ts}`, capacity: 3 } }, jwt);
  if (r2.status !== 200) fail(`${r2.status} ${JSON.stringify(r2.body)}`);
  const row2 = r2.body.row as { capacity: number };
  if (row2.capacity !== 3) fail("capacity not updated");
  pass("renamed + capacity 3");

  header("Test 3 — create_batch with dup name -> 409");
  const r3 = await call({
    op: "create_batch",
    payload: { course_id: courseId, name: `BM Smoke Renamed ${ts}`, starts_on: new Date().toISOString().slice(0,10), capacity: 1 },
  }, jwt);
  if (r3.status !== 409) fail(`expected 409, got ${r3.status}`);
  pass("409 dup name");

  header("Test 4 — assign_teacher (bootstrap fresh teacher first)");
  const tEmail = `bm-smoke-t-${ts}@fynestudy.example.com`;
  const bootstrapRes = await fetch(`${SUPABASE_URL}/functions/v1/auth-bootstrap`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "teacher", full_name: `BM Smoke Teacher ${ts}`, email: tEmail, subjects: ["physics"] }),
  });
  const tData = await bootstrapRes.json();
  if (bootstrapRes.status !== 200) fail(`bootstrap teacher: ${bootstrapRes.status} ${JSON.stringify(tData)}`);
  const teacherId = tData.user_id as string;
  const r4 = await call({ op: "assign_teacher", batch_id: batchId, teacher_id: teacherId }, jwt);
  if (r4.status !== 200) fail(`${r4.status} ${JSON.stringify(r4.body)}`);
  pass("teacher assigned");

  header("Test 5 — assign_teacher (same again) -> 409");
  const r5 = await call({ op: "assign_teacher", batch_id: batchId, teacher_id: teacherId }, jwt);
  if (r5.status !== 409) fail(`expected 409, got ${r5.status} ${JSON.stringify(r5.body)}`);
  pass("409 dup assignment");

  header("Test 6 — create_schedule_row");
  const r6 = await call({
    op: "create_schedule_row",
    payload: { batch_id: batchId, weekday: 1, start_time: "18:00", end_time: "21:00" },
  }, jwt);
  if (r6.status !== 200) fail(`${r6.status} ${JSON.stringify(r6.body)}`);
  const scheduleId = (r6.body.row as { id: string }).id;
  pass(`schedule row ${scheduleId}`);

  header("Test 7 — create_schedule_row with end<=start -> 400");
  const r7 = await call({
    op: "create_schedule_row",
    payload: { batch_id: batchId, weekday: 1, start_time: "18:00", end_time: "18:00" },
  }, jwt);
  if (r7.status !== 400) fail(`expected 400, got ${r7.status}`);
  pass("400 invalid range");

  header("Test 8 — unassign_teacher");
  const r8 = await call({ op: "unassign_teacher", batch_id: batchId, teacher_id: teacherId }, jwt);
  if (r8.status !== 200) fail(`${r8.status} ${JSON.stringify(r8.body)}`);
  pass("unassigned");

  header("Test 9 — delete_schedule_row");
  const r9 = await call({ op: "delete_schedule_row", id: scheduleId }, jwt);
  if (r9.status !== 200) fail(`${r9.status} ${JSON.stringify(r9.body)}`);
  pass("schedule deleted");

  header("Test 10 — delete_batch (empty now)");
  const r10 = await call({ op: "delete_batch", id: batchId }, jwt);
  if (r10.status !== 200) fail(`${r10.status} ${JSON.stringify(r10.body)}`);
  pass("batch deleted");

  header("Test 11 — delete_batch on default batch with students -> 409");
  const { data: defaultBatch } = await admin.from("batches").select("id").eq("name", "Default Batch (rename me)").single();
  if (!defaultBatch) fail("default batch missing");
  const r11 = await call({ op: "delete_batch", id: defaultBatch.id }, jwt);
  if (r11.status !== 409) fail(`expected 409 (FK constraint), got ${r11.status} ${JSON.stringify(r11.body)}`);
  pass("409 FK protected default batch");

  console.log("\nALL 11 BATCH-MUTATE SMOKE TESTS PASSED.");
}

main().catch((err) => fail(err instanceof Error ? (err.stack ?? err.message) : String(err)));
