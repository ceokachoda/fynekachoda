// scripts/smoke-test-cp5.ts
//
// End-to-end smoke test for the four Phase 2 / Checkpoint 5 edge functions.
// Reuses owner credentials from CP4. Each run leaves a test student row
// behind (intentionally — useful for CP6/CP7/CP9 testing); the email is
// timestamped so reruns don't collide.
//
//   pnpm tsx scripts/smoke-test-cp5.ts

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
// Default = current dev owner password (rotated 2026-05-15 during CP6).
// Override with OWNER_INITIAL_PASSWORD env var if it's rotated again.
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

interface FnResult {
  status: number;
  body: Record<string, unknown> | string;
}

async function callFn(
  name: string,
  body: unknown,
  jwt: string | null,
): Promise<FnResult> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: Record<string, unknown> | string;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
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

async function main(): Promise<void> {
  header("Step 1 — sign in as owner");
  const ownerJwt = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
  pass(`owner JWT acquired (${ownerJwt.slice(0, 24)}...)`);

  header("Step 2 — auth-bootstrap with NO JWT → expect 401");
  const noJwt = await callFn(
    "auth-bootstrap",
    { role: "student", full_name: "x", email: "x@x.com" },
    null,
  );
  if (noJwt.status !== 401) fail(`expected 401, got ${noJwt.status} ${JSON.stringify(noJwt.body)}`);
  pass(`rejected with 401`);

  header("Step 3 — auth-bootstrap with invalid body → expect 400");
  const bad = await callFn("auth-bootstrap", { role: "student" }, ownerJwt);
  if (bad.status !== 400) fail(`expected 400, got ${bad.status} ${JSON.stringify(bad.body)}`);
  pass(`rejected with 400`);

  header("Step 4 — auth-bootstrap creating test student");
  const ts = Date.now();
  const testEmail = `cp5-smoke-${ts}@fynestudy.example.com`;
  const created = await callFn(
    "auth-bootstrap",
    {
      role: "student",
      full_name: "CP5 Smoke Student",
      email: testEmail,
      parent_consent_method: "verbal",
      school_name: "Demo School",
      board: "CBSE",
      current_class: "12",
    },
    ownerJwt,
  );
  if (created.status !== 200) {
    fail(`expected 200, got ${created.status} ${JSON.stringify(created.body)}`);
  }
  const createdBody = created.body as {
    user_id: string;
    auth_user_id: string;
    email: string;
    role: string;
    initial_password: string;
  };
  const studentId = createdBody.user_id;
  const studentAuthId = createdBody.auth_user_id;
  const studentEmail = createdBody.email;
  let studentPassword = createdBody.initial_password;
  pass(
    `created student app_users.id=${studentId} email=${studentEmail} initial_password=${studentPassword}`,
  );

  header("Step 5 — auth-bootstrap with duplicate email → expect 409");
  const dup = await callFn(
    "auth-bootstrap",
    { role: "student", full_name: "Dup", email: testEmail },
    ownerJwt,
  );
  if (dup.status !== 409) {
    fail(`expected 409, got ${dup.status} ${JSON.stringify(dup.body)}`);
  }
  pass(`rejected with 409`);

  header("Step 6 — auth-suspend mode=suspend");
  const sus = await callFn(
    "auth-suspend",
    { user_id: studentId, mode: "suspend", reason: "cp5 smoke test" },
    ownerJwt,
  );
  if (sus.status !== 200) fail(`got ${sus.status} ${JSON.stringify(sus.body)}`);
  const susBody = sus.body as { is_active: boolean };
  if (susBody.is_active !== false) fail(`expected is_active=false, got ${susBody.is_active}`);
  pass(`is_active=false`);

  header("Step 7 — auth-suspend mode=unsuspend");
  const uns = await callFn(
    "auth-suspend",
    { user_id: studentId, mode: "unsuspend" },
    ownerJwt,
  );
  if (uns.status !== 200) fail(`got ${uns.status} ${JSON.stringify(uns.body)}`);
  const unsBody = uns.body as { is_active: boolean };
  if (unsBody.is_active !== true) fail(`expected is_active=true, got ${unsBody.is_active}`);
  pass(`is_active=true`);

  header("Step 8 — auth-force-reset");
  const reset = await callFn(
    "auth-force-reset",
    { user_id: studentId },
    ownerJwt,
  );
  if (reset.status !== 200) fail(`got ${reset.status} ${JSON.stringify(reset.body)}`);
  const resetBody = reset.body as { initial_password: string };
  studentPassword = resetBody.initial_password;
  pass(`new temp password=${studentPassword}`);

  header("Step 9 — student signs in with new temp password");
  const studentJwt = await signIn(studentEmail, studentPassword);
  pass(`student JWT acquired (${studentJwt.slice(0, 24)}...)`);

  header("Step 10 — auth-clear-must-change");
  const clear = await callFn("auth-clear-must-change", {}, studentJwt);
  if (clear.status !== 200) fail(`got ${clear.status} ${JSON.stringify(clear.body)}`);
  const clearBody = clear.body as { must_change_password: boolean };
  if (clearBody.must_change_password !== false) {
    fail(`expected must_change_password=false, got ${clearBody.must_change_password}`);
  }
  pass(`must_change_password=false`);

  header("Step 11 — auth-clear-must-change again → idempotent");
  const clearAgain = await callFn("auth-clear-must-change", {}, studentJwt);
  if (clearAgain.status !== 200) {
    fail(`got ${clearAgain.status} ${JSON.stringify(clearAgain.body)}`);
  }
  pass(`idempotent re-call returns 200`);

  header("Step 12 — DB checks via service-role");
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: appUserRow } = await admin
    .from("app_users")
    .select("id, is_active, must_change_password, email")
    .eq("id", studentId)
    .single();
  if (!appUserRow) fail("test student app_users row missing");
  if (appUserRow.is_active !== true) fail(`is_active should be true, got ${appUserRow.is_active}`);
  if (appUserRow.must_change_password !== false) {
    fail(`must_change_password should be false, got ${appUserRow.must_change_password}`);
  }
  pass(`app_users row matches: is_active=true, must_change_password=false`);

  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role, granted_by")
    .eq("user_id", studentId)
    .single();
  if (!roleRow || roleRow.role !== "student") fail("user_roles missing student role");
  if (!roleRow.granted_by) fail("user_roles.granted_by should be the owner's id");
  pass(`user_roles row: role=student, granted_by=${roleRow.granted_by}`);

  const { data: studentRow } = await admin
    .from("students")
    .select("user_id, school_name, parent_consent_method")
    .eq("user_id", studentId)
    .single();
  if (!studentRow) fail("students row missing");
  if (studentRow.school_name !== "Demo School") {
    fail(`students.school_name expected Demo School, got ${studentRow.school_name}`);
  }
  if (studentRow.parent_consent_method !== "verbal") {
    fail(`students.parent_consent_method expected verbal, got ${studentRow.parent_consent_method}`);
  }
  pass(`students row: school_name=Demo School, parent_consent_method=verbal`);

  const { data: auditRows } = await admin
    .from("audit_log")
    .select("action")
    .eq("entity_id", studentId)
    .order("occurred_at", { ascending: true });
  const actions = (auditRows ?? []).map((r) => r.action);
  const expectedActions = [
    "create_user",
    "suspend_user",
    "unsuspend_user",
    "force_reset_password",
    "password_changed",
  ];
  for (const expected of expectedActions) {
    if (!actions.includes(expected)) {
      fail(`audit_log missing action=${expected}; got [${actions.join(", ")}]`);
    }
  }
  pass(`audit_log has all 5 expected actions: ${actions.join(", ")}`);

  console.log(`\nALL SMOKE TESTS PASSED.`);
  console.log(`Test student left in place for further checkpoints:`);
  console.log(`  app_users.id     ${studentId}`);
  console.log(`  auth.users.id    ${studentAuthId}`);
  console.log(`  email            ${studentEmail}`);
  console.log(`  current password ${studentPassword}`);
  console.log(`  must_change      false (already cleared)`);
}

main().catch((err) => {
  fail(err instanceof Error ? (err.stack ?? err.message) : String(err));
});
