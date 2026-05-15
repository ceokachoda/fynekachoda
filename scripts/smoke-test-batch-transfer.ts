// scripts/smoke-test-batch-transfer.ts
//
// Phase 3 CP4 — exercises the batch-transfer edge fn end-to-end against the
// live dev project. Mirrors the test plan in phase-3.md §10:
//
//   - happy path (admin moves a fresh student between two batches)
//   - capacity check (capacity=1 batch already holding one student rejects another)
//   - inactive batch (active=false target → 409)
//   - already-in-target (no-op rejected with 409)
//   - non-admin caller (student JWT → 403)
//
// Owner credentials default to owner@fynestudy.example.com / FyneStudy01.

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({
  path: resolve(__dirname, "..", "apps", "admin", ".env.local"),
  override: false,
});

const SUPABASE_URL = required("NEXT_PUBLIC_SUPABASE_URL");
const ANON_KEY = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const SERVICE_KEY = required("SUPABASE_SERVICE_ROLE_KEY");
const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "owner@fynestudy.example.com";
const OWNER_PASSWORD = process.env.OWNER_INITIAL_PASSWORD ?? "FyneStudy01";

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`missing env var ${name} (check apps/admin/.env.local)`);
    process.exit(1);
  }
  return v;
}

function header(name: string): void {
  console.log(`\n=== ${name} ===`);
}
function pass(msg: string): void {
  console.log(`  PASS  ${msg}`);
}
function fail(msg: string): never {
  console.error(`  FAIL  ${msg}`);
  process.exit(1);
}

async function signIn(email: string, password: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) fail(`signIn ${email}: ${res.status} ${JSON.stringify(data)}`);
  return data.access_token as string;
}

async function callFn(
  name: string,
  body: unknown,
  jwt: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as Record<string, unknown>;
  return { status: res.status, body: data };
}

async function main(): Promise<void> {
  header("Setup — sign in as owner");
  const ownerJwt = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
  pass("owner JWT acquired");

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const ts = Date.now();

  header("Setup — load NEET_UG course id");
  const { data: course } = await admin
    .from("courses")
    .select("id")
    .eq("code", "NEET_UG")
    .single();
  if (!course) fail("NEET_UG course missing — CP1 seed not applied?");
  const courseId = course.id;

  header("Setup — create Batch A (capacity 80) + Batch B (capacity 80) + Batch C (capacity 1, inactive) + Batch D (capacity 1)");
  const { data: batchA } = await admin
    .from("batches")
    .insert({
      course_id: courseId,
      name: `Smoke Batch A ${ts}`,
      starts_on: new Date().toISOString().slice(0, 10),
      capacity: 80,
    })
    .select("id")
    .single();
  const { data: batchB } = await admin
    .from("batches")
    .insert({
      course_id: courseId,
      name: `Smoke Batch B ${ts}`,
      starts_on: new Date().toISOString().slice(0, 10),
      capacity: 80,
    })
    .select("id")
    .single();
  const { data: batchInactive } = await admin
    .from("batches")
    .insert({
      course_id: courseId,
      name: `Smoke Batch Inactive ${ts}`,
      starts_on: new Date().toISOString().slice(0, 10),
      capacity: 80,
      is_active: false,
    })
    .select("id")
    .single();
  const { data: batchFull } = await admin
    .from("batches")
    .insert({
      course_id: courseId,
      name: `Smoke Batch Full ${ts}`,
      starts_on: new Date().toISOString().slice(0, 10),
      capacity: 1,
    })
    .select("id")
    .single();
  if (!batchA || !batchB || !batchInactive || !batchFull) {
    fail("could not create one or more smoke batches");
  }
  pass(`batches: A=${batchA.id}, B=${batchB.id}, Inactive=${batchInactive.id}, Full=${batchFull.id}`);

  header("Setup — bootstrap two students (S1 -> Batch A, S2 -> Batch Full)");
  const s1Bootstrap = await callFn(
    "auth-bootstrap",
    {
      role: "student",
      full_name: `Smoke S1 ${ts}`,
      email: `smoke-bt-s1-${ts}@fynestudy.example.com`,
      batch_id: batchA.id,
      parent_consent_method: "verbal",
    },
    ownerJwt,
  );
  if (s1Bootstrap.status !== 200) fail(`S1 bootstrap: ${s1Bootstrap.status} ${JSON.stringify(s1Bootstrap.body)}`);
  const s1UserId = s1Bootstrap.body.user_id as string;
  const s1Email = s1Bootstrap.body.email as string;
  const s1Pass = s1Bootstrap.body.initial_password as string;

  const s2Bootstrap = await callFn(
    "auth-bootstrap",
    {
      role: "student",
      full_name: `Smoke S2 ${ts}`,
      email: `smoke-bt-s2-${ts}@fynestudy.example.com`,
      batch_id: batchFull.id,
      parent_consent_method: "verbal",
    },
    ownerJwt,
  );
  if (s2Bootstrap.status !== 200) fail(`S2 bootstrap: ${s2Bootstrap.status} ${JSON.stringify(s2Bootstrap.body)}`);
  const s2UserId = s2Bootstrap.body.user_id as string;
  pass(`S1=${s1UserId} in Batch A; S2=${s2UserId} in Batch Full`);

  header("Test 1 — Happy path: admin transfers S1 from Batch A to Batch B");
  const t1 = await callFn(
    "batch-transfer",
    { student_id: s1UserId, to_batch_id: batchB.id, reason: "smoke happy path" },
    ownerJwt,
  );
  if (t1.status !== 200) fail(`expected 200, got ${t1.status} ${JSON.stringify(t1.body)}`);
  if (t1.body.to_batch_id !== batchB.id) fail(`returned wrong to_batch_id: ${t1.body.to_batch_id}`);
  if (t1.body.from_batch_id !== batchA.id) fail(`returned wrong from_batch_id: ${t1.body.from_batch_id}`);
  // Verify DB state via service role.
  const { data: s1After } = await admin
    .from("students")
    .select("batch_id")
    .eq("user_id", s1UserId)
    .single();
  if (s1After?.batch_id !== batchB.id) fail(`DB-level: S1 not in Batch B (batch_id=${s1After?.batch_id})`);
  pass(`S1 moved to Batch B, DB confirms`);

  header("Test 2 — Audit log entry for the transfer");
  const { data: auditRows } = await admin
    .from("audit_log")
    .select("action, before_data, after_data")
    .eq("entity_table", "students")
    .eq("entity_id", s1UserId)
    .eq("action", "transfer_student")
    .order("occurred_at", { ascending: false })
    .limit(1);
  if (!auditRows || auditRows.length === 0) fail("no transfer_student audit row");
  const aud = auditRows[0];
  if ((aud.before_data as { batch_id: string })?.batch_id !== batchA.id) {
    fail(`audit before_data.batch_id != Batch A: ${JSON.stringify(aud.before_data)}`);
  }
  const afterData = aud.after_data as { batch_id: string; reason: string };
  if (afterData?.batch_id !== batchB.id) {
    fail(`audit after_data.batch_id != Batch B: ${JSON.stringify(aud.after_data)}`);
  }
  if (afterData?.reason !== "smoke happy path") {
    fail(`audit reason not preserved: ${JSON.stringify(aud.after_data)}`);
  }
  pass(`audit row recorded before/after + reason`);

  header("Test 3 — Capacity check: transfer S1 to Batch Full (cap=1, already holds S2) -> 409");
  const t3 = await callFn(
    "batch-transfer",
    { student_id: s1UserId, to_batch_id: batchFull.id, reason: "smoke capacity" },
    ownerJwt,
  );
  if (t3.status !== 409) fail(`expected 409, got ${t3.status} ${JSON.stringify(t3.body)}`);
  if (t3.body.error !== "batch full") fail(`expected error="batch full", got ${JSON.stringify(t3.body)}`);
  // DB state must be unchanged.
  const { data: s1Recheck } = await admin
    .from("students")
    .select("batch_id")
    .eq("user_id", s1UserId)
    .single();
  if (s1Recheck?.batch_id !== batchB.id) fail(`S1 batch changed despite 409 (now ${s1Recheck?.batch_id})`);
  pass(`409 batch full; S1 still in Batch B`);

  header("Test 4 — Inactive batch: transfer S1 to Batch Inactive -> 409");
  const t4 = await callFn(
    "batch-transfer",
    { student_id: s1UserId, to_batch_id: batchInactive.id, reason: "smoke inactive" },
    ownerJwt,
  );
  if (t4.status !== 409) fail(`expected 409, got ${t4.status} ${JSON.stringify(t4.body)}`);
  if (t4.body.error !== "target batch is inactive") {
    fail(`expected error="target batch is inactive", got ${JSON.stringify(t4.body)}`);
  }
  pass(`409 inactive batch rejected`);

  header("Test 5 — Already in target: transfer S1 from Batch B to Batch B -> 409");
  const t5 = await callFn(
    "batch-transfer",
    { student_id: s1UserId, to_batch_id: batchB.id, reason: "smoke noop" },
    ownerJwt,
  );
  if (t5.status !== 409) fail(`expected 409, got ${t5.status} ${JSON.stringify(t5.body)}`);
  if (t5.body.error !== "student already in this batch") {
    fail(`expected error="student already in this batch", got ${JSON.stringify(t5.body)}`);
  }
  pass(`409 same-batch transfer rejected`);

  header("Test 6 — Non-admin caller (student JWT) -> 403");
  // S1 must change password first so we can sign in.
  // Easier: use the auth-clear-must-change pattern via service role + setting must_change_password=false directly.
  await admin.from("app_users").update({ must_change_password: false }).eq("id", s1UserId);
  const s1Jwt = await signIn(s1Email, s1Pass);
  const t6 = await callFn(
    "batch-transfer",
    { student_id: s1UserId, to_batch_id: batchA.id, reason: "smoke escalation attempt" },
    s1Jwt,
  );
  if (t6.status !== 403) fail(`expected 403, got ${t6.status} ${JSON.stringify(t6.body)}`);
  pass(`403 non-admin caller blocked (status=${t6.status})`);

  header("Test 7 — Unknown student_id -> 404");
  const fakeStudent = "00000000-0000-0000-0000-000000000001";
  const t7 = await callFn(
    "batch-transfer",
    { student_id: fakeStudent, to_batch_id: batchA.id, reason: "smoke 404" },
    ownerJwt,
  );
  if (t7.status !== 404) fail(`expected 404, got ${t7.status} ${JSON.stringify(t7.body)}`);
  pass(`404 unknown student blocked`);

  header("Test 8 — Unknown target batch -> 404");
  const fakeBatch = "00000000-0000-0000-0000-000000000002";
  const t8 = await callFn(
    "batch-transfer",
    { student_id: s1UserId, to_batch_id: fakeBatch, reason: "smoke 404" },
    ownerJwt,
  );
  if (t8.status !== 404) fail(`expected 404, got ${t8.status} ${JSON.stringify(t8.body)}`);
  pass(`404 unknown target batch blocked`);

  console.log(`\nALL 8 BATCH-TRANSFER SMOKE TESTS PASSED.`);
  console.log(`Fixtures left in place (idempotent re-run timestamps):`);
  console.log(`  S1: smoke-bt-s1-${ts}@fynestudy.example.com (now in Batch B)`);
  console.log(`  S2: smoke-bt-s2-${ts}@fynestudy.example.com (still in Batch Full)`);
}

main().catch((err) => {
  fail(err instanceof Error ? (err.stack ?? err.message) : String(err));
});
