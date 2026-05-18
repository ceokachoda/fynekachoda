// `attendance-unmark` edge fn — Phase 4 follow-up.
//
// Caller: teacher assigned to the session's batch. Deletes the student's
// existing attendance row for this session so the roster goes back to
// "unmarked". Pairs with the roster screen's tap-active-pill-to-toggle UX.
//
// The deleted state is captured in the audit_log `before_data` so the
// history isn't lost despite the row no longer existing.
//
// Audit action: `attendance_unmarked`.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import { AuthError, loadCaller, requireAnyRole } from "../_shared/auth.ts";
import { AttendanceUnmarkInputSchema } from "../_shared/schemas.ts";
import { clientIp, writeAudit } from "../_shared/audit.ts";

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
    const parsed = AttendanceUnmarkInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const { session_id, student_id } = parsed.data;

    const admin = getServiceRoleClient();

    const { data: sessionRow, error: sessionErr } = await admin
      .from("sessions")
      .select("id, batch_id")
      .eq("id", session_id)
      .maybeSingle();
    if (sessionErr) {
      return jsonError(500, "session lookup failed", origin, sessionErr.message);
    }
    if (!sessionRow) return jsonError(404, "session not found", origin);

    const { data: assignment, error: assignmentErr } = await admin
      .from("batch_teachers")
      .select("teacher_id")
      .eq("batch_id", sessionRow.batch_id as string)
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

    const { data: existing, error: existingErr } = await admin
      .from("attendance")
      .select("id, status, method, marked_by, marked_at")
      .eq("session_id", session_id)
      .eq("student_id", student_id)
      .maybeSingle();
    if (existingErr) {
      return jsonError(500, "attendance lookup failed", origin, existingErr.message);
    }
    if (!existing) return jsonError(404, "attendance row not found", origin);

    const attendanceId = existing.id as string;

    const { error: delErr } = await admin
      .from("attendance")
      .delete()
      .eq("id", attendanceId);
    if (delErr) {
      return jsonError(500, "attendance delete failed", origin, delErr.message);
    }

    await writeAudit(admin, {
      actor_user_id: caller.app_user_id,
      actor_role: "teacher",
      action: "attendance_unmarked",
      entity_table: "attendance",
      entity_id: attendanceId,
      before_data: {
        session_id,
        student_id,
        status: existing.status,
        method: existing.method,
        marked_by: existing.marked_by,
        marked_at: existing.marked_at,
      },
      after_data: null,
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent"),
    });

    return json(
      200,
      { unmarked: true, attendance_id: attendanceId, session_id, student_id },
      origin,
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("attendance-unmark error:", err);
    return jsonError(500, "internal error", origin);
  }
});
