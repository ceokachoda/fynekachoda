// scripts/test-rls.ts
//
// Phase 2 CP9 — RLS tests from spec §5.9. Six scenarios, each exercised
// through the real PostgREST + JWT + RLS pipeline (no pgtap, no local
// Supabase — same pattern as smoke-test-cp5/cp8). Run with:
//
//   pnpm test:rls
//
// Creates fresh timestamped fixtures per run (2 students, 1 teacher). Owner
// credentials default to owner@fynestudy.example.com / FyneStudy01 — override
// with OWNER_EMAIL / OWNER_INITIAL_PASSWORD env vars.

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

async function signIn(email: string, password: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    fail(`signIn ${email}: ${res.status} ${JSON.stringify(data)}`);
  }
  return data.access_token as string;
}

interface BootstrappedUser {
  user_id: string;
  auth_user_id: string;
  email: string;
  initial_password: string;
}

async function bootstrap(
  role: "student" | "teacher",
  label: string,
  ts: number,
  ownerJwt: string,
): Promise<BootstrappedUser> {
  const email = `rls-${role}-${label}-${ts}@fynestudy.example.com`;
  const payload: Record<string, unknown> =
    role === "student"
      ? {
          role,
          full_name: `RLS ${role} ${label}`,
          email,
          parent_consent_method: "verbal",
          school_name: "RLS Test School",
          board: "CBSE",
          current_class: "12",
        }
      : {
          role,
          full_name: `RLS ${role} ${label}`,
          email,
          subjects: ["physics"],
        };
  const res = await callFn("auth-bootstrap", payload, ownerJwt);
  if (res.status !== 200) {
    fail(`bootstrap ${role} ${label}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body as unknown as BootstrappedUser;
}

interface RestResult<T = unknown> {
  status: number;
  body: T;
}

async function rest<T = unknown>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  jwt: string | null,
  body?: unknown,
): Promise<RestResult<T>> {
  const headers: Record<string, string> = {
    apikey: ANON_KEY,
    "Content-Type": "application/json",
  };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  if (method === "POST" || method === "PATCH") {
    headers["Prefer"] = "return=representation";
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text.length ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed as T };
}

async function main(): Promise<void> {
  header("Setup — sign in as owner");
  const ownerJwt = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
  pass("owner JWT acquired");

  const ts = Date.now();

  header("Setup — bootstrap Student A");
  const sA = await bootstrap("student", "A", ts, ownerJwt);
  pass(`Student A: ${sA.email}`);

  header("Setup — bootstrap Student B");
  const sB = await bootstrap("student", "B", ts, ownerJwt);
  pass(`Student B: ${sB.email}`);

  header("Setup — bootstrap Teacher T1");
  const t1 = await bootstrap("teacher", "T1", ts, ownerJwt);
  pass(`Teacher T1: ${t1.email}`);

  header("Setup — sign in fixtures");
  const sAJwt = await signIn(sA.email, sA.initial_password);
  const sBJwt = await signIn(sB.email, sB.initial_password);
  const t1Jwt = await signIn(t1.email, t1.initial_password);
  pass("Student A, Student B, Teacher T1 JWTs acquired");

  header("Test 1 — Student A cannot read Student B's app_users row");
  const t1Res = await rest<unknown[]>(
    "GET",
    `app_users?select=id,email&auth_user_id=eq.${sB.auth_user_id}`,
    sAJwt,
  );
  if (t1Res.status !== 200) {
    fail(`expected 200, got ${t1Res.status} ${JSON.stringify(t1Res.body)}`);
  }
  if (!Array.isArray(t1Res.body) || t1Res.body.length !== 0) {
    fail(`expected [] (RLS blocks), got ${JSON.stringify(t1Res.body)}`);
  }
  pass(`Student A sees 0 rows of Student B (response was [])`);

  header("Test 1b — sanity: Student A CAN read own app_users row");
  const t1bRes = await rest<unknown[]>(
    "GET",
    `app_users?select=id&auth_user_id=eq.${sA.auth_user_id}`,
    sAJwt,
  );
  if (!Array.isArray(t1bRes.body) || t1bRes.body.length !== 1) {
    fail(`expected 1 row (own), got ${JSON.stringify(t1bRes.body)}`);
  }
  pass(`Student A sees exactly own row`);

  header("Test 2 — Teacher T1 cannot read any students table rows (no batch_teachers wiring yet)");
  const t2Res = await rest<unknown[]>("GET", `students?select=user_id`, t1Jwt);
  if (t2Res.status !== 200) {
    fail(`expected 200, got ${t2Res.status} ${JSON.stringify(t2Res.body)}`);
  }
  if (!Array.isArray(t2Res.body) || t2Res.body.length !== 0) {
    fail(
      `expected [] (no batch_teachers), got ${t2Res.body.length} rows: ${JSON.stringify(t2Res.body).slice(0, 200)}`,
    );
  }
  pass(`Teacher T1 sees 0 student-table rows`);

  header("Test 3 — Owner can read all app_users");
  const t3Res = await rest<unknown[]>("GET", `app_users?select=id`, ownerJwt);
  if (t3Res.status !== 200) {
    fail(`expected 200, got ${t3Res.status} ${JSON.stringify(t3Res.body)}`);
  }
  if (!Array.isArray(t3Res.body) || t3Res.body.length < 4) {
    fail(
      `expected >= 4 rows (owner + sA + sB + t1 + earlier seed), got ${t3Res.body.length}`,
    );
  }
  pass(`Owner sees ${t3Res.body.length} app_users rows`);

  header("Test 4 — Anonymous (no JWT) reads return empty");
  const t4Res = await rest<unknown[]>("GET", `app_users?select=id`, null);
  if (t4Res.status !== 200) {
    fail(`expected 200, got ${t4Res.status} ${JSON.stringify(t4Res.body)}`);
  }
  if (!Array.isArray(t4Res.body) || t4Res.body.length !== 0) {
    fail(`anon saw rows: ${JSON.stringify(t4Res.body)}`);
  }
  pass(`Anon sees 0 app_users rows`);

  header("Test 5 — Student A cannot UPDATE own students.batch_id (D-016)");
  // Try to set batch_id to a bogus uuid via PostgREST PATCH.
  const fakeBatchId = "00000000-0000-0000-0000-000000000001";
  const t5Res = await rest<unknown>(
    "PATCH",
    `students?user_id=eq.${sA.user_id}`,
    sAJwt,
    { batch_id: fakeBatchId },
  );
  // RLS-blocked updates typically return 200 with empty array (no rows match
  // the policy's USING/WITH CHECK). Either way, the row must not have changed.
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: studentRow } = await admin
    .from("students")
    .select("batch_id")
    .eq("user_id", sA.user_id)
    .single();
  if (!studentRow) fail("could not read sA's students row via service role");
  if (studentRow.batch_id === fakeBatchId) {
    fail(
      `RLS leak: Student A's batch_id was changed to ${fakeBatchId} (PATCH status ${t5Res.status})`,
    );
  }
  pass(
    `Student A's batch_id unchanged (PATCH returned ${t5Res.status}, row.batch_id=${studentRow.batch_id ?? "null"})`,
  );

  header("Test 6 — Student A cannot INSERT into audit_log");
  const t6Res = await rest<unknown>("POST", `audit_log`, sAJwt, {
    actor_user_id: sA.user_id,
    actor_role: "student",
    action: "fake_action",
    entity_table: "app_users",
    entity_id: sA.user_id,
    before_data: null,
    after_data: { tampered: true },
  });
  if (t6Res.status >= 200 && t6Res.status < 300) {
    fail(
      `RLS leak: student insert succeeded with status ${t6Res.status} body=${JSON.stringify(t6Res.body)}`,
    );
  }
  pass(`audit_log insert blocked (status ${t6Res.status})`);

  // Sanity: confirm no audit_log row was actually created with the fake action.
  const { data: leaked } = await admin
    .from("audit_log")
    .select("id")
    .eq("action", "fake_action")
    .eq("actor_user_id", sA.user_id);
  if (leaked && leaked.length > 0) {
    fail(`audit_log row leaked despite ${t6Res.status}: ${JSON.stringify(leaked)}`);
  }
  pass(`audit_log row count for fake action = 0 (no DB-level leak)`);

  // ──────────────────────────────────────────────────────────────────
  // Phase 3 §10 — RLS tests for courses, batches, batch_teachers, students cross-batch.
  // ──────────────────────────────────────────────────────────────────

  header("Test 7 — Authenticated student can read active courses");
  const t7Res = await rest<unknown[]>(
    "GET",
    `courses?select=id,code,name&is_active=eq.true`,
    sAJwt,
  );
  if (t7Res.status !== 200) {
    fail(`expected 200, got ${t7Res.status} ${JSON.stringify(t7Res.body)}`);
  }
  if (!Array.isArray(t7Res.body) || t7Res.body.length < 4) {
    fail(`expected >= 4 active courses, got ${t7Res.body.length}`);
  }
  pass(`Student A sees ${t7Res.body.length} active courses`);

  header("Test 8 — Anonymous cannot read batches");
  const t8Res = await rest<unknown[]>("GET", `batches?select=id`, null);
  if (t8Res.status !== 200) {
    fail(`expected 200, got ${t8Res.status} ${JSON.stringify(t8Res.body)}`);
  }
  if (!Array.isArray(t8Res.body) || t8Res.body.length !== 0) {
    fail(`expected [] (anon blocked), got ${JSON.stringify(t8Res.body)}`);
  }
  pass(`Anon sees 0 batches`);

  header("Test 9 — Student A reads exactly their own batch row");
  const t9Res = await rest<{ id: string; name: string }[]>(
    "GET",
    `batches?select=id,name`,
    sAJwt,
  );
  if (!Array.isArray(t9Res.body) || t9Res.body.length !== 1) {
    fail(`expected exactly 1 batch (own), got ${t9Res.body.length}`);
  }
  pass(`Student A sees own batch: ${t9Res.body[0].name}`);
  const studentABatchId = t9Res.body[0].id;

  header("Test 10 — Cross-batch isolation: move Student B to a fresh batch via service role");
  // Pick the NEET_UG course id for the new batch (must match a course).
  const { data: neetCourse } = await admin
    .from("courses")
    .select("id")
    .eq("code", "NEET_UG")
    .single();
  if (!neetCourse) fail("could not load NEET_UG course id");
  const batchBName = `RLS Batch B ${ts}`;
  const { data: newBatch, error: newBatchErr } = await admin
    .from("batches")
    .insert({
      course_id: neetCourse.id,
      name: batchBName,
      starts_on: new Date().toISOString().slice(0, 10),
      capacity: 80,
    })
    .select("id")
    .single();
  if (newBatchErr || !newBatch) fail(`could not insert batch B: ${newBatchErr?.message}`);
  const batchBId = newBatch.id as string;
  const { error: moveErr } = await admin
    .from("students")
    .update({ batch_id: batchBId })
    .eq("user_id", sB.user_id);
  if (moveErr) fail(`could not move Student B to Batch B: ${moveErr.message}`);

  // Student A still sees only own batch (now Student B is in a different one).
  const t10Res = await rest<{ id: string; user_id: string }[]>(
    "GET",
    `students?select=user_id`,
    sAJwt,
  );
  if (!Array.isArray(t10Res.body) || t10Res.body.length !== 1) {
    fail(`Student A should see exactly own students row, got ${t10Res.body.length}`);
  }
  pass(`Student A sees only own students row after Student B moved to Batch B`);

  header("Test 11 — Teacher T1 (unassigned) sees zero students even after Batch B exists");
  const t11Res = await rest<unknown[]>("GET", `students?select=user_id`, t1Jwt);
  if (!Array.isArray(t11Res.body) || t11Res.body.length !== 0) {
    fail(`Teacher T1 should still see 0 students (no batch_teachers row), got ${t11Res.body.length}`);
  }
  pass(`Teacher T1 sees 0 students before assignment`);

  header("Test 12 — After assigning Teacher T1 to Batch A, T1 reads exactly Student A");
  const { error: assignErr } = await admin
    .from("batch_teachers")
    .insert({ batch_id: studentABatchId, teacher_id: t1.user_id });
  if (assignErr) fail(`could not assign Teacher T1 to Batch A: ${assignErr.message}`);

  const t12Res = await rest<{ user_id: string }[]>(
    "GET",
    `students?select=user_id`,
    t1Jwt,
  );
  if (!Array.isArray(t12Res.body)) {
    fail(`expected array, got ${JSON.stringify(t12Res.body)}`);
  }
  const t12Ids = t12Res.body.map((r) => r.user_id);
  if (!t12Ids.includes(sA.user_id)) {
    fail(`Teacher T1 should see Student A after assignment; got: ${JSON.stringify(t12Ids)}`);
  }
  if (t12Ids.includes(sB.user_id)) {
    fail(`Teacher T1 leaked Student B (different batch); got: ${JSON.stringify(t12Ids)}`);
  }
  pass(`Teacher T1 sees Student A only (count=${t12Ids.length}, Student B excluded)`);

  header("Test 13 — Teacher T1 reads exactly Batch A via /batches");
  const t13Res = await rest<{ id: string }[]>(
    "GET",
    `batches?select=id`,
    t1Jwt,
  );
  const t13Ids = (t13Res.body || []).map((b) => b.id);
  if (!t13Ids.includes(studentABatchId)) {
    fail(`Teacher T1 should see Batch A; got: ${JSON.stringify(t13Ids)}`);
  }
  if (t13Ids.includes(batchBId)) {
    fail(`Teacher T1 leaked Batch B; got: ${JSON.stringify(t13Ids)}`);
  }
  pass(`Teacher T1 sees Batch A only (count=${t13Ids.length}, Batch B excluded)`);

  header("Test 14 — Teacher T1 reads app_users row of Student A (own-batch student)");
  const t14Res = await rest<{ id: string; full_name: string }[]>(
    "GET",
    `app_users?select=id,full_name&id=eq.${sA.user_id}`,
    t1Jwt,
  );
  if (!Array.isArray(t14Res.body) || t14Res.body.length !== 1) {
    fail(
      `Teacher T1 should see Student A's app_users row, got: ${JSON.stringify(t14Res.body)}`,
    );
  }
  if (!t14Res.body[0].full_name) {
    fail(`Teacher T1 saw row but full_name was empty: ${JSON.stringify(t14Res.body[0])}`);
  }
  pass(`Teacher T1 reads Student A full_name="${t14Res.body[0].full_name}"`);

  header("Test 15 — Teacher T1 cannot read app_users row of Student B (other batch)");
  const t15Res = await rest<unknown[]>(
    "GET",
    `app_users?select=id,full_name&id=eq.${sB.user_id}`,
    t1Jwt,
  );
  if (!Array.isArray(t15Res.body) || t15Res.body.length !== 0) {
    fail(
      `Teacher T1 leaked Student B's app_users row (different batch): ${JSON.stringify(t15Res.body)}`,
    );
  }
  pass(`Teacher T1 sees 0 rows for Student B (cross-batch isolation holds)`);

  // ──────────────────────────────────────────────────────────────────
  // Phase 3 CP11 — mfa_recovery_codes RLS: self-read of own (hashed) rows,
  // cross-user denial. Service-role inserts the test rows; the table never
  // accepts inserts from `authenticated`.
  // ──────────────────────────────────────────────────────────────────

  header("Test 16 — Teacher T1 reads only own mfa_recovery_codes rows");
  // Seed two rows for T1 + one row for Student A via service-role.
  const fakeHash = "0".repeat(64);
  await admin
    .from("mfa_recovery_codes")
    .delete()
    .in("user_id", [t1.user_id, sA.user_id]);
  const { error: seedT1Err } = await admin
    .from("mfa_recovery_codes")
    .insert([
      { user_id: t1.user_id, code_hash: `${"a".repeat(63)}1` },
      { user_id: t1.user_id, code_hash: `${"a".repeat(63)}2` },
      { user_id: sA.user_id, code_hash: fakeHash },
    ]);
  if (seedT1Err) fail(`seed mfa_recovery_codes: ${seedT1Err.message}`);

  const t16Res = await rest<{ id: string; user_id: string }[]>(
    "GET",
    `mfa_recovery_codes?select=id,user_id`,
    t1Jwt,
  );
  if (!Array.isArray(t16Res.body) || t16Res.body.length !== 2) {
    fail(
      `Teacher T1 should see exactly own 2 recovery-code rows, got ${t16Res.body.length}: ${JSON.stringify(t16Res.body).slice(0, 200)}`,
    );
  }
  if (t16Res.body.some((r) => r.user_id !== t1.user_id)) {
    fail(`Teacher T1 leaked another user's recovery-code row`);
  }
  pass(`Teacher T1 sees exactly 2 own rows, no cross-user leak`);

  header("Test 17 — Student A cannot insert into mfa_recovery_codes (RLS write-blocked)");
  const t17Res = await rest<unknown>(
    "POST",
    `mfa_recovery_codes`,
    sAJwt,
    { user_id: sA.user_id, code_hash: fakeHash },
  );
  if (t17Res.status >= 200 && t17Res.status < 300) {
    fail(`RLS leak: student inserted recovery code with status ${t17Res.status}`);
  }
  pass(`Student A insert blocked (status ${t17Res.status})`);

  // ──────────────────────────────────────────────────────────────────
  // Phase 4 CP2 — sessions / attendance / attendance_corrections / activity_days RLS.
  // Service-role seeds the fixtures; we then sign in as each role and confirm
  // the row-level scope holds.
  // ──────────────────────────────────────────────────────────────────

  header("Setup — seed one session per batch + attendance per student");
  // Session A — Batch A (Student A, Teacher T1)
  const startA = new Date(Date.now() + 60 * 60 * 1000); // +1h
  const endA = new Date(Date.now() + 2 * 60 * 60 * 1000); // +2h
  const { data: sessA, error: sessAErr } = await admin
    .from("sessions")
    .insert({
      batch_id: studentABatchId,
      scheduled_start: startA.toISOString(),
      scheduled_end: endA.toISOString(),
    })
    .select("id")
    .single();
  if (sessAErr || !sessA) fail(`seed session A: ${sessAErr?.message}`);
  const sessionAId = sessA.id as string;

  // Session B — Batch B (Student B; no teacher assigned)
  const { data: sessB, error: sessBErr } = await admin
    .from("sessions")
    .insert({
      batch_id: batchBId,
      scheduled_start: startA.toISOString(),
      scheduled_end: endA.toISOString(),
    })
    .select("id")
    .single();
  if (sessBErr || !sessB) fail(`seed session B: ${sessBErr?.message}`);
  const sessionBId = sessB.id as string;

  // Attendance — Student A in Session A; Student B in Session B
  await admin.from("attendance").delete().in("session_id", [sessionAId, sessionBId]);
  const { error: attAErr } = await admin
    .from("attendance")
    .insert([
      {
        session_id: sessionAId,
        student_id: sA.user_id,
        status: "present",
        method: "manual",
        marked_by: t1.user_id,
      },
      {
        session_id: sessionBId,
        student_id: sB.user_id,
        status: "present",
        method: "manual",
      },
    ]);
  if (attAErr) fail(`seed attendance: ${attAErr.message}`);

  // activity_days for Student A (today IST-ish; date is fine)
  const todayDay = new Date().toISOString().slice(0, 10);
  await admin
    .from("activity_days")
    .delete()
    .in("student_id", [sA.user_id, sB.user_id]);
  const { error: adErr } = await admin
    .from("activity_days")
    .insert([
      { student_id: sA.user_id, day: todayDay },
      { student_id: sB.user_id, day: todayDay },
    ]);
  if (adErr) fail(`seed activity_days: ${adErr.message}`);
  pass(`Sessions A+B, attendance for sA/sB, activity_days for sA/sB seeded`);

  header("Test 18 — Anonymous cannot read sessions");
  const t18Res = await rest<unknown[]>("GET", `sessions?select=id`, null);
  if (!Array.isArray(t18Res.body) || t18Res.body.length !== 0) {
    fail(`anon saw sessions: ${JSON.stringify(t18Res.body)}`);
  }
  pass(`Anon sees 0 sessions`);

  header("Test 19 — Student A reads only own batch's sessions (Session A, not Session B)");
  const t19Res = await rest<{ id: string }[]>("GET", `sessions?select=id`, sAJwt);
  if (!Array.isArray(t19Res.body)) fail(`expected array, got ${JSON.stringify(t19Res.body)}`);
  const t19Ids = t19Res.body.map((r) => r.id);
  if (!t19Ids.includes(sessionAId)) fail(`Student A missing Session A; got: ${JSON.stringify(t19Ids)}`);
  if (t19Ids.includes(sessionBId)) fail(`Student A leaked Session B: ${JSON.stringify(t19Ids)}`);
  pass(`Student A sees Session A only (count=${t19Ids.length}, Session B excluded)`);

  header("Test 20 — Teacher T1 reads only assigned-batch sessions (Session A, not Session B)");
  const t20Res = await rest<{ id: string }[]>("GET", `sessions?select=id`, t1Jwt);
  if (!Array.isArray(t20Res.body)) fail(`expected array, got ${JSON.stringify(t20Res.body)}`);
  const t20Ids = t20Res.body.map((r) => r.id);
  if (!t20Ids.includes(sessionAId)) fail(`Teacher T1 missing Session A; got: ${JSON.stringify(t20Ids)}`);
  if (t20Ids.includes(sessionBId)) fail(`Teacher T1 leaked Session B: ${JSON.stringify(t20Ids)}`);
  pass(`Teacher T1 sees Session A only (count=${t20Ids.length}, Session B excluded)`);

  header("Test 21 — Student A reads only own attendance row");
  const t21Res = await rest<{ student_id: string }[]>(
    "GET",
    `attendance?select=student_id`,
    sAJwt,
  );
  if (!Array.isArray(t21Res.body)) fail(`expected array, got ${JSON.stringify(t21Res.body)}`);
  if (t21Res.body.length !== 1) fail(`Student A expected 1 attendance row, got ${t21Res.body.length}`);
  if (t21Res.body[0].student_id !== sA.user_id) {
    fail(`Student A leaked another student's attendance: ${JSON.stringify(t21Res.body)}`);
  }
  pass(`Student A sees exactly 1 own attendance row`);

  header("Test 22 — Teacher T1 reads Session A attendance only (Student A), not Student B");
  const t22Res = await rest<{ session_id: string; student_id: string }[]>(
    "GET",
    `attendance?select=session_id,student_id`,
    t1Jwt,
  );
  if (!Array.isArray(t22Res.body)) fail(`expected array, got ${JSON.stringify(t22Res.body)}`);
  if (t22Res.body.some((r) => r.session_id === sessionBId)) {
    fail(`Teacher T1 leaked Session B attendance: ${JSON.stringify(t22Res.body)}`);
  }
  const t22Mine = t22Res.body.filter((r) => r.session_id === sessionAId);
  if (t22Mine.length !== 1 || t22Mine[0].student_id !== sA.user_id) {
    fail(`Teacher T1 should see Student A in Session A; got: ${JSON.stringify(t22Res.body)}`);
  }
  pass(`Teacher T1 sees Session A attendance only (count=${t22Res.body.length}, Session B excluded)`);

  header("Test 23 — Student A cannot INSERT into attendance (writes go through edge fn)");
  const t23Res = await rest<unknown>("POST", `attendance`, sAJwt, {
    session_id: sessionAId,
    student_id: sA.user_id,
    status: "present",
    method: "manual",
  });
  if (t23Res.status >= 200 && t23Res.status < 300) {
    fail(`RLS leak: student inserted attendance with status ${t23Res.status}`);
  }
  pass(`Student A attendance INSERT blocked (status ${t23Res.status})`);

  header("Test 24 — Student A reads only own activity_days row");
  const t24Res = await rest<{ student_id: string }[]>(
    "GET",
    `activity_days?select=student_id`,
    sAJwt,
  );
  if (!Array.isArray(t24Res.body)) fail(`expected array, got ${JSON.stringify(t24Res.body)}`);
  if (t24Res.body.length !== 1 || t24Res.body[0].student_id !== sA.user_id) {
    fail(`Student A expected exactly own activity_days row; got: ${JSON.stringify(t24Res.body)}`);
  }
  pass(`Student A sees own activity_days row only`);

  console.log(`\nALL 24 RLS TESTS PASSED.`);
  console.log(`Test fixtures left in place (idempotent):`);
  console.log(`  Student A: ${sA.email}`);
  console.log(`  Student B: ${sB.email} (in ${batchBName})`);
  console.log(`  Teacher T1: ${t1.email} (assigned to Batch A)`);
  console.log(`  Session A: ${sessionAId} (Batch A, ${startA.toISOString()})`);
  console.log(`  Session B: ${sessionBId} (Batch B)`);
}

main().catch((err) => {
  fail(err instanceof Error ? (err.stack ?? err.message) : String(err));
});
