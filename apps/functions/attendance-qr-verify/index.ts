// Phase 4 CP5 — `attendance-qr-verify` edge fn.
//
// Caller: authenticated teacher assigned to the session's batch. Input:
// `{ qr_payload, session_id }`. On accept, INSERTs the attendance row, bumps
// `activity_days`, writes the audit log, and returns
// `{ status, student_name, attendance_id }`.
//
// The attendance INSERT itself is the Realtime signal — Postgres CDC on
// `public.attendance` is what the mobile teacher's roster screen subscribes
// to per spec §5.8 ("rely on attendance INSERT events being streamed via
// Postgres CDC — simpler"). No manual broadcast call required.
//
// Verification order matches spec §4.4 step-by-step. Audit row is best-effort
// (see `_shared/audit.ts`) — if it fails, the attendance row still stands.
//
// Binding decisions:
//   D-030 — server-issued exp + server-only verification.
//   D-031 — replay-impossible via `(session_id, student_id)` UNIQUE.
//   D-034 — status bands: ≤ start+10m → present, ≤ start+30m → late, else
//           rejected with 400 "scan window closed for new entries".
//   D-104 — verify accepts V1 + optional V2 during the 24h grace window.
//   D-115 — 2 verifies / sec / teacher. Backed by
//           `public.try_qr_verify_rate_limit` (one row per teacher).
//   D-146 — RLS helpers stay in `private`; edge-fn-callable RPCs live in
//           `public` with EXECUTE locked to service_role.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import { AuthError, loadCaller, requireAnyRole } from "../_shared/auth.ts";
import { decodeQrToken, verifyQrPayload } from "../_shared/hmac.ts";
import { getQrSecrets, VaultError } from "../_shared/vault.ts";
import { QrVerifyInputSchema } from "../_shared/schemas.ts";
import { clientIp, writeAudit } from "../_shared/audit.ts";

const PRESENT_BAND_MS = 10 * 60 * 1000;
const LATE_BAND_MS = 30 * 60 * 1000;
const ATTENDANCE_UNIQUE_VIOLATION = "23505";

function todayIstDateString(now: Date = new Date()): string {
  // `en-CA` locale produces YYYY-MM-DD; the timezone forces IST per D-014.
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const origin = req.headers.get("Origin");

  if (req.method !== "POST") {
    return jsonError(405, "method not allowed", origin);
  }

  try {
    const caller = await loadCaller(req);
    requireAnyRole(caller, ["teacher"]);

    const rawBody = await req.json().catch(() => null);
    if (rawBody === null) return jsonError(400, "invalid JSON body", origin);
    const parsed = QrVerifyInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const { qr_payload, session_id } = parsed.data;

    const admin = getServiceRoleClient();

    const { data: session, error: sessionErr } = await admin
      .from("sessions")
      .select("id, batch_id, scheduled_start, scheduled_end, status")
      .eq("id", session_id)
      .maybeSingle();
    if (sessionErr) {
      return jsonError(500, "session lookup failed", origin, sessionErr.message);
    }
    if (!session) return jsonError(404, "session not found", origin);

    const { data: assignment, error: assignmentErr } = await admin
      .from("batch_teachers")
      .select("teacher_id")
      .eq("batch_id", session.batch_id as string)
      .eq("teacher_id", caller.app_user_id)
      .maybeSingle();
    if (assignmentErr) {
      return jsonError(
        500,
        "teacher assignment lookup failed",
        origin,
        assignmentErr.message,
      );
    }
    if (!assignment) {
      return jsonError(403, "teacher not assigned to this batch", origin);
    }

    const { data: allowed, error: rateLimitErr } = await admin.rpc(
      "try_qr_verify_rate_limit",
      { p_teacher_id: caller.app_user_id },
    );
    if (rateLimitErr) {
      return jsonError(
        500,
        "rate limit check failed",
        origin,
        rateLimitErr.message,
      );
    }
    if (allowed !== true) {
      return jsonError(429, "rate limited", origin, { retry_after_ms: 500 });
    }

    let decoded;
    try {
      decoded = decodeQrToken(qr_payload);
    } catch (_e) {
      return jsonError(400, "malformed QR payload", origin);
    }

    const secrets = await getQrSecrets();
    const sigIdx = await verifyQrPayload(decoded.payload, decoded.sig, secrets);
    if (sigIdx < 0) {
      return jsonError(401, "QR signature invalid", origin);
    }

    const nowMs = Date.now();
    const nowSec = Math.floor(nowMs / 1000);
    if (decoded.payload.exp <= nowSec) {
      return jsonError(400, "QR expired, ask student to refresh", origin);
    }

    if (decoded.payload.sid !== session_id) {
      return jsonError(400, "QR belongs to a different class", origin);
    }

    const { data: student, error: studentErr } = await admin
      .from("students")
      .select("user_id, batch_id")
      .eq("user_id", decoded.payload.uid)
      .maybeSingle();
    if (studentErr) {
      return jsonError(500, "student lookup failed", origin, studentErr.message);
    }
    if (!student) {
      return jsonError(403, "QR student is not enrolled", origin);
    }
    if (student.batch_id !== session.batch_id) {
      return jsonError(403, "QR student is not in this batch", origin);
    }

    const startMs = new Date(session.scheduled_start as string).getTime();
    let status: "present" | "late";
    if (nowMs <= startMs + PRESENT_BAND_MS) {
      status = "present";
    } else if (nowMs <= startMs + LATE_BAND_MS) {
      status = "late";
    } else {
      return jsonError(400, "scan window closed for new entries", origin);
    }

    const { data: inserted, error: insertErr } = await admin
      .from("attendance")
      .insert({
        session_id,
        student_id: decoded.payload.uid,
        status,
        method: "qr",
        qr_token_jti: decoded.payload.jti,
        marked_by: caller.app_user_id,
      })
      .select("id")
      .single();
    if (insertErr) {
      if ((insertErr as { code?: string }).code === ATTENDANCE_UNIQUE_VIOLATION) {
        return jsonError(409, "already marked", origin);
      }
      return jsonError(500, "attendance insert failed", origin, insertErr.message);
    }
    const attendanceId = inserted!.id as string;

    const { error: activityErr } = await admin
      .from("activity_days")
      .upsert(
        { student_id: decoded.payload.uid, day: todayIstDateString() },
        { onConflict: "student_id,day" },
      );
    if (activityErr) {
      console.error("activity_days upsert failed:", activityErr.message);
    }

    const { data: studentRow } = await admin
      .from("app_users")
      .select("full_name")
      .eq("id", decoded.payload.uid)
      .maybeSingle();
    const student_name = (studentRow?.full_name as string | undefined) ?? "";

    await writeAudit(admin, {
      actor_user_id: caller.app_user_id,
      actor_role: "teacher",
      action: "attendance_marked",
      entity_table: "attendance",
      entity_id: attendanceId,
      before_data: null,
      after_data: {
        session_id,
        student_id: decoded.payload.uid,
        status,
        method: "qr",
        qr_token_jti: decoded.payload.jti,
        marked_by: caller.app_user_id,
      },
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent"),
    });

    return json(
      200,
      {
        status,
        student_name,
        attendance_id: attendanceId,
      },
      origin,
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    if (err instanceof VaultError) {
      console.error("attendance-qr-verify vault error:", err.message);
      return jsonError(500, "vault unavailable", origin);
    }
    console.error("attendance-qr-verify error:", err);
    return jsonError(500, "internal error", origin);
  }
});
