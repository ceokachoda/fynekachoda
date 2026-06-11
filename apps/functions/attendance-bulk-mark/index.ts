// Phase 4 CP6 — `attendance-bulk-mark` edge fn (spec §5).
//
// Caller: teacher assigned to the session's batch. For every student in the
// batch with no existing `attendance` row for the given session, INSERTs a
// row with the requested status and `method='manual'`. Existing rows are
// left untouched (AC #12). One bulk write → one audit row with the count.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import { AuthError, loadCaller, requireAnyRole } from "../_shared/auth.ts";
import { AttendanceBulkMarkInputSchema } from "../_shared/schemas.ts";
import { clientIp, writeAudit } from "../_shared/audit.ts";

// IST calendar day (D-014) of the session — streak credit belongs to the day
// the students attended, even if the teacher bulk-marks later.
function istDayOf(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });
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
    const parsed = AttendanceBulkMarkInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const { session_id, mark_remaining } = parsed.data;

    const admin = getServiceRoleClient();

    const { data: sessionRow, error: sessionErr } = await admin
      .from("sessions")
      .select("id, batch_id, scheduled_start")
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

    const { data: batchStudents, error: studentsErr } = await admin
      .from("students")
      .select("user_id")
      .eq("batch_id", sessionRow.batch_id as string);
    if (studentsErr) {
      return jsonError(500, "students lookup failed", origin, studentsErr.message);
    }

    const { data: existing, error: existingErr } = await admin
      .from("attendance")
      .select("student_id")
      .eq("session_id", session_id);
    if (existingErr) {
      return jsonError(
        500,
        "attendance lookup failed",
        origin,
        existingErr.message,
      );
    }
    const existingIds = new Set(
      (existing ?? []).map((r) => r.student_id as string),
    );

    const toInsert = (batchStudents ?? [])
      .map((s) => s.user_id as string)
      .filter((uid) => !existingIds.has(uid))
      .map((uid) => ({
        session_id,
        student_id: uid,
        status: mark_remaining,
        method: "manual",
        marked_by: caller.app_user_id,
      }));

    let inserted = 0;
    if (toInsert.length > 0) {
      const { error: insertErr, count } = await admin
        .from("attendance")
        .insert(toInsert, { count: "exact" });
      if (insertErr) {
        return jsonError(
          500,
          "bulk insert failed",
          origin,
          insertErr.message,
        );
      }
      inserted = count ?? toInsert.length;

      // Streak + badge parity with QR scans — only "present" earns activity
      // ("absent" is the opposite of an active day). Best-effort.
      if (mark_remaining === "present") {
        const day = istDayOf(sessionRow.scheduled_start as string);
        const { error: activityErr } = await admin
          .from("activity_days")
          .upsert(
            toInsert.map((r) => ({ student_id: r.student_id, day })),
            { onConflict: "student_id,day", ignoreDuplicates: true },
          );
        if (activityErr) {
          console.error("activity_days upsert failed:", activityErr.message);
        }

        const evals = await Promise.allSettled(
          toInsert.map((r) =>
            admin.rpc("evaluate_student_badges", {
              p_student: r.student_id,
              p_triggers: ["attendance"],
            }),
          ),
        );
        for (const e of evals) {
          if (e.status === "rejected") {
            console.error("badge eval threw:", e.reason);
          } else if (e.value.error) {
            console.error("badge eval failed:", e.value.error.message);
          }
        }
      }
    }

    await writeAudit(admin, {
      actor_user_id: caller.app_user_id,
      actor_role: "teacher",
      action: "attendance_bulk_mark",
      entity_table: "attendance",
      entity_id: session_id,
      before_data: { existing_count: existingIds.size },
      after_data: { inserted, status: mark_remaining, method: "manual" },
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent"),
    });

    return json(200, { session_id, inserted, status: mark_remaining }, origin);
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("attendance-bulk-mark error:", err);
    return jsonError(500, "internal error", origin);
  }
});
