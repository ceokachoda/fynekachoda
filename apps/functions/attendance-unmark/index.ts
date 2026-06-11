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

function istDayOf(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });
}

// UTC instants bounding an IST calendar day (D-014).
function istDayBoundsUtc(day: string): { start: string; end: string } {
  const start = new Date(`${day}T00:00:00+05:30`);
  return {
    start: start.toISOString(),
    end: new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  };
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
    const parsed = AttendanceUnmarkInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const { session_id, student_id } = parsed.data;

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

    // The mark fed `activity_days` (streaks). Take the day back ONLY if no
    // other qualifying activity exists for that IST day — the table has no
    // provenance, and quizzes / exams / video-watching / another class all
    // write the same (student_id, day) row. Fail-safe: on any doubt or query
    // error, keep the day (over-crediting a streak beats wrongly breaking one).
    if (existing.status === "present" || existing.status === "late") {
      try {
        const day = istDayOf(sessionRow.scheduled_start as string);
        const { start, end } = istDayBoundsUtc(day);

        const [otherAttendance, quiz, exam, video] = await Promise.all([
          admin
            .from("attendance")
            .select("id, sessions!inner(scheduled_start)")
            .eq("student_id", student_id)
            .in("status", ["present", "late"])
            .gte("sessions.scheduled_start", start)
            .lt("sessions.scheduled_start", end)
            .limit(1),
          admin
            .from("quiz_attempts")
            .select("id")
            .eq("student_id", student_id)
            .gte("submitted_at", start)
            .lt("submitted_at", end)
            .limit(1),
          admin
            .from("exam_attempts")
            .select("id")
            .eq("student_id", student_id)
            .gte("submitted_at", start)
            .lt("submitted_at", end)
            .limit(1),
          admin
            .from("video_progress")
            .select("content_id")
            .eq("student_id", student_id)
            .gte("watched_pct", 50)
            .gte("last_watched_at", start)
            .lt("last_watched_at", end)
            .limit(1),
        ]);

        const anyError =
          otherAttendance.error || quiz.error || exam.error || video.error;
        const anyActivity =
          (otherAttendance.data?.length ?? 0) > 0 ||
          (quiz.data?.length ?? 0) > 0 ||
          (exam.data?.length ?? 0) > 0 ||
          (video.data?.length ?? 0) > 0;

        if (!anyError && !anyActivity) {
          const { error: actDelErr } = await admin
            .from("activity_days")
            .delete()
            .eq("student_id", student_id)
            .eq("day", day);
          if (actDelErr) {
            console.error("activity_days cleanup failed:", actDelErr.message);
          }
        }
      } catch (e) {
        console.error("activity_days cleanup threw:", e);
      }
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
