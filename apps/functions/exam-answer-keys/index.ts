// `exam-answer-keys` edge fn.
//
// Returns the per-attempt frozen answer keys (correct_option_id +
// regrade_override per question) for a teacher's exam, so the teacher results
// board can compute per-question correctness analytics.
//
// WHY this exists: `exam_attempts.question_snapshot` pins correct_option_id at
// attempt start (D-052/D-180). Postgres RLS filters rows, not columns, so the
// student self-read policy on `exam_attempts` would otherwise expose the answer
// key mid-exam. The column is now revoked from `authenticated`
// (see migration `*_exam_attempts_hide_snapshot.sql`); the only legitimate
// non-grading reader (the teacher board) goes through this service-role fn,
// gated to the exam's teacher / batch-teacher / admin — exactly like
// `exam-release-results`.
//
// Caller: teacher who owns the exam (created_by) OR a teacher assigned to the
// exam's batch OR admin. Input: `{ exam_id }`. Read-only (no audit).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import { AuthError, loadCaller } from "../_shared/auth.ts";
// Same shape as this fn's input ({ exam_id: uuid }); reused to avoid a
// duplicate schema.
import { ExamReleaseResultsInputSchema } from "../_shared/schemas.ts";

function isAdmin(roles: string[]): boolean {
  return roles.includes("owner_admin") || roles.includes("staff_admin");
}

interface SnapshotQuestion {
  id: string;
  correct_option_id: string | null;
  regrade_override?: "all" | "none" | null;
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
      .select("id, created_by, batch_id")
      .eq("id", exam_id)
      .maybeSingle();
    if (eErr) {
      return jsonError(500, "exam lookup failed", origin, eErr.message);
    }
    if (!exam) return jsonError(404, "exam not found", origin);

    // Scope check for teachers (admins bypass).
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

    const { data: rows, error: aErr } = await admin
      .from("exam_attempts")
      .select("id, question_snapshot")
      .eq("exam_id", exam_id)
      .not("submitted_at", "is", null);
    if (aErr) {
      return jsonError(500, "attempts lookup failed", origin, aErr.message);
    }

    const attempts = (rows ?? []).map((r) => {
      const snap = r.question_snapshot as
        | { questions?: SnapshotQuestion[] }
        | null;
      return {
        attempt_id: r.id as string,
        questions: (snap?.questions ?? []).map((q) => ({
          id: q.id,
          correct_option_id: q.correct_option_id,
          regrade_override: q.regrade_override ?? null,
        })),
      };
    });

    return json(200, { attempts }, origin);
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("exam-answer-keys error:", err);
    return jsonError(500, "internal error", origin);
  }
});
