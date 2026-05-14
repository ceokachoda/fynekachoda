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

  console.log(`\nALL 6 RLS TESTS PASSED.`);
  console.log(`Test fixtures left in place (idempotent):`);
  console.log(`  Student A: ${sA.email}`);
  console.log(`  Student B: ${sB.email}`);
  console.log(`  Teacher T1: ${t1.email}`);
}

main().catch((err) => {
  fail(err instanceof Error ? (err.stack ?? err.message) : String(err));
});
