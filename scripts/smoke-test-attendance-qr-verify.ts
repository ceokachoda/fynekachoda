// scripts/smoke-test-attendance-qr-verify.ts
//
// Phase 4 CP5 — black-box smoke test for `attendance-qr-verify`. Spins up
// fresh fixtures (batch, student, teacher assigned to batch, session in
// window) per run and covers every documented branch from spec §4.4 plus the
// rate-limit and JWT paths.
//
//   pnpm smoke:qr-verify

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

async function bootstrap(
  role: "student" | "teacher",
  label: string,
  ts: number,
  ownerJwt: string,
  batchId?: string,
): Promise<BootstrappedUser> {
  const email = `qrv-${role}-${label}-${ts}@fynestudy.example.com`;
  const payload: Record<string, unknown> =
    role === "student"
      ? {
          role,
          full_name: `QRV S ${label}`,
          email,
          batch_id: batchId,
          parent_consent_method: "verbal",
          school_name: "QRV Test School",
          board: "CBSE",
          current_class: "12",
        }
      : {
          role,
          full_name: `QRV T ${label}`,
          email,
          subjects: ["physics"],
        };
  const res = await callFn("auth-bootstrap", payload, ownerJwt);
  if (res.status !== 200) {
    fail(`bootstrap ${role} ${label}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body as unknown as BootstrappedUser;
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

function encodeTokenLocally(payload: {
  v: number;
  sid: string;
  uid: string;
  exp: number;
  jti: string;
}, sig: string): string {
  return b64UrlEncode(Buffer.from(JSON.stringify({ payload, sig }), "utf-8"));
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

async function getQrSignedFor(
  studentJwt: string,
  sessionId: string,
  admin: SupabaseClient,
): Promise<{ payload_b64: string; exp: number }> {
  // Reset student/session sign rate-limit row first so back-to-back calls work.
  await admin
    .from("qr_sign_attempts")
    .delete()
    .eq("session_id", sessionId);
  const res = await callFn(
    "attendance-qr-sign",
    { session_id: sessionId },
    studentJwt,
  );
  if (res.status !== 200) {
    fail(`getQrSignedFor: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body as unknown as { payload_b64: string; exp: number };
}

async function resetVerifyRateLimit(
  admin: SupabaseClient,
  teacherId: string,
): Promise<void> {
  await admin.from("qr_verify_attempts").delete().eq("teacher_id", teacherId);
}

async function main(): Promise<void> {
  const ts = Date.now();

  header("Setup — sign in as owner");
  const ownerJwt = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
  const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  pass("owner JWT acquired");

  header("Setup — fresh Batch A and Batch C");
  const { data: jeeCourse, error: courseErr } = await admin
    .from("courses")
    .select("id")
    .eq("code", "JEE_MAIN")
    .single();
  if (courseErr || !jeeCourse) fail(`load JEE_MAIN: ${courseErr?.message}`);

  const { data: batchA } = await admin
    .from("batches")
    .insert({
      course_id: jeeCourse.id,
      name: `QRV Batch A ${ts}`,
      starts_on: "2026-01-01",
      capacity: 80,
    })
    .select("id")
    .single();
  const batchAId = batchA!.id as string;

  const { data: batchC } = await admin
    .from("batches")
    .insert({
      course_id: jeeCourse.id,
      name: `QRV Batch C ${ts}`,
      starts_on: "2026-01-01",
      capacity: 80,
    })
    .select("id")
    .single();
  const batchCId = batchC!.id as string;
  pass(`Batch A=${batchAId.slice(0, 8)}… Batch C=${batchCId.slice(0, 8)}…`);

  header("Setup — bootstrap student in Batch A + teacher T1 assigned to Batch A");
  const sA = await bootstrap("student", "A", ts, ownerJwt, batchAId);
  const sAJwt = await signIn(sA.email, sA.initial_password);
  const t1 = await bootstrap("teacher", "T1", ts, ownerJwt);
  const t1Jwt = await signIn(t1.email, t1.initial_password);
  const { error: assignErr } = await admin
    .from("batch_teachers")
    .insert({ batch_id: batchAId, teacher_id: t1.user_id });
  if (assignErr) fail(`assign T1 to Batch A: ${assignErr.message}`);
  pass(`student ${sA.email}; teacher ${t1.email} (assigned to Batch A)`);

  // Load V1 secret for hand-crafted-token tests.
  const { data: v1 } = await admin.rpc("get_qr_secret", {
    name: "QR_TOKEN_SECRET_V1",
  });
  if (typeof v1 !== "string") fail(`load V1 secret`);
  const V1 = v1 as string;

  header("Test 1 — 200 present (session started 1 min ago, verify within +10m)");
  const sessionPresentId = await createSession(
    admin,
    -1 * 60 * 1000,
    +60 * 60 * 1000,
    batchAId,
  );
  await resetVerifyRateLimit(admin, t1.user_id);
  const tokPresent = await getQrSignedFor(sAJwt, sessionPresentId, admin);
  const resPresent = await callFn(
    "attendance-qr-verify",
    { qr_payload: tokPresent.payload_b64, session_id: sessionPresentId },
    t1Jwt,
  );
  if (resPresent.status !== 200) {
    fail(`expected 200, got ${resPresent.status} ${JSON.stringify(resPresent.body)}`);
  }
  const presentBody = resPresent.body as {
    status: string;
    student_name: string;
    attendance_id: string;
  };
  if (presentBody.status !== "present") {
    fail(`expected status 'present', got ${presentBody.status}`);
  }
  if (presentBody.student_name !== `QRV S A`) {
    fail(`expected student_name 'QRV S A', got ${presentBody.student_name}`);
  }
  if (!presentBody.attendance_id) fail(`missing attendance_id`);
  pass(`200 present + student_name=${presentBody.student_name} + attendance_id=${presentBody.attendance_id.slice(0, 8)}…`);

  header("Test 2 — 200 late (session started 15 min ago, falls in [+10m,+30m] band)");
  const sessionLateId = await createSession(
    admin,
    -15 * 60 * 1000,
    +60 * 60 * 1000,
    batchAId,
  );
  await resetVerifyRateLimit(admin, t1.user_id);
  const tokLate = await getQrSignedFor(sAJwt, sessionLateId, admin);
  const resLate = await callFn(
    "attendance-qr-verify",
    { qr_payload: tokLate.payload_b64, session_id: sessionLateId },
    t1Jwt,
  );
  if (resLate.status !== 200) {
    fail(`expected 200, got ${resLate.status} ${JSON.stringify(resLate.body)}`);
  }
  if ((resLate.body as { status: string }).status !== "late") {
    fail(`expected status 'late', got ${(resLate.body as { status: string }).status}`);
  }
  pass(`200 late (start was -15m → in late band)`);

  header("Test 3 — 409 replay (verify same QR twice; second hits unique constraint)");
  const sessionReplayId = await createSession(
    admin,
    -1 * 60 * 1000,
    +60 * 60 * 1000,
    batchAId,
  );
  await resetVerifyRateLimit(admin, t1.user_id);
  const tokReplay = await getQrSignedFor(sAJwt, sessionReplayId, admin);
  const replay1 = await callFn(
    "attendance-qr-verify",
    { qr_payload: tokReplay.payload_b64, session_id: sessionReplayId },
    t1Jwt,
  );
  if (replay1.status !== 200) {
    fail(`replay first call expected 200, got ${replay1.status} ${JSON.stringify(replay1.body)}`);
  }
  await resetVerifyRateLimit(admin, t1.user_id);
  const replay2 = await callFn(
    "attendance-qr-verify",
    { qr_payload: tokReplay.payload_b64, session_id: sessionReplayId },
    t1Jwt,
  );
  if (replay2.status !== 409) {
    fail(`replay second call expected 409, got ${replay2.status} ${JSON.stringify(replay2.body)}`);
  }
  pass(`first 200, second 409 (replay blocked by unique (session_id, student_id))`);

  header("Test 4 — 400 sid mismatch (token sid=A, verify against sid=B)");
  const sessionAltId = await createSession(
    admin,
    -1 * 60 * 1000,
    +60 * 60 * 1000,
    batchAId,
  );
  await resetVerifyRateLimit(admin, t1.user_id);
  const tokForAlt = await getQrSignedFor(sAJwt, sessionAltId, admin);
  const sessionOtherId = await createSession(
    admin,
    -1 * 60 * 1000,
    +60 * 60 * 1000,
    batchAId,
  );
  await resetVerifyRateLimit(admin, t1.user_id);
  const resSidMismatch = await callFn(
    "attendance-qr-verify",
    { qr_payload: tokForAlt.payload_b64, session_id: sessionOtherId },
    t1Jwt,
  );
  if (resSidMismatch.status !== 400) {
    fail(`expected 400, got ${resSidMismatch.status} ${JSON.stringify(resSidMismatch.body)}`);
  }
  if (!String((resSidMismatch.body as { error: string }).error).includes("different class")) {
    fail(`expected 'different class' error, got ${JSON.stringify(resSidMismatch.body)}`);
  }
  pass(`400 'QR belongs to a different class'`);

  header("Test 5 — 400 expired (hand-crafted payload with exp in the past)");
  const sessionExpId = await createSession(
    admin,
    -1 * 60 * 1000,
    +60 * 60 * 1000,
    batchAId,
  );
  const expiredPayload = {
    v: 1,
    sid: sessionExpId,
    uid: sA.user_id,
    exp: Math.floor(Date.now() / 1000) - 60,
    jti: "expiredjti12",
  };
  const expiredSig = hmacSign(V1, canonicalString(expiredPayload));
  const expiredToken = encodeTokenLocally(expiredPayload, expiredSig);
  await resetVerifyRateLimit(admin, t1.user_id);
  const resExpired = await callFn(
    "attendance-qr-verify",
    { qr_payload: expiredToken, session_id: sessionExpId },
    t1Jwt,
  );
  if (resExpired.status !== 400) {
    fail(`expected 400, got ${resExpired.status} ${JSON.stringify(resExpired.body)}`);
  }
  if (!String((resExpired.body as { error: string }).error).includes("expired")) {
    fail(`expected 'expired' error, got ${JSON.stringify(resExpired.body)}`);
  }
  pass(`400 'QR expired'`);

  header("Test 6 — 401 tampered signature (one char flipped)");
  const sessionTamperId = await createSession(
    admin,
    -1 * 60 * 1000,
    +60 * 60 * 1000,
    batchAId,
  );
  const goodPayload = {
    v: 1,
    sid: sessionTamperId,
    uid: sA.user_id,
    exp: Math.floor(Date.now() / 1000) + 30,
    jti: "tamperedjti1",
  };
  const goodSig = hmacSign(V1, canonicalString(goodPayload));
  const tamperedSig = goodSig.slice(0, -1) + (goodSig.endsWith("A") ? "B" : "A");
  const tamperedToken = encodeTokenLocally(goodPayload, tamperedSig);
  await resetVerifyRateLimit(admin, t1.user_id);
  const resTamper = await callFn(
    "attendance-qr-verify",
    { qr_payload: tamperedToken, session_id: sessionTamperId },
    t1Jwt,
  );
  if (resTamper.status !== 401) {
    fail(`expected 401, got ${resTamper.status} ${JSON.stringify(resTamper.body)}`);
  }
  pass(`401 signature invalid`);

  header("Test 7 — 400 scan window closed for new entries (start was -35m)");
  const sessionClosedId = await createSession(
    admin,
    -35 * 60 * 1000,
    +30 * 60 * 1000, // end in future so SIGN window still open
    batchAId,
  );
  await resetVerifyRateLimit(admin, t1.user_id);
  const tokClosed = await getQrSignedFor(sAJwt, sessionClosedId, admin);
  const resClosed = await callFn(
    "attendance-qr-verify",
    { qr_payload: tokClosed.payload_b64, session_id: sessionClosedId },
    t1Jwt,
  );
  if (resClosed.status !== 400) {
    fail(`expected 400, got ${resClosed.status} ${JSON.stringify(resClosed.body)}`);
  }
  if (!String((resClosed.body as { error: string }).error).includes("scan window closed")) {
    fail(`expected 'scan window closed', got ${JSON.stringify(resClosed.body)}`);
  }
  pass(`400 scan window closed for new entries`);

  header("Test 8 — 403 teacher not in batch (verify against Batch C session)");
  const sessionCId = await createSession(
    admin,
    -1 * 60 * 1000,
    +60 * 60 * 1000,
    batchCId,
  );
  // Hand-craft a token; we don't have a student in Batch C, and the teacher
  // assignment check fires before signature verification anyway.
  const cPayload = {
    v: 1,
    sid: sessionCId,
    uid: sA.user_id,
    exp: Math.floor(Date.now() / 1000) + 30,
    jti: "batchCjti123",
  };
  const cSig = hmacSign(V1, canonicalString(cPayload));
  const cToken = encodeTokenLocally(cPayload, cSig);
  await resetVerifyRateLimit(admin, t1.user_id);
  const resTeacherNoBatch = await callFn(
    "attendance-qr-verify",
    { qr_payload: cToken, session_id: sessionCId },
    t1Jwt,
  );
  if (resTeacherNoBatch.status !== 403) {
    fail(`expected 403, got ${resTeacherNoBatch.status} ${JSON.stringify(resTeacherNoBatch.body)}`);
  }
  pass(`403 teacher not assigned to this batch`);

  header("Test 9 — 403 student not in session's batch (move student post-sign)");
  const sessionStuId = await createSession(
    admin,
    -1 * 60 * 1000,
    +60 * 60 * 1000,
    batchAId,
  );
  await resetVerifyRateLimit(admin, t1.user_id);
  const tokStu = await getQrSignedFor(sAJwt, sessionStuId, admin);
  // Move student to Batch C via service-role (admin power).
  const { error: moveErr } = await admin
    .from("students")
    .update({ batch_id: batchCId })
    .eq("user_id", sA.user_id);
  if (moveErr) fail(`move student to Batch C: ${moveErr.message}`);
  await resetVerifyRateLimit(admin, t1.user_id);
  const resStuNoBatch = await callFn(
    "attendance-qr-verify",
    { qr_payload: tokStu.payload_b64, session_id: sessionStuId },
    t1Jwt,
  );
  if (resStuNoBatch.status !== 403) {
    fail(`expected 403, got ${resStuNoBatch.status} ${JSON.stringify(resStuNoBatch.body)}`);
  }
  // Move student back so subsequent tests still work.
  await admin
    .from("students")
    .update({ batch_id: batchAId })
    .eq("user_id", sA.user_id);
  pass(`403 QR student is not in this batch`);

  header("Test 10 — 404 unknown session_id");
  await resetVerifyRateLimit(admin, t1.user_id);
  const fakeSession = "00000000-0000-0000-0000-0000000000cc";
  const res404 = await callFn(
    "attendance-qr-verify",
    {
      qr_payload: encodeTokenLocally(
        {
          v: 1,
          sid: fakeSession,
          uid: sA.user_id,
          exp: Math.floor(Date.now() / 1000) + 30,
          jti: "fake12345678",
        },
        hmacSign(V1, "1|" + fakeSession + "|" + sA.user_id + "|" +
          (Math.floor(Date.now() / 1000) + 30) + "|fake12345678"),
      ),
      session_id: fakeSession,
    },
    t1Jwt,
  );
  if (res404.status !== 404) {
    fail(`expected 404, got ${res404.status} ${JSON.stringify(res404.body)}`);
  }
  pass(`404 session not found`);

  header("Test 11 — 400 malformed QR payload (not base64-decodable JSON)");
  const sessionBadId = await createSession(
    admin,
    -1 * 60 * 1000,
    +60 * 60 * 1000,
    batchAId,
  );
  await resetVerifyRateLimit(admin, t1.user_id);
  const resBadShape = await callFn(
    "attendance-qr-verify",
    {
      qr_payload: "this_is_not_a_real_base64url_token_payload_just_garbage_aaaa",
      session_id: sessionBadId,
    },
    t1Jwt,
  );
  if (resBadShape.status !== 400) {
    fail(`expected 400, got ${resBadShape.status} ${JSON.stringify(resBadShape.body)}`);
  }
  pass(`400 malformed payload`);

  header("Test 12 — 401 missing JWT");
  const sessionNoJwtId = await createSession(
    admin,
    -1 * 60 * 1000,
    +60 * 60 * 1000,
    batchAId,
  );
  await resetVerifyRateLimit(admin, t1.user_id);
  const goodTok = await getQrSignedFor(sAJwt, sessionNoJwtId, admin);
  const resNoJwt = await callFn(
    "attendance-qr-verify",
    { qr_payload: goodTok.payload_b64, session_id: sessionNoJwtId },
    null,
  );
  if (resNoJwt.status !== 401) {
    fail(`expected 401, got ${resNoJwt.status} ${JSON.stringify(resNoJwt.body)}`);
  }
  pass(`401 missing JWT`);

  header("Test 13 — 429 rate limited (two consecutive verifies within 500ms)");
  // Two fresh sessions so we don't hit replay first.
  const sessionRL1 = await createSession(
    admin,
    -1 * 60 * 1000,
    +60 * 60 * 1000,
    batchAId,
  );
  const sessionRL2 = await createSession(
    admin,
    -1 * 60 * 1000,
    +60 * 60 * 1000,
    batchAId,
  );
  await resetVerifyRateLimit(admin, t1.user_id);
  const tokRL1 = await getQrSignedFor(sAJwt, sessionRL1, admin);
  const tokRL2 = await getQrSignedFor(sAJwt, sessionRL2, admin);
  // Fire both concurrently (the realistic burst the rate limit guards
  // against). Sequential awaits would let the round-trip eclipse the 500ms
  // min interval. Exactly one should win; the other 429s on the row-level
  // race against `qr_verify_attempts`.
  const [verifyA, verifyB] = await Promise.all([
    callFn(
      "attendance-qr-verify",
      { qr_payload: tokRL1.payload_b64, session_id: sessionRL1 },
      t1Jwt,
    ),
    callFn(
      "attendance-qr-verify",
      { qr_payload: tokRL2.payload_b64, session_id: sessionRL2 },
      t1Jwt,
    ),
  ]);
  const statuses = [verifyA.status, verifyB.status].sort();
  if (statuses[0] !== 200 || statuses[1] !== 429) {
    fail(
      `expected one 200 + one 429, got [${verifyA.status}, ${verifyB.status}] ` +
        `bodies=${JSON.stringify(verifyA.body)} ${JSON.stringify(verifyB.body)}`,
    );
  }
  const limited = verifyA.status === 429 ? verifyA : verifyB;
  if ((limited.body as { detail?: { retry_after_ms?: number } }).detail?.retry_after_ms !== 500) {
    fail(`expected retry_after_ms=500 on the 429, got ${JSON.stringify(limited.body)}`);
  }
  pass(`one 200 + one 429 (retry_after_ms=500) under concurrent verify burst`);

  header("Verify side-effect — attendance + activity_days + audit_log all present");
  const { data: attRows } = await admin
    .from("attendance")
    .select("id, status, method, qr_token_jti, marked_by")
    .eq("student_id", sA.user_id)
    .eq("method", "qr");
  if (!attRows || attRows.length < 1) {
    fail(`expected ≥1 qr attendance row for student A, got ${attRows?.length}`);
  }
  const { data: actRows } = await admin
    .from("activity_days")
    .select("day")
    .eq("student_id", sA.user_id);
  if (!actRows || actRows.length < 1) {
    fail(`expected ≥1 activity_days row for student A, got ${actRows?.length}`);
  }
  const { data: audRows } = await admin
    .from("audit_log")
    .select("id, action, actor_role, entity_table")
    .eq("action", "attendance_marked")
    .eq("actor_user_id", t1.user_id);
  if (!audRows || audRows.length < 1) {
    fail(`expected ≥1 audit_log row for 'attendance_marked' by teacher, got ${audRows?.length}`);
  }
  if (audRows[0].actor_role !== "teacher" || audRows[0].entity_table !== "attendance") {
    fail(`audit row has wrong shape: ${JSON.stringify(audRows[0])}`);
  }
  pass(
    `attendance rows=${attRows.length}; activity_days rows=${actRows.length}; audit_log rows=${audRows.length}`,
  );

  console.log(`\nALL 13 attendance-qr-verify SMOKE TESTS PASSED + side-effects verified.`);
  console.log(`Fixtures (left in place — idempotent):`);
  console.log(`  Batch A:        ${batchAId}`);
  console.log(`  Batch C:        ${batchCId}`);
  console.log(`  Student A:      ${sA.email}`);
  console.log(`  Teacher T1:     ${t1.email} (assigned to Batch A)`);
}

main().catch((err) => {
  fail(err instanceof Error ? (err.stack ?? err.message) : String(err));
});
