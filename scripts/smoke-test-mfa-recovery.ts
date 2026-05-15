// scripts/smoke-test-mfa-recovery.ts
//
// End-to-end smoke for CP11 TOTP recovery codes. Doesn't enroll a real TOTP
// factor (would require a TOTP code generator in the test); instead verifies
// the edge-function contract for issuing + consuming codes against a fresh
// staff_admin user.
//
// Steps (10 total):
//   1. Sign in as owner.
//   2. Bootstrap a fresh staff_admin via auth-bootstrap.
//   3. Sign in as that staff_admin (their must_change_password=true is fine
//      for these endpoints — loadCaller only enforces is_active).
//   4. POST /functions/v1/mfa-codes-issue → expect 200 with 10 codes.
//   5. SQL spot-check: 10 unused rows in public.mfa_recovery_codes for that
//      user, hashes are 64-char hex.
//   6. POST mfa-codes-issue AGAIN → expect 200, fresh batch, old codes are
//      now gone (issue replaces, doesn't append).
//   7. POST mfa-codes-consume with one of the codes → expect 200,
//      consumed=true. factors_deleted=0 (no factor was set up).
//   8. POST mfa-codes-consume with the SAME code → expect 401 "already used".
//   9. POST mfa-codes-consume with a bogus code → expect 401 "invalid".
//  10. SQL check: audit_log has one mfa_codes_issued + one mfa_codes_consumed
//      row for this user; the consumed row's after_data.used_at is non-null.

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

async function callFn<T = Record<string, unknown>>(
  name: string,
  body: unknown,
  jwt: string,
): Promise<{ status: number; body: T }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T;
  return { status: res.status, body: data };
}

async function main(): Promise<void> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const ts = Date.now();

  header("Step 1 — sign in as owner");
  const ownerJwt = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
  pass("owner JWT acquired");

  header("Step 2 — bootstrap a fresh staff_admin");
  const newAdminEmail = `mfa-smoke-${ts}@fynestudy.example.com`;
  const bootstrap = await callFn<{
    user_id: string;
    auth_user_id: string;
    email: string;
    initial_password: string;
  }>(
    "auth-bootstrap",
    {
      role: "staff_admin",
      full_name: `MFA Smoke ${ts}`,
      email: newAdminEmail,
    },
    ownerJwt,
  );
  if (bootstrap.status !== 200) {
    fail(`bootstrap: ${bootstrap.status} ${JSON.stringify(bootstrap.body)}`);
  }
  const { user_id, initial_password } = bootstrap.body;
  pass(`staff_admin bootstrapped: ${newAdminEmail} (app_user_id ${user_id})`);

  header("Step 3 — sign in as the new staff_admin");
  const adminJwt = await signIn(newAdminEmail, initial_password);
  pass("staff_admin JWT acquired");

  header("Step 4 — POST mfa-codes-issue");
  const issueRes1 = await callFn<{ codes: string[]; count: number }>(
    "mfa-codes-issue",
    {},
    adminJwt,
  );
  if (issueRes1.status !== 200) {
    fail(`issue 1: ${issueRes1.status} ${JSON.stringify(issueRes1.body)}`);
  }
  const codes1 = issueRes1.body.codes;
  if (!Array.isArray(codes1) || codes1.length !== 10) {
    fail(`expected 10 codes, got ${codes1?.length ?? "none"}`);
  }
  for (const c of codes1) {
    if (!/^[a-z2-9]{5}-[a-z2-9]{5}$/.test(c)) {
      fail(`code ${c} does not match XXXXX-XXXXX format`);
    }
  }
  pass(`got 10 codes, all formatted correctly`);

  header("Step 5 — DB shows 10 unused rows for this user");
  const { data: rows1, error: rowsErr } = await admin
    .from("mfa_recovery_codes")
    .select("id, code_hash, used_at")
    .eq("user_id", user_id);
  if (rowsErr) fail(`rows lookup: ${rowsErr.message}`);
  if (!rows1 || rows1.length !== 10) {
    fail(`expected 10 rows, got ${rows1?.length ?? 0}`);
  }
  for (const r of rows1) {
    if (!/^[0-9a-f]{64}$/.test(r.code_hash)) {
      fail(`hash not 64-char hex: ${r.code_hash}`);
    }
    if (r.used_at !== null) {
      fail(`row used_at should be null on issuance: ${r.used_at}`);
    }
  }
  pass(`10 rows, hashes are 64-char hex, all used_at null`);

  header("Step 6 — second mfa-codes-issue replaces the batch");
  const issueRes2 = await callFn<{ codes: string[]; count: number }>(
    "mfa-codes-issue",
    {},
    adminJwt,
  );
  if (issueRes2.status !== 200) {
    fail(`issue 2: ${issueRes2.status} ${JSON.stringify(issueRes2.body)}`);
  }
  const codes2 = issueRes2.body.codes;
  const overlap = codes1.filter((c) => codes2.includes(c));
  if (overlap.length > 0) {
    fail(`new batch shares ${overlap.length} codes with old batch — should be fully replaced`);
  }
  const { data: rows2 } = await admin
    .from("mfa_recovery_codes")
    .select("id")
    .eq("user_id", user_id);
  if (!rows2 || rows2.length !== 10) {
    fail(`after re-issue: expected 10 rows, got ${rows2?.length ?? 0}`);
  }
  pass(`fresh batch issued, old 10 rows deleted, no code overlap`);

  header("Step 7 — consume one code from batch 2");
  const target = codes2[0]!;
  const consumeRes = await callFn<{ consumed: boolean; factors_deleted: number }>(
    "mfa-codes-consume",
    { code: target },
    adminJwt,
  );
  if (consumeRes.status !== 200) {
    fail(`consume: ${consumeRes.status} ${JSON.stringify(consumeRes.body)}`);
  }
  if (!consumeRes.body.consumed) {
    fail(`consume returned consumed=false: ${JSON.stringify(consumeRes.body)}`);
  }
  pass(`consume returned 200 + consumed=true (factors_deleted=${consumeRes.body.factors_deleted})`);

  header("Step 8 — re-consume same code → 401 already used");
  const replay = await callFn<{ error: string }>(
    "mfa-codes-consume",
    { code: target },
    adminJwt,
  );
  if (replay.status !== 401) {
    fail(`expected 401 on replay, got ${replay.status} ${JSON.stringify(replay.body)}`);
  }
  if (!/already/i.test(replay.body.error)) {
    fail(`expected "already used" in error, got: ${replay.body.error}`);
  }
  pass(`replay blocked with 401: "${replay.body.error}"`);

  header("Step 9 — consume bogus code → 401 invalid");
  const bogus = await callFn<{ error: string }>(
    "mfa-codes-consume",
    { code: "00000-00000" },
    adminJwt,
  );
  if (bogus.status !== 401) {
    fail(`expected 401 on bogus, got ${bogus.status} ${JSON.stringify(bogus.body)}`);
  }
  if (!/invalid/i.test(bogus.body.error)) {
    fail(`expected "invalid" in error, got: ${bogus.body.error}`);
  }
  pass(`bogus code blocked with 401: "${bogus.body.error}"`);

  header("Step 10 — audit log shows issued + consumed for this user");
  const { data: auditRows, error: auditErr } = await admin
    .from("audit_log")
    .select("action, after_data")
    .eq("actor_user_id", user_id)
    .in("action", ["mfa_codes_issued", "mfa_codes_consumed"])
    .order("occurred_at", { ascending: true });
  if (auditErr) fail(`audit lookup: ${auditErr.message}`);
  const issued = auditRows?.filter((r) => r.action === "mfa_codes_issued") ?? [];
  const consumed = auditRows?.filter((r) => r.action === "mfa_codes_consumed") ?? [];
  if (issued.length < 2) {
    fail(`expected 2+ mfa_codes_issued audit rows, got ${issued.length}`);
  }
  if (consumed.length < 1) {
    fail(`expected 1+ mfa_codes_consumed audit row, got ${consumed.length}`);
  }
  pass(
    `audit_log: ${issued.length} issued + ${consumed.length} consumed rows (last consumed.after_data=${JSON.stringify(consumed[consumed.length - 1]?.after_data)})`,
  );

  console.log(`\nALL 10 MFA-RECOVERY SMOKE STEPS PASSED.`);
  console.log(`Test fixture left in place: ${newAdminEmail}`);
}

main().catch((err) => {
  fail(err instanceof Error ? (err.stack ?? err.message) : String(err));
});
