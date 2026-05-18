// scripts/smoke-test-attendance-manual-mark.ts
//
// Phase 4 CP10 — smoke for the `attendance-manual-mark` edge fn.
//
//   pnpm smoke:manual-mark

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
    console.error(`missing env var ${name}`);
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

interface FnRes {
  status: number;
  body: Record<string, unknown>;
}

async function callFn(
  name: string,
  body: unknown,
  jwt: string | null,
): Promise<FnRes> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, body: data };
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

interface BootstrappedUser {
  user_id: string;
  email: string;
  initial_password: string;
}

async function bootstrap(
  role: "student" | "teacher",
  label: string,
  ts: number,
  ownerJwt: string,
  batchId?: string,
): Promise<BootstrappedUser> {
  const email = `mm-${role}-${label}-${ts}@fynestudy.example.com`;
  const payload: Record<string, unknown> =
    role === "student"
      ? {
          role,
          full_name: `MM S ${label}`,
          email,
          batch_id: batchId,
          parent_consent_method: "verbal",
          school_name: "MM Test School",
          board: "CBSE",
          current_class: "12",
        }
      : {
          role,
          full_name: `MM T ${label}`,
          email,
          subjects: ["physics"],
        };
  const res = await callFn("auth-bootstrap", payload, ownerJwt);
  if (res.status !== 200) {
    fail(`bootstrap ${role} ${label}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body as unknown as BootstrappedUser;
}

async function main(): Promise<void> {
  const ts = Date.now();

  header("Setup — owner JWT + service client");
  const ownerJwt = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
  const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  pass("owner JWT acquired");

  header("Setup — Batch A + Batch B, S1 in A, S3 in B, T1 in A, T2 unassigned");
  const { data: jeeCourse } = await admin
    .from("courses")
    .select("id")
    .eq("code", "JEE_MAIN")
    .single();
  const { data: batchA } = await admin
    .from("batches")
    .insert({
      course_id: jeeCourse!.id,
      name: `MM Batch A ${ts}`,
      starts_on: "2026-01-01",
      capacity: 80,
    })
    .select("id")
    .single();
  const batchAId = batchA!.id as string;
  const { data: batchB } = await admin
    .from("batches")
    .insert({
      course_id: jeeCourse!.id,
      name: `MM Batch B ${ts}`,
      starts_on: "2026-01-01",
      capacity: 80,
    })
    .select("id")
    .single();
  const batchBId = batchB!.id as string;

  const s1 = await bootstrap("student", "1", ts, ownerJwt, batchAId);
  const s3 = await bootstrap("student", "3", ts, ownerJwt, batchBId);
  const t1 = await bootstrap("teacher", "T1", ts, ownerJwt);
  const t1Jwt = await signIn(t1.email, t1.initial_password);
  const t2 = await bootstrap("teacher", "T2", ts, ownerJwt);
  const t2Jwt = await signIn(t2.email, t2.initial_password);
  await admin
    .from("batch_teachers")
    .insert({ batch_id: batchAId, teacher_id: t1.user_id });

  const { data: sess } = await admin
    .from("sessions")
    .insert({
      batch_id: batchAId,
      scheduled_start: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      scheduled_end: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();
  const sessionId = sess!.id as string;
  pass(
    `Batch A=${batchAId.slice(0, 8)}…; S1 in A; S3 in B; T1 in A; T2 unassigned; Session ${sessionId.slice(0, 8)}…`,
  );

  header("Test 1 — 200 teacher T1 marks S1 present (insert)");
  const r1 = await callFn(
    "attendance-manual-mark",
    { session_id: sessionId, student_id: s1.user_id, status: "present" },
    t1Jwt,
  );
  if (r1.status !== 200) {
    fail(`expected 200, got ${r1.status} ${JSON.stringify(r1.body)}`);
  }
  const attendanceId = (r1.body as { attendance_id: string }).attendance_id;
  if (!attendanceId) {
    fail(`expected attendance_id in response, got ${JSON.stringify(r1.body)}`);
  }
  pass(`200 inserted attendance_id=${attendanceId.slice(0, 8)}… status=present`);

  header("Verify Test 1 side effects — attendance row method='manual', marked_by=T1");
  const { data: attRow } = await admin
    .from("attendance")
    .select("status, method, marked_by")
    .eq("id", attendanceId)
    .single();
  if (
    attRow!.status !== "present" ||
    attRow!.method !== "manual" ||
    attRow!.marked_by !== t1.user_id
  ) {
    fail(`unexpected row shape ${JSON.stringify(attRow)}`);
  }
  pass(`row { status='present', method='manual', marked_by=T1 }`);

  header("Test 2 — 409 second mark for same (session, student) blocked");
  const r2 = await callFn(
    "attendance-manual-mark",
    { session_id: sessionId, student_id: s1.user_id, status: "late" },
    t1Jwt,
  );
  if (r2.status !== 409) {
    fail(`expected 409, got ${r2.status} ${JSON.stringify(r2.body)}`);
  }
  pass(`409 already marked — corrections route required`);

  header("Test 3 — 403 unassigned teacher T2 cannot mark");
  const r3 = await callFn(
    "attendance-manual-mark",
    { session_id: sessionId, student_id: s3.user_id, status: "present" },
    t2Jwt,
  );
  if (r3.status !== 403) {
    fail(`expected 403, got ${r3.status} ${JSON.stringify(r3.body)}`);
  }
  pass(`403 teacher not assigned to this batch`);

  header("Test 4 — 403 student S3 from Batch B cannot be marked into Batch A session");
  const r4 = await callFn(
    "attendance-manual-mark",
    { session_id: sessionId, student_id: s3.user_id, status: "present" },
    t1Jwt,
  );
  if (r4.status !== 403) {
    fail(`expected 403, got ${r4.status} ${JSON.stringify(r4.body)}`);
  }
  pass(`403 student is not in this batch`);

  header("Test 5 — 404 unknown session_id");
  const r5 = await callFn(
    "attendance-manual-mark",
    {
      session_id: "00000000-0000-0000-0000-0000000000aa",
      student_id: s1.user_id,
      status: "present",
    },
    t1Jwt,
  );
  if (r5.status !== 404) {
    fail(`expected 404, got ${r5.status} ${JSON.stringify(r5.body)}`);
  }
  pass(`404 session not found`);

  header("Test 6 — 400 validation (bad status)");
  const r6 = await callFn(
    "attendance-manual-mark",
    { session_id: sessionId, student_id: s1.user_id, status: "not-a-status" },
    t1Jwt,
  );
  if (r6.status !== 400) {
    fail(`expected 400, got ${r6.status} ${JSON.stringify(r6.body)}`);
  }
  pass(`400 zod rejected status='not-a-status'`);

  header("Test 7 — 401 missing JWT");
  const r7 = await callFn(
    "attendance-manual-mark",
    { session_id: sessionId, student_id: s1.user_id, status: "present" },
    null,
  );
  if (r7.status !== 401) {
    fail(`expected 401, got ${r7.status} ${JSON.stringify(r7.body)}`);
  }
  pass(`401 missing authorization`);

  header("Side-effect — audit_log has attendance_manual_marked row");
  const { data: auditRows } = await admin
    .from("audit_log")
    .select("action, actor_user_id, entity_id")
    .eq("action", "attendance_manual_marked")
    .eq("entity_id", attendanceId);
  if (!auditRows || auditRows.length !== 1) {
    fail(
      `expected exactly 1 audit row, got ${auditRows?.length}: ${JSON.stringify(auditRows)}`,
    );
  }
  if (auditRows[0].actor_user_id !== t1.user_id) {
    fail(`expected actor=T1, got ${JSON.stringify(auditRows[0])}`);
  }
  pass(`audit_log captured attendance_manual_marked by T1`);

  console.log(`\nALL ATTENDANCE-MANUAL-MARK SMOKE TESTS PASSED.`);
  console.log(`Fixtures (left in place):`);
  console.log(`  Batch A:    ${batchAId}`);
  console.log(`  Batch B:    ${batchBId}`);
  console.log(`  Student 1:  ${s1.email}`);
  console.log(`  Student 3:  ${s3.email}`);
  console.log(`  Teacher T1: ${t1.email} (assigned to Batch A)`);
  console.log(`  Teacher T2: ${t2.email} (unassigned)`);
  console.log(`  Session:    ${sessionId}`);
}

main().catch((err) => {
  fail(err instanceof Error ? (err.stack ?? err.message) : String(err));
});
