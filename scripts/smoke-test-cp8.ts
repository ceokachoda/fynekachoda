// scripts/smoke-test-cp8.ts
//
// Exercises the mobile-side auth flow against the live Supabase dev project
// WITHOUT a phone. Mirrors what apps/mobile/features/auth/* does on a real
// device: anon sign-in, RLS-permitted reads of own app_users + user_roles,
// auth-clear-must-change with student JWT, suspension blocking, sign-out.
//
// Each run creates a fresh timestamped student so it's idempotent.
//
//   pnpm smoke:cp8
//
// Prereqs: apps/admin/.env.local with NEXT_PUBLIC_SUPABASE_URL,
// NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY. Owner credentials
// default to owner@fynestudy.example.com / FyneStudy01! (override via env).

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
// Default = current dev owner password. Override with OWNER_INITIAL_PASSWORD
// env var if it's been rotated again. See memory note "demo-owner".
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

interface SignInResult {
  status: number;
  body: Record<string, unknown>;
}

async function signInAnon(
  email: string,
  password: string,
): Promise<SignInResult> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = (await res.json()) as Record<string, unknown>;
  return { status: res.status, body: data };
}

async function main(): Promise<void> {
  header("Step 1 — sign in as owner (to create a fresh test student)");
  const owner = await signInAnon(OWNER_EMAIL, OWNER_PASSWORD);
  if (owner.status !== 200 || typeof owner.body.access_token !== "string") {
    fail(`owner sign-in failed: ${owner.status} ${JSON.stringify(owner.body)}`);
  }
  const ownerJwt = owner.body.access_token as string;
  pass(`owner JWT acquired`);

  header("Step 2 — bootstrap a fresh test student");
  const ts = Date.now();
  const studentEmail = `cp8-smoke-${ts}@fynestudy.example.com`;
  const created = await callFn(
    "auth-bootstrap",
    {
      role: "student",
      full_name: "CP8 Smoke Student",
      email: studentEmail,
      parent_consent_method: "verbal",
      school_name: "Smoke School",
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
    initial_password: string;
  };
  const studentId = createdBody.user_id;
  const studentAuthId = createdBody.auth_user_id;
  const initialPassword = createdBody.initial_password;
  pass(
    `student created: app_users.id=${studentId} email=${studentEmail} temp_password=${initialPassword}`,
  );

  header("Step 3 — anon sign-in with WRONG password → expect 400");
  const wrong = await signInAnon(studentEmail, "definitely-not-it-1234");
  if (wrong.status !== 400) {
    fail(`expected 400, got ${wrong.status} ${JSON.stringify(wrong.body)}`);
  }
  pass(`Supabase rejected with 400 (mobile maps this to "Invalid email or password.")`);

  header("Step 4 — anon sign-in with CORRECT temp password");
  const ok = await signInAnon(studentEmail, initialPassword);
  if (ok.status !== 200 || typeof ok.body.access_token !== "string") {
    fail(`student sign-in failed: ${ok.status} ${JSON.stringify(ok.body)}`);
  }
  const studentJwt = ok.body.access_token as string;
  const studentRefresh = ok.body.refresh_token as string;
  if (!studentRefresh) {
    fail(`sign-in did not return a refresh_token (mobile needs it for SecureStore)`);
  }
  pass(`student JWT acquired (access + refresh tokens both present)`);

  header("Step 5 — student reads OWN app_users row via RLS (mobile SessionProvider.loadProfile)");
  const studentRest = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${studentJwt}` } },
  });
  const { data: au, error: auErr } = await studentRest
    .from("app_users")
    .select("id, full_name, email, is_active, must_change_password, auth_user_id")
    .eq("auth_user_id", studentAuthId)
    .maybeSingle();
  if (auErr) fail(`app_users read failed: ${auErr.message}`);
  if (!au) fail(`app_users row not visible — RLS likely misconfigured`);
  if (au.is_active !== true) fail(`new student should be active, got is_active=${au.is_active}`);
  if (au.must_change_password !== true) {
    fail(`new student should have must_change_password=true, got ${au.must_change_password}`);
  }
  pass(`own app_users row visible: is_active=true, must_change_password=true`);

  header("Step 6 — student reads OWN user_roles via RLS");
  const { data: roles, error: rolesErr } = await studentRest
    .from("user_roles")
    .select("role")
    .eq("user_id", studentId);
  if (rolesErr) fail(`user_roles read failed: ${rolesErr.message}`);
  if (!roles || roles.length !== 1 || roles[0].role !== "student") {
    fail(`expected exactly one student role, got ${JSON.stringify(roles)}`);
  }
  pass(`own user_roles visible: [{role:"student"}]`);

  header("Step 7 — student CANNOT read another user's app_users row (cross-student isolation)");
  const { data: others } = await studentRest
    .from("app_users")
    .select("id")
    .neq("auth_user_id", studentAuthId);
  if (others && others.length > 0) {
    fail(`RLS leak: student saw ${others.length} other app_users rows`);
  }
  pass(`RLS blocks cross-student visibility`);

  header("Step 8 — student calls auth-clear-must-change (force-password-change step 2)");
  const cleared = await callFn("auth-clear-must-change", {}, studentJwt);
  if (cleared.status !== 200) {
    fail(`expected 200, got ${cleared.status} ${JSON.stringify(cleared.body)}`);
  }
  const clearedBody = cleared.body as { must_change_password: boolean };
  if (clearedBody.must_change_password !== false) {
    fail(`expected must_change_password=false, got ${clearedBody.must_change_password}`);
  }
  pass(`must_change_password=false`);

  header("Step 9 — re-read app_users; must_change_password must now be false");
  const { data: au2 } = await studentRest
    .from("app_users")
    .select("must_change_password")
    .eq("auth_user_id", studentAuthId)
    .single();
  if (!au2 || au2.must_change_password !== false) {
    fail(`expected must_change_password=false, got ${JSON.stringify(au2)}`);
  }
  pass(`row now reads must_change_password=false`);

  header("Step 10 — owner suspends the student");
  const sus = await callFn(
    "auth-suspend",
    { user_id: studentId, mode: "suspend", reason: "cp8 smoke" },
    ownerJwt,
  );
  if (sus.status !== 200) fail(`expected 200, got ${sus.status} ${JSON.stringify(sus.body)}`);
  pass(`student suspended`);

  header("Step 11 — suspended student's cached JWT is rejected by edge fn (≤1h leak closure)");
  const blocked = await callFn("auth-clear-must-change", {}, studentJwt);
  if (blocked.status !== 401) {
    fail(`expected 401 from edge fn, got ${blocked.status} ${JSON.stringify(blocked.body)}`);
  }
  pass(`edge fn returns 401 even with valid JWT — is_active gate works`);

  header("Step 12 — suspended student can still read own row (sees is_active=false → mobile routes to /suspended)");
  const { data: auSus } = await studentRest
    .from("app_users")
    .select("is_active")
    .eq("auth_user_id", studentAuthId)
    .maybeSingle();
  if (!auSus) fail(`suspended student lost RLS access to own row`);
  if (auSus.is_active !== false) {
    fail(`expected is_active=false after suspend, got ${auSus.is_active}`);
  }
  pass(`suspended row visible to student with is_active=false`);

  header("Step 13 — owner unsuspends");
  const uns = await callFn(
    "auth-suspend",
    { user_id: studentId, mode: "unsuspend" },
    ownerJwt,
  );
  if (uns.status !== 200) fail(`expected 200, got ${uns.status} ${JSON.stringify(uns.body)}`);
  pass(`student reactivated`);

  header("Step 14 — student signs in again (mobile login.tsx flow)");
  const again = await signInAnon(studentEmail, initialPassword);
  if (again.status !== 200 || typeof again.body.access_token !== "string") {
    fail(`re-sign-in failed: ${again.status} ${JSON.stringify(again.body)}`);
  }
  const studentJwt2 = again.body.access_token as string;
  pass(`sign-in returns 200 with a fresh JWT`);

  header("Step 15 — student signs out (mobile signOut)");
  const logoutRes = await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${studentJwt2}`,
    },
  });
  if (![200, 204].includes(logoutRes.status)) {
    fail(`logout expected 204, got ${logoutRes.status}`);
  }
  pass(`sign-out endpoint returns ${logoutRes.status}`);

  header("Step 16 — DB sanity via service-role: audit_log has the right rows");
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: auditRows } = await admin
    .from("audit_log")
    .select("action")
    .eq("entity_id", studentId)
    .order("occurred_at", { ascending: true });
  const actions = (auditRows ?? []).map((r) => r.action);
  const expected = [
    "create_user",
    "password_changed",
    "suspend_user",
    "unsuspend_user",
  ];
  for (const a of expected) {
    if (!actions.includes(a)) {
      fail(`audit_log missing action=${a}; got [${actions.join(", ")}]`);
    }
  }
  pass(`audit_log has all 4 expected actions: ${actions.join(", ")}`);

  console.log(`\nALL CP8 SMOKE TESTS PASSED.`);
  console.log(`Test student left in place:`);
  console.log(`  app_users.id  ${studentId}`);
  console.log(`  email         ${studentEmail}`);
  console.log(`  password      ${initialPassword}`);
  console.log(`  state         is_active=true, must_change_password=false`);
}

main().catch((err) => {
  fail(err instanceof Error ? (err.stack ?? err.message) : String(err));
});
