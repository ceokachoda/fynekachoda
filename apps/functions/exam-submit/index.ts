// Phase 7 CP6 — `exam-submit` edge fn.
//
// Caller: authenticated student who owns the in-flight attempt.
// Input:  `{ attempt_id }`.
//
// Responsibilities (spec §5.6 + §6.4):
//   1. Verify caller owns the attempt AND it isn't already submitted.
//   2. Load the SNAPSHOT — grading uses the snapshot's per-question
//      `correct_option_id`, NOT live `question_options.is_correct`
//      (D-052: live edits don't change in-flight attempts).
//   3. Server-time enforcement: `auto_submitted = now > starts_at + duration`.
//      Even if the student misses the deadline locally, submit is still
//      accepted but flagged.
//   4. Score by walking the snapshot.questions × saved exam_answers.
//   5. UPDATE `exam_attempts` (atomic; 409 on race).
//   6. UPSERT `activity_days` (IST per D-014).
//   7. Audit `exam_submitted` (best-effort).
//   8. Recompute mastery for the exam's touched topics (D-070), best-effort.
//   9. If `exams.result_release = 'instant'` and (admin or auto-released),
//      return the full post-submit result payload. Else return just
//      `{ submitted: true }` — student reads result via
//      `exam-attempt-result` once teacher releases.
//
// Replay protection: a second call on the same attempt returns 409.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import { AuthError, loadCaller, requireAnyRole } from "../_shared/auth.ts";
import { ExamSubmitInputSchema } from "../_shared/schemas.ts";
import { clientIp, writeAudit } from "../_shared/audit.ts";
import {
  type AnswerInput,
  type ExamSnapshot,
  gradeAttempt,
  isAutoSubmittedAt,
} from "../_shared/exam-marking.ts";

function todayIstDateString(now: Date = new Date()): string {
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
    requireAnyRole(caller, ["student"]);

    const rawBody = await req.json().catch(() => null);
    if (rawBody === null) return jsonError(400, "invalid JSON body", origin);
    const parsed = ExamSubmitInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const { attempt_id } = parsed.data;

    const admin = getServiceRoleClient();

    const { data: attempt, error: attErr } = await admin
      .from("exam_attempts")
      .select(
        "id, exam_id, student_id, started_at, deadline_at, submitted_at, tab_switch_count, question_snapshot",
      )
      .eq("id", attempt_id)
      .maybeSingle();
    if (attErr) {
      return jsonError(500, "attempt lookup failed", origin, attErr.message);
    }
    if (!attempt) return jsonError(404, "attempt not found", origin);
    if (attempt.student_id !== caller.app_user_id) {
      return jsonError(403, "not your attempt", origin);
    }
    if (attempt.submitted_at !== null) {
      return jsonError(409, "attempt already submitted", origin);
    }

    const { data: exam, error: eErr } = await admin
      .from("exams")
      .select(
        "id, title, batch_id, starts_at, duration_min, marks_correct, marks_wrong, marks_skip, result_release, results_released_at",
      )
      .eq("id", attempt.exam_id)
      .maybeSingle();
    if (eErr) {
      return jsonError(500, "exam lookup failed", origin, eErr.message);
    }
    if (!exam) return jsonError(404, "exam not found", origin);

    // Load saved answers from exam_answers (auto-saved via PostgREST).
    const { data: answers, error: ansErr } = await admin
      .from("exam_answers")
      .select("question_id, selected_option_id, is_flagged, answered_at")
      .eq("attempt_id", attempt_id);
    if (ansErr) {
      return jsonError(500, "answers lookup failed", origin, ansErr.message);
    }
    const answerByQ = new Map<
      string,
      { selected_option_id: string | null; is_flagged: boolean; answered_at: string | null }
    >();
    for (const a of answers ?? []) {
      answerByQ.set(a.question_id, {
        selected_option_id: a.selected_option_id,
        is_flagged: !!a.is_flagged,
        answered_at: a.answered_at,
      });
    }

    // Grade against snapshot's correct_option_id.
    const snapshot = (attempt.question_snapshot ?? { questions: [] }) as ExamSnapshot;
    const marksCorrect = Number(exam.marks_correct);
    const marksWrong = Number(exam.marks_wrong);
    const marksSkip = Number(exam.marks_skip);

    const gradeInputs: AnswerInput[] = snapshot.questions.map((q) => {
      const ans = answerByQ.get(q.id);
      return {
        question_id: q.id,
        selected_option_id: ans?.selected_option_id ?? null,
        correct_option_id: q.correct_option_id,
        regrade_override: q.regrade_override ?? null,
      };
    });
    const graded = gradeAttempt(gradeInputs, {
      marks_correct: marksCorrect,
      marks_wrong: marksWrong,
      marks_skip: marksSkip,
    });

    const submittedAt = new Date();
    const startsAt = new Date(exam.starts_at);
    const auto_submitted = isAutoSubmittedAt(
      submittedAt,
      startsAt,
      exam.duration_min,
    );

    const { data: updated, error: updErr } = await admin
      .from("exam_attempts")
      .update({
        submitted_at: submittedAt.toISOString(),
        auto_submitted,
        score: graded.score,
        max_score: graded.max_score,
        correct_count: graded.correct_count,
        wrong_count: graded.wrong_count,
        skipped_count: graded.skipped_count,
      })
      .eq("id", attempt_id)
      .is("submitted_at", null) // double-submit guard
      .select(
        "id, submitted_at, auto_submitted, score, max_score, correct_count, wrong_count, skipped_count",
      )
      .maybeSingle();
    if (updErr) {
      return jsonError(500, "attempt update failed", origin, updErr.message);
    }
    if (!updated) {
      return jsonError(409, "attempt already submitted", origin);
    }

    // activity_days for streak feeder (D-014 IST).
    const { error: actErr } = await admin
      .from("activity_days")
      .upsert(
        { student_id: caller.app_user_id, day: todayIstDateString(submittedAt) },
        { onConflict: "student_id,day", ignoreDuplicates: true },
      );
    if (actErr) {
      console.error("activity_days upsert failed:", actErr.message);
    }

    await writeAudit(admin, {
      actor_user_id: caller.app_user_id,
      actor_role: "student",
      action: "exam_submitted",
      entity_table: "exam_attempts",
      entity_id: attempt_id,
      after_data: {
        exam_id: exam.id,
        score: graded.score,
        max_score: graded.max_score,
        correct_count: graded.correct_count,
        wrong_count: graded.wrong_count,
        skipped_count: graded.skipped_count,
        auto_submitted,
        tab_switch_count: attempt.tab_switch_count ?? 0,
      },
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent"),
    });

    // Phase 8: recompute mastery for the topics this exam touched (D-070
    // rolling-N). Best-effort — a failure here must never break the submit.
    try {
      const topicIds = Array.from(
        new Set(
          snapshot.questions
            .map((q) => q.topic_id)
            .filter((t): t is string => !!t),
        ),
      );
      if (topicIds.length > 0) {
        const { error: masteryErr } = await admin.rpc("mastery_recompute", {
          p_student: caller.app_user_id,
          p_topic_ids: topicIds,
        });
        if (masteryErr) {
          console.error("mastery_recompute failed:", masteryErr.message);
        }
      }
    } catch (e) {
      console.error("mastery_recompute threw:", e);
    }

    // Phase 10 (D-188): re-evaluate mastery-driven badges after this exam.
    // Best-effort + idempotent — a failure here must never block or fail the submit.
    try {
      const { error: badgeErr } = await admin.rpc("evaluate_student_badges", {
        p_student: caller.app_user_id,
        p_triggers: ["exam_submit"],
      });
      if (badgeErr) console.error("badge eval failed:", badgeErr.message);
    } catch (e) {
      console.error("badge eval threw:", e);
    }

    // Decide what to reveal to the student now.
    const releaseGate =
      exam.result_release === "instant" || exam.results_released_at !== null;
    if (!releaseGate) {
      return json(
        200,
        {
          attempt_id,
          status: "submitted",
          submitted_at: updated.submitted_at,
          auto_submitted: updated.auto_submitted,
          tab_switch_count: attempt.tab_switch_count ?? 0,
          results_released: false,
        },
        origin,
      );
    }

    // Release-now path — return the lightweight scoreboard. The per-question
    // solution payload is fetched on demand via `exam-attempt-result` so the
    // submit response stays small.
    return json(
      200,
      {
        attempt_id,
        status: "submitted",
        submitted_at: updated.submitted_at,
        auto_submitted: updated.auto_submitted,
        tab_switch_count: attempt.tab_switch_count ?? 0,
        results_released: true,
        score: Number(updated.score),
        max_score: Number(updated.max_score),
        correct_count: updated.correct_count,
        wrong_count: updated.wrong_count,
        skipped_count: updated.skipped_count,
      },
      origin,
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("exam-submit error:", err);
    return jsonError(500, "internal error", origin);
  }
});
