// Phase 7 CP7 — `exam-release-results` edge fn.
//
// Caller: teacher who owns the exam (created_by) OR a teacher assigned to
// the exam's batch OR admin. Input: `{ exam_id }`.
//
// Flips `exams.results_released_at = now()` (idempotent — toggling on a
// released exam returns 200 with the existing timestamp). Spec §7. Audits
// with before/after.
//
// To unrelease, admins call `exam-admin-mutate { op: force_unrelease_results }`.
// Teachers cannot un-release (one-way ratchet for trust).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import {
  adminRoleFor,
  AuthError,
  loadCaller,
} from "../_shared/auth.ts";
import { ExamReleaseResultsInputSchema } from "../_shared/schemas.ts";
import { clientIp, writeAudit } from "../_shared/audit.ts";

function isAdmin(roles: string[]): boolean {
  return roles.includes("owner_admin") || roles.includes("staff_admin");
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
    const isTeacher = caller.roles.includes("teacher");
    const callerIsAdmin = isAdmin(caller.roles);
    if (!isTeacher && !callerIsAdmin) {
      return jsonError(403, "teacher or admin only", origin);
    }

    const rawBody = await req.json().catch(() => null);
    if (rawBody === null) return jsonError(400, "invalid JSON body", origin);
    const parsed = ExamReleaseResultsInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const { exam_id } = parsed.data;

    const admin = getServiceRoleClient();

    const { data: exam, error: eErr } = await admin
      .from("exams")
      .select("*")
      .eq("id", exam_id)
      .maybeSingle();
    if (eErr) {
      return jsonError(500, "exam lookup failed", origin, eErr.message);
    }
    if (!exam) return jsonError(404, "exam not found", origin);

    // Scope check for teachers.
    if (!callerIsAdmin) {
      let ok = exam.created_by === caller.app_user_id;
      if (!ok) {
        const { data: bt } = await admin
          .from("batch_teachers")
          .select("batch_id")
          .eq("batch_id", exam.batch_id)
          .eq("teacher_id", caller.app_user_id)
          .maybeSingle();
        ok = !!bt;
      }
      if (!ok) return jsonError(403, "not your exam batch", origin);
    }

    if (exam.results_released_at !== null) {
      return json(
        200,
        {
          exam_id,
          results_released_at: exam.results_released_at,
          already_released: true,
        },
        origin,
      );
    }

    const releasedAt = new Date().toISOString();
    const { data: after, error: uErr } = await admin
      .from("exams")
      .update({ results_released_at: releasedAt })
      .eq("id", exam_id)
      .is("results_released_at", null)
      .select("*")
      .maybeSingle();
    if (uErr) {
      return jsonError(500, "release update failed", origin, uErr.message);
    }
    if (!after) {
      // Race: another caller released in the gap.
      const { data: re } = await admin
        .from("exams")
        .select("results_released_at")
        .eq("id", exam_id)
        .maybeSingle();
      return json(
        200,
        {
          exam_id,
          results_released_at: re?.results_released_at ?? releasedAt,
          already_released: true,
        },
        origin,
      );
    }

    await writeAudit(admin, {
      actor_user_id: caller.app_user_id,
      actor_role: callerIsAdmin ? adminRoleFor(caller) : "teacher",
      action: "exam_results_released",
      entity_table: "exams",
      entity_id: exam_id,
      before_data: { results_released_at: null },
      after_data: { results_released_at: after.results_released_at },
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent"),
    });

    return json(
      200,
      {
        exam_id,
        results_released_at: after.results_released_at,
        already_released: false,
      },
      origin,
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("exam-release-results error:", err);
    return jsonError(500, "internal error", origin);
  }
});
