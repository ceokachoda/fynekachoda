// scripts/smoke-test-attendance-qr-sign.ts
//
// Phase 4 CP4 — black-box smoke test for `attendance-qr-sign` edge fn.
//
// Spins up fresh fixtures (1 batch, 1 student, 1 session in-window) per run
// via service-role + auth-bootstrap, then exercises every documented branch:
//   * 200 happy path  + local HMAC verify against V1 from Vault
//   * 401 missing JWT
//   * 404 unknown session
//   * 403 cross-batch session
//   * 400 outside scan window
//   * 409 already marked
//   * 429 rate limited (immediate re-sign within 5 s)
//
//   pnpm smoke:qr-sign

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createHmac } from "node:crypto";
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

async function bootstrapStudent(
  label: string,
  ts: number,
  batchId: string,
  ownerJwt: string,
): Promise<BootstrappedUser> {
  const res = await callFn(
    "auth-bootstrap",
    {
      role: "student",
      full_name: `QrSign S ${label}`,
      email: `qrsign-s-${label}-${ts}@fynestudy.example.com`,
      batch_id: batchId,
      parent_consent_method: "verbal",
      school_name: "QrSign Test School",
      board: "CBSE",
      current_class: "12",
    },
    ownerJwt,
  );
  if (res.status !== 200) {
    fail(`bootstrap student ${label}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body as unknown as BootstrappedUser;
}

function b64UrlDecode(s: string): Buffer {
  const pad = (4 - (s.length % 4)) % 4;
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  return Buffer.from(b64, "base64");
}

function b64UrlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function canonicalString(p: {
  v: number;
  sid: string;
  uid: string;
  exp: number;
  jti: string;
}): string {
  return `${p.v}|${p.sid}|${p.uid}|${p.exp}|${p.jti}`;
}

function hmacSign(secretHex: string, data: string): string {
  return b64UrlEncode(
    createHmac("sha256", Buffer.from(secretHex, "hex")).update(data).digest(),
  );
}

interface DecodedToken {
  payload: { v: number; sid: string; uid: string; exp: number; jti: string };
  sig: string;
}

function decodeQrToken(encoded: string): DecodedToken {
  const json = b64UrlDecode(encoded).toString("utf-8");
  return JSON.parse(json) as DecodedToken;
}

async function createSession(
  admin: SupabaseClient,
  startMsOffset: number,
  endMsOffset: number,
  batchId: string,
): Promise<string> {
  const start = new Date(Date.now() + startMsOffset).toISOString();
  const end = new Date(Date.now() + endMsOffset).toISOString();
  const { data, error } = await admin
    .from("sessions")
    .insert({ batch_id: batchId, scheduled_start: start, scheduled_end: end })
    .select("id")
    .single();
  if (error || !data) fail(`createSession: ${error?.message}`);
  return data.id as string;
}

async function main(): Promise<void> {
  const ts = Date.now();

  header("Setup — sign in as owner");
  const ownerJwt = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
  const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  pass("owner JWT acquired");

  header("Setup — fresh course-A and course-B batches");
  const { data: jeeCourse, error: courseErr } = await admin
    .from("courses")
    .select("id")
    .eq("code", "JEE_MAIN")
    .single();
  if (courseErr || !jeeCourse) fail(`load JEE_MAIN course: ${courseErr?.message}`);

  const { data: batchA, error: batchAErr } = await admin
    .from("batches")
    .insert({
      course_id: jeeCourse.id,
      name: `QrSign Batch A ${ts}`,
      starts_on: "2026-01-01",
      capacity: 80,
    })
    .select("id")
    .single();
  if (batchAErr || !batchA) fail(`create Batch A: ${batchAErr?.message}`);
  const batchAId = batchA.id as string;

  const { data: batchB, error: batchBErr } = await admin
    .from("batches")
    .insert({
      course_id: jeeCourse.id,
      name: `QrSign Batch B ${ts}`,
      starts_on: "2026-01-01",
      capacity: 80,
    })
    .select("id")
    .single();
  if (batchBErr || !batchB) fail(`create Batch B: ${batchBErr?.message}`);
  const batchBId = batchB.id as string;
  pass(`Batch A=${batchAId.slice(0, 8)}… Batch B=${batchBId.slice(0, 8)}…`);

  header("Setup — bootstrap student in Batch A");
  const sA = await bootstrapStudent("A", ts, batchAId, ownerJwt);
  const sAJwt = await signIn(sA.email, sA.initial_password);
  pass(`student A=${sA.email} (user_id=${sA.user_id.slice(0, 8)}…)`);

  header("Test 1 — 200 happy path + local HMAC verify against V1 secret");
  const sessionAId = await createSession(
    admin,
    -5 * 60 * 1000, // started 5 min ago
    +60 * 60 * 1000, // ends in 1 h
    batchAId,
  );
  const res200 = await callFn(
    "attendance-qr-sign",
    { session_id: sessionAId },
    sAJwt,
  );
  if (res200.status !== 200) {
    fail(`expected 200, got ${res200.status} ${JSON.stringify(res200.body)}`);
  }
  const { payload_b64, exp } = res200.body as { payload_b64: string; exp: number };
  if (typeof payload_b64 !== "string" || payload_b64.length < 50) {
    fail(`payload_b64 missing or too short: ${payload_b64}`);
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(exp - (nowSec + 30)) > 5) {
    fail(`exp drift too large: exp=${exp} nowSec=${nowSec} diff=${exp - nowSec}`);
  }
  pass(`200: exp=${exp} (nowSec+~30=${nowSec + 30}); payload_b64 len=${payload_b64.length}`);

  const decoded = decodeQrToken(payload_b64);
  if (decoded.payload.sid !== sessionAId) {
    fail(`decoded sid mismatch: ${decoded.payload.sid} vs ${sessionAId}`);
  }
  if (decoded.payload.uid !== sA.user_id) {
    fail(`decoded uid mismatch: ${decoded.payload.uid} vs ${sA.user_id}`);
  }
  if (decoded.payload.exp !== exp) {
    fail(`decoded exp != response exp: ${decoded.payload.exp} vs ${exp}`);
  }
  if (!/^[a-z2-9]{12}$/.test(decoded.payload.jti)) {
    fail(`decoded jti malformed: ${decoded.payload.jti}`);
  }
  pass(`decoded payload matches sid/uid/exp and jti is 12-char base32`);

  const { data: v1, error: vErr } = await admin.rpc("get_qr_secret", {
    name: "QR_TOKEN_SECRET_V1",
  });
  if (vErr || typeof v1 !== "string") fail(`load V1 secret: ${vErr?.message}`);
  const expected = hmacSign(v1 as string, canonicalString(decoded.payload));
  if (expected !== decoded.sig) {
    fail(`HMAC mismatch: expected=${expected} got=${decoded.sig}`);
  }
  pass(`HMAC sig verified locally against V1 secret`);

  header("Test 2 — 429 rate limited on immediate second sign (same session)");
  const res429 = await callFn(
    "attendance-qr-sign",
    { session_id: sessionAId },
    sAJwt,
  );
  if (res429.status !== 429) {
    fail(`expected 429, got ${res429.status} ${JSON.stringify(res429.body)}`);
  }
  if ((res429.body as { detail?: { retry_after_ms?: number } }).detail?.retry_after_ms !== 5000) {
    fail(`expected retry_after_ms=5000, got ${JSON.stringify(res429.body)}`);
  }
  pass(`429 with retry_after_ms=5000`);

  header("Test 3 — 409 already marked (fresh session + service-role attendance INSERT)");
  const sessionDupId = await createSession(
    admin,
    -5 * 60 * 1000,
    +60 * 60 * 1000,
    batchAId,
  );
  const { error: insAttErr } = await admin.from("attendance").insert({
    session_id: sessionDupId,
    student_id: sA.user_id,
    status: "present",
    method: "manual",
  });
  if (insAttErr) fail(`seed attendance row: ${insAttErr.message}`);
  const res409 = await callFn(
    "attendance-qr-sign",
    { session_id: sessionDupId },
    sAJwt,
  );
  if (res409.status !== 409) {
    fail(`expected 409, got ${res409.status} ${JSON.stringify(res409.body)}`);
  }
  pass(`409 already marked`);

  header("Test 4 — 400 scan window closed (session in distant past)");
  const sessionPastId = await createSession(
    admin,
    -4 * 60 * 60 * 1000, // started 4 h ago
    -3 * 60 * 60 * 1000, // ended 3 h ago
    batchAId,
  );
  const res400 = await callFn(
    "attendance-qr-sign",
    { session_id: sessionPastId },
    sAJwt,
  );
  if (res400.status !== 400) {
    fail(`expected 400, got ${res400.status} ${JSON.stringify(res400.body)}`);
  }
  pass(`400 scan window closed`);

  header("Test 5 — 403 cross-batch (session lives in Batch B; student in Batch A)");
  const sessionCrossId = await createSession(
    admin,
    -5 * 60 * 1000,
    +60 * 60 * 1000,
    batchBId,
  );
  const res403 = await callFn(
    "attendance-qr-sign",
    { session_id: sessionCrossId },
    sAJwt,
  );
  if (res403.status !== 403) {
    fail(`expected 403, got ${res403.status} ${JSON.stringify(res403.body)}`);
  }
  pass(`403 cross-batch`);

  header("Test 6 — 404 unknown session_id");
  const res404 = await callFn(
    "attendance-qr-sign",
    { session_id: "00000000-0000-0000-0000-0000000000aa" },
    sAJwt,
  );
  if (res404.status !== 404) {
    fail(`expected 404, got ${res404.status} ${JSON.stringify(res404.body)}`);
  }
  pass(`404 session not found`);

  header("Test 7 — 401 missing JWT");
  const res401 = await callFn(
    "attendance-qr-sign",
    { session_id: sessionAId },
    null,
  );
  if (res401.status !== 401) {
    fail(`expected 401, got ${res401.status} ${JSON.stringify(res401.body)}`);
  }
  pass(`401 missing JWT`);

  console.log(`\nALL 7 attendance-qr-sign SMOKE TESTS PASSED.`);
  console.log(`Fixtures (left in place — idempotent):`);
  console.log(`  Batch A:        ${batchAId}`);
  console.log(`  Batch B:        ${batchBId}`);
  console.log(`  Student A:      ${sA.email}`);
  console.log(`  Session A (ok): ${sessionAId}`);
}

main().catch((err) => {
  fail(err instanceof Error ? (err.stack ?? err.message) : String(err));
});
