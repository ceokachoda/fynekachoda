// scripts/smoke-test-cp6.ts
//
// Phase 4 CP6 — combined smoke for the three smaller edge fns:
//   * attendance-bulk-mark
//   * attendance-correct
//   * session-create-ad-hoc
//
//   pnpm smoke:cp6

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
  const email = `cp6-${role}-${label}-${ts}@fynestudy.example.com`;
  const payload: Record<string, unknown> =
    role === "student"
      ? {
          role,
          full_name: `CP6 S ${label}`,
          email,
          batch_id: batchId,
          parent_consent_method: "verbal",
          school_name: "CP6 Test School",
          board: "CBSE",
          current_class: "12",
        }
      : {
          role,
          full_name: `CP6 T ${label}`,
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

  header("Setup — owner JWT");
  const ownerJwt = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
  const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  pass("owner JWT acquired");

  header("Setup — fresh Batch A + Batch C, 2 students in A, T1 assigned to A, T2 unassigned");
  const { data: jeeCourse } = await admin
    .from("courses")
    .select("id")
    .eq("code", "JEE_MAIN")
    .single();
  const { data: batchA } = await admin
    .from("batches")
    .insert({
      course_id: jeeCourse!.id,
      name: `CP6 Batch A ${ts}`,
      starts_on: "2026-01-01",
      capacity: 80,
    })
    .select("id")
    .single();
  const batchAId = batchA!.id as string;
  const { data: batchC } = await admin
    .from("batches")
    .insert({
      course_id: jeeCourse!.id,
      name: `CP6 Batch C ${ts}`,
      starts_on: "2026-01-01",
      capacity: 80,
    })
    .select("id")
    .single();
  const batchCId = batchC!.id as string;

  const s1 = await bootstrap("student", "1", ts, ownerJwt, batchAId);
  const s2 = await bootstrap("student", "2", ts, ownerJwt, batchAId);
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
  pass(`Batch A=${batchAId.slice(0, 8)}…; S1+S2 in A; T1 assigned to A; T2 unassigned; Session ${sessionId.slice(0, 8)}…`);

  // ──────────────────────────────────────────────────────────────────
  // attendance-bulk-mark
  // ──────────────────────────────────────────────────────────────────

  header("Test BULK-1 — 200 bulk mark absent (both students unmarked → inserted=2)");
  const bulk1 = await callFn(
    "attendance-bulk-mark",
    { session_id: sessionId, mark_remaining: "absent" },
    t1Jwt,
  );
  if (bulk1.status !== 200) {
    fail(`expected 200, got ${bulk1.status} ${JSON.stringify(bulk1.body)}`);
  }
  if ((bulk1.body as { inserted: number }).inserted !== 2) {
    fail(`expected inserted=2, got ${JSON.stringify(bulk1.body)}`);
  }
  pass(`200 inserted=2 (status='absent', method='manual')`);

  header("Test BULK-2 — 200 idempotent re-run (existing rows not overridden → inserted=0)");
  const bulk2 = await callFn(
    "attendance-bulk-mark",
    { session_id: sessionId, mark_remaining: "present" },
    t1Jwt,
  );
  if (bulk2.status !== 200) {
    fail(`expected 200, got ${bulk2.status} ${JSON.stringify(bulk2.body)}`);
  }
  if ((bulk2.body as { inserted: number }).inserted !== 0) {
    fail(`expected inserted=0 on re-run, got ${JSON.stringify(bulk2.body)}`);
  }
  pass(`200 inserted=0 (AC #12: existing rows preserved)`);

  header("Test BULK-3 — 403 unassigned teacher T2");
  const bulk3 = await callFn(
    "attendance-bulk-mark",
    { session_id: sessionId, mark_remaining: "absent" },
    t2Jwt,
  );
  if (bulk3.status !== 403) {
    fail(`expected 403, got ${bulk3.status} ${JSON.stringify(bulk3.body)}`);
  }
  pass(`403 teacher not assigned to this batch`);

  header("Test BULK-4 — 404 unknown session_id");
  const bulk4 = await callFn(
    "attendance-bulk-mark",
    {
      session_id: "00000000-0000-0000-0000-0000000000bb",
      mark_remaining: "absent",
    },
    t1Jwt,
  );
  if (bulk4.status !== 404) {
    fail(`expected 404, got ${bulk4.status} ${JSON.stringify(bulk4.body)}`);
  }
  pass(`404 session not found`);

  header("Test BULK-5 — 400 validation (bad mark_remaining)");
  const bulk5 = await callFn(
    "attendance-bulk-mark",
    { session_id: sessionId, mark_remaining: "late" },
    t1Jwt,
  );
  if (bulk5.status !== 400) {
    fail(`expected 400, got ${bulk5.status} ${JSON.stringify(bulk5.body)}`);
  }
  pass(`400 validation rejected mark_remaining='late'`);

  // ──────────────────────────────────────────────────────────────────
  // attendance-correct (uses the rows inserted by BULK-1)
  // ──────────────────────────────────────────────────────────────────

  header("Setup — pick S1's attendance row from bulk-mark");
  const { data: s1Att } = await admin
    .from("attendance")
    .select("id, status")
    .eq("session_id", sessionId)
    .eq("student_id", s1.user_id)
    .single();
  if (!s1Att || s1Att.status !== "absent") {
    fail(`expected S1 attendance status='absent', got ${JSON.stringify(s1Att)}`);
  }
  const s1AttId = s1Att.id as string;
  pass(`S1 attendance_id=${s1AttId.slice(0, 8)}… status=absent`);

  header("Test CORR-1 — 200 teacher corrects absent → present (reason recorded)");
  const corr1 = await callFn(
    "attendance-correct",
    {
      attendance_id: s1AttId,
      new_status: "present",
      reason: "Late entry confirmed by hallway monitor",
    },
    t1Jwt,
  );
  if (corr1.status !== 200) {
    fail(`expected 200, got ${corr1.status} ${JSON.stringify(corr1.body)}`);
  }
  if ((corr1.body as { prev_status: string; new_status: string }).prev_status !== "absent") {
    fail(`expected prev_status='absent', got ${JSON.stringify(corr1.body)}`);
  }
  pass(`200 absent → present + reason recorded`);

  header("Verify CORR-1 side effects — attendance row updated, corrections row inserted");
  const { data: s1AttPost } = await admin
    .from("attendance")
    .select("status, method")
    .eq("id", s1AttId)
    .single();
  if (s1AttPost!.status !== "present" || s1AttPost!.method !== "correction") {
    fail(`expected status=present, method=correction; got ${JSON.stringify(s1AttPost)}`);
  }
  const { data: corrRows } = await admin
    .from("attendance_corrections")
    .select("prev_status, new_status, reason, changed_by")
    .eq("attendance_id", s1AttId);
  if (!corrRows || corrRows.length !== 1) {
    fail(`expected exactly 1 corrections row, got ${corrRows?.length}`);
  }
  if (
    corrRows[0].prev_status !== "absent" ||
    corrRows[0].new_status !== "present" ||
    corrRows[0].changed_by !== t1.user_id
  ) {
    fail(`corrections row shape wrong: ${JSON.stringify(corrRows[0])}`);
  }
  pass(`attendance now (present, correction); corrections row present + reason='${corrRows[0].reason}'`);

  header("Test CORR-2 — 409 status already matches new_status");
  const corr2 = await callFn(
    "attendance-correct",
    { attendance_id: s1AttId, new_status: "present", reason: "Duplicate attempt" },
    t1Jwt,
  );
  if (corr2.status !== 409) {
    fail(`expected 409, got ${corr2.status} ${JSON.stringify(corr2.body)}`);
  }
  pass(`409 status already matches`);

  header("Test CORR-3 — 403 teacher T2 not in batch");
  const { data: s2Att } = await admin
    .from("attendance")
    .select("id")
    .eq("session_id", sessionId)
    .eq("student_id", s2.user_id)
    .single();
  const corr3 = await callFn(
    "attendance-correct",
    { attendance_id: s2Att!.id, new_status: "late", reason: "Unauthorised attempt" },
    t2Jwt,
  );
  if (corr3.status !== 403) {
    fail(`expected 403, got ${corr3.status} ${JSON.stringify(corr3.body)}`);
  }
  pass(`403 teacher not assigned to this batch`);

  header("Test CORR-4 — 200 admin can correct (owner JWT) regardless of batch");
  const corr4 = await callFn(
    "attendance-correct",
    {
      attendance_id: s2Att!.id,
      new_status: "late",
      reason: "Admin override for testing",
    },
    ownerJwt,
  );
  if (corr4.status !== 200) {
    fail(`expected 200, got ${corr4.status} ${JSON.stringify(corr4.body)}`);
  }
  pass(`200 owner_admin override succeeded`);

  header("Test CORR-5 — 404 unknown attendance_id");
  const corr5 = await callFn(
    "attendance-correct",
    {
      attendance_id: "00000000-0000-0000-0000-0000000000dd",
      new_status: "present",
      reason: "Bogus id",
    },
    t1Jwt,
  );
  if (corr5.status !== 404) {
    fail(`expected 404, got ${corr5.status} ${JSON.stringify(corr5.body)}`);
  }
  pass(`404 attendance not found`);

  // ──────────────────────────────────────────────────────────────────
  // session-create-ad-hoc
  // ──────────────────────────────────────────────────────────────────

  header("Test ADHOC-1 — 200 teacher creates ad-hoc session in own batch");
  const start = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const end = new Date(Date.now() + 70 * 60 * 1000).toISOString();
  const adhoc1 = await callFn(
    "session-create-ad-hoc",
    {
      batch_id: batchAId,
      scheduled_start: start,
      scheduled_end: end,
    },
    t1Jwt,
  );
  if (adhoc1.status !== 200) {
    fail(`expected 200, got ${adhoc1.status} ${JSON.stringify(adhoc1.body)}`);
  }
  const adhocSessionId = (adhoc1.body as { session_id: string }).session_id;
  if ((adhoc1.body as { is_ad_hoc: boolean }).is_ad_hoc !== true) {
    fail(`expected is_ad_hoc=true, got ${JSON.stringify(adhoc1.body)}`);
  }
  pass(`200 ad-hoc session ${adhocSessionId.slice(0, 8)}… created`);

  header("Verify ADHOC-1 side effect — sessions row has is_ad_hoc=true, created_by=T1");
  const { data: sessRow } = await admin
    .from("sessions")
    .select("is_ad_hoc, created_by, batch_id")
    .eq("id", adhocSessionId)
    .single();
  if (
    sessRow!.is_ad_hoc !== true ||
    sessRow!.created_by !== t1.user_id ||
    sessRow!.batch_id !== batchAId
  ) {
    fail(`session row shape wrong: ${JSON.stringify(sessRow)}`);
  }
  pass(`is_ad_hoc=true, created_by=T1, batch_id=batchA`);

  header("Test ADHOC-2 — 400 end <= start (validation)");
  const adhoc2 = await callFn(
    "session-create-ad-hoc",
    {
      batch_id: batchAId,
      scheduled_start: end,
      scheduled_end: start, // reversed
    },
    t1Jwt,
  );
  if (adhoc2.status !== 400) {
    fail(`expected 400, got ${adhoc2.status} ${JSON.stringify(adhoc2.body)}`);
  }
  pass(`400 scheduled_end must be after scheduled_start`);

  header("Test ADHOC-3 — 403 teacher T2 not in batch A");
  const adhoc3 = await callFn(
    "session-create-ad-hoc",
    {
      batch_id: batchAId,
      scheduled_start: start,
      scheduled_end: end,
    },
    t2Jwt,
  );
  if (adhoc3.status !== 403) {
    fail(`expected 403, got ${adhoc3.status} ${JSON.stringify(adhoc3.body)}`);
  }
  pass(`403 teacher not assigned`);

  header("Test ADHOC-4 — 404 unknown batch_id");
  const adhoc4 = await callFn(
    "session-create-ad-hoc",
    {
      batch_id: "00000000-0000-0000-0000-0000000000aa",
      scheduled_start: start,
      scheduled_end: end,
    },
    t1Jwt,
  );
  if (adhoc4.status !== 404) {
    fail(`expected 404, got ${adhoc4.status} ${JSON.stringify(adhoc4.body)}`);
  }
  pass(`404 batch not found`);

  // ──────────────────────────────────────────────────────────────────
  // Side-effect verification — audit_log captured all three action types
  // ──────────────────────────────────────────────────────────────────

  header("Side-effect — audit_log has rows for all three CP6 actions");
  const { data: auditRows } = await admin
    .from("audit_log")
    .select("action, actor_role, entity_table")
    .in("action", [
      "attendance_bulk_mark",
      "attendance_corrected",
      "session_created_ad_hoc",
    ])
    .gte("occurred_at", new Date(ts).toISOString());
  const actions = new Set((auditRows ?? []).map((r) => r.action as string));
  for (const expected of [
    "attendance_bulk_mark",
    "attendance_corrected",
    "session_created_ad_hoc",
  ]) {
    if (!actions.has(expected)) {
      fail(`audit_log missing action='${expected}': ${JSON.stringify(auditRows)}`);
    }
  }
  pass(
    `audit_log captured ${auditRows!.length} CP6 rows across ${actions.size} action types`,
  );

  console.log(`\nALL CP6 SMOKE TESTS PASSED.`);
  console.log(`Fixtures (left in place):`);
  console.log(`  Batch A:        ${batchAId}`);
  console.log(`  Batch C:        ${batchCId}`);
  console.log(`  Student 1:      ${s1.email}`);
  console.log(`  Student 2:      ${s2.email}`);
  console.log(`  Teacher T1:     ${t1.email} (assigned to Batch A)`);
  console.log(`  Teacher T2:     ${t2.email} (unassigned)`);
  console.log(`  Session:        ${sessionId}`);
  console.log(`  Ad-hoc Session: ${adhocSessionId}`);
}

main().catch((err) => {
  fail(err instanceof Error ? (err.stack ?? err.message) : String(err));
});
