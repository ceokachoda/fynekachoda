// Phase 4 CP4 — `attendance-qr-sign` edge fn.
//
// Caller: authenticated student. Input: `{ session_id }`. On accept, returns a
// base64url-encoded HMAC-signed token good for 30 seconds, plus the unix
// `exp` for the mobile UI's countdown. No audit_log row — audit happens on
// the verify side per spec §4.4 step 11.
//
// Binding decisions:
//   D-030 — 30-second HMAC token. Server time is authoritative.
//   D-031 — replay-impossible via `(session_id, student_id)` UNIQUE on
//           `attendance`; the dup check here returns 409 *before* signing so
//           the student never sees a token they couldn't redeem.
//   D-033 — scan window: 15 min before scheduled_start → 15 min after
//           scheduled_end. Outside → 400.
//   D-104 — sign always uses V1 only; verify (CP5) honors V1 + optional V2.
//   D-115 — 1 sign / 5s / (student, session). Backed by
//           `public.try_qr_sign_rate_limit` (one row per pair).
//   D-146 — RLS helpers live in `private`; edge-fn-callable RPCs live in
//           `public` with EXECUTE locked to service_role.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import { AuthError, loadCaller, requireAnyRole } from "../_shared/auth.ts";
import {
  encodeQrToken,
  generateJti,
  type QrPayload,
  signQrPayload,
} from "../_shared/hmac.ts";
import { getQrSecrets, VaultError } from "../_shared/vault.ts";
import { QrSignInputSchema } from "../_shared/schemas.ts";

const SCAN_WINDOW_BEFORE_MS = 15 * 60 * 1000;
const SCAN_WINDOW_AFTER_MS = 15 * 60 * 1000;
const TOKEN_LIFETIME_SEC = 30;
const RATE_LIMIT_RETRY_MS = 5_000;

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const origin = req.headers.get("Origin");

  if (req.method !== "POST") {
    return jsonError(405, "method not allowed", origin);
  }

  try {
    const caller = await loadCaller(req);
    requireAnyRole(caller, ["student"]);

    const rawBody = await req.json().catch(() => null);
    if (rawBody === null) return jsonError(400, "invalid JSON body", origin);
    const parsed = QrSignInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const { session_id } = parsed.data;

    const admin = getServiceRoleClient();

    const { data: student, error: studentErr } = await admin
      .from("students")
      .select("batch_id")
      .eq("user_id", caller.app_user_id)
      .maybeSingle();
    if (studentErr) {
      return jsonError(500, "student lookup failed", origin, studentErr.message);
    }
    if (!student) {
      return jsonError(403, "caller is not a student", origin);
    }

    const { data: session, error: sessionErr } = await admin
      .from("sessions")
      .select("id, batch_id, scheduled_start, scheduled_end, status")
      .eq("id", session_id)
      .maybeSingle();
    if (sessionErr) {
      return jsonError(500, "session lookup failed", origin, sessionErr.message);
    }
    if (!session) {
      return jsonError(404, "session not found", origin);
    }
    if (session.batch_id !== student.batch_id) {
      return jsonError(403, "session not in your batch", origin);
    }

    const now = Date.now();
    const startMs = new Date(session.scheduled_start as string).getTime();
    const endMs = new Date(session.scheduled_end as string).getTime();
    if (
      now < startMs - SCAN_WINDOW_BEFORE_MS ||
      now > endMs + SCAN_WINDOW_AFTER_MS
    ) {
      return jsonError(400, "scan window closed", origin);
    }

    // Dup-check before rate-limit: an already-marked student gets a clean 409
    // instead of a 429 confusion on retry.
    const { data: existing, error: existingErr } = await admin
      .from("attendance")
      .select("id")
      .eq("session_id", session_id)
      .eq("student_id", caller.app_user_id)
      .maybeSingle();
    if (existingErr) {
      return jsonError(
        500,
        "attendance lookup failed",
        origin,
        existingErr.message,
      );
    }
    if (existing) {
      return jsonError(409, "already marked", origin);
    }

    const { data: allowed, error: rateLimitErr } = await admin.rpc(
      "try_qr_sign_rate_limit",
      {
        p_session_id: session_id,
        p_student_id: caller.app_user_id,
      },
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
      return jsonError(429, "rate limited", origin, {
        retry_after_ms: RATE_LIMIT_RETRY_MS,
      });
    }

    const secrets = await getQrSecrets();
    const payload: QrPayload = {
      v: 1,
      sid: session_id,
      uid: caller.app_user_id,
      exp: Math.floor(now / 1000) + TOKEN_LIFETIME_SEC,
      jti: generateJti(),
    };
    const sig = await signQrPayload(payload, secrets[0]!);
    const payload_b64 = encodeQrToken({ payload, sig });

    return json(200, { payload_b64, exp: payload.exp }, origin);
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    if (err instanceof VaultError) {
      console.error("attendance-qr-sign vault error:", err.message);
      return jsonError(500, "vault unavailable", origin);
    }
    console.error("attendance-qr-sign error:", err);
    return jsonError(500, "internal error", origin);
  }
});
