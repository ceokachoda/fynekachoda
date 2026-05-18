// Phase 4 CP6 — `attendance-correct` edge fn (spec §6).
//
// Caller: admin OR teacher assigned to the session's batch. Updates an
// existing `attendance.status`, records an `attendance_corrections` row
// (prev/new/reason/changed_by) and writes the audit log. The original
// `marked_by` on `attendance` is left untouched so the audit trail keeps the
// scanner/marker history; corrector identity lives in `attendance_corrections`.
//
// Per D-038 the `reason` is required.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import {
  adminRoleFor,
  AuthError,
  loadCaller,
  requireAnyRole,
} from "../_shared/auth.ts";
import { AttendanceCorrectInputSchema } from "../_shared/schemas.ts";
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
    requireAnyRole(caller, ["teacher", "owner_admin", "staff_admin"]);

    const rawBody = await req.json().catch(() => null);
    if (rawBody === null) return jsonError(400, "invalid JSON body", origin);
    const parsed = AttendanceCorrectInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const { attendance_id, new_status, reason } = parsed.data;

    const admin = getServiceRoleClient();
    const isAdmin = adminRoleFor(caller) !== null;

    const { data: attRow, error: attErr } = await admin
      .from("attendance")
      .select("id, session_id, student_id, status, method")
      .eq("id", attendance_id)
      .maybeSingle();
    if (attErr) {
      return jsonError(500, "attendance lookup failed", origin, attErr.message);
    }
    if (!attRow) return jsonError(404, "attendance not found", origin);

    const { data: sessionRow, error: sessionErr } = await admin
      .from("sessions")
      .select("id, batch_id")
      .eq("id", attRow.session_id as string)
      .maybeSingle();
    if (sessionErr) {
      return jsonError(500, "session lookup failed", origin, sessionErr.message);
    }
    if (!sessionRow) return jsonError(404, "session not found", origin);

    if (!isAdmin) {
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
    }

    const prevStatus = attRow.status as "present" | "late" | "absent";
    if (prevStatus === new_status) {
      return jsonError(409, "status already matches new_status", origin);
    }

    const { error: corrErr } = await admin
      .from("attendance_corrections")
      .insert({
        attendance_id,
        prev_status: prevStatus,
        new_status,
        reason,
        changed_by: caller.app_user_id,
      });
    if (corrErr) {
      return jsonError(
        500,
        "attendance_corrections insert failed",
        origin,
        corrErr.message,
      );
    }

    const { error: updateErr } = await admin
      .from("attendance")
      .update({ status: new_status, method: "correction" })
      .eq("id", attendance_id);
    if (updateErr) {
      return jsonError(500, "attendance update failed", origin, updateErr.message);
    }

    await writeAudit(admin, {
      actor_user_id: caller.app_user_id,
      actor_role: isAdmin ? adminRoleFor(caller) : "teacher",
      action: "attendance_corrected",
      entity_table: "attendance",
      entity_id: attendance_id,
      before_data: { status: prevStatus, method: attRow.method },
      after_data: { status: new_status, method: "correction", reason },
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent"),
    });

    return json(
      200,
      { attendance_id, prev_status: prevStatus, new_status },
      origin,
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("attendance-correct error:", err);
    return jsonError(500, "internal error", origin);
  }
});
