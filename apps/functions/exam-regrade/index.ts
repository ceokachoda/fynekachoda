// Phase 7 CP8 — `exam-regrade` edge fn.
//
// Caller: teacher who owns the exam (or assigned to its batch) OR admin.
// Input: `{ exam_id, question_id, action, new_correct_option_id?, reason }`.
//
// Spec §5.8 + §7. Three actions:
//   - change_correct       — flip is_correct to the new option, others false.
//                            Snapshot's correct_option_id is updated to the
//                            new key for this attempt; regrade_override
//                            cleared.
//   - mark_no_correct      — clear all is_correct; snapshot.regrade_override
//                            for this question = "none" (skipped, marks_skip).
//   - mark_all_correct     — set is_correct on every option; snapshot.regrade_override
//                            = "all" (correct, marks_correct).
//
// Each call does a FULL per-attempt recompute from snapshot + answers +
// the new override — no incremental delta math (which was prone to drift
// across stacked regrades).
//
// Audit captures before_data = previous correct option + previous override
// + per-attempt (id, score, max_score) and after_data = new key + counts.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import {
  adminRoleFor,
  AuthError,
  loadCaller,
} from "../_shared/auth.ts";
import { ExamRegradeInputSchema } from "../_shared/schemas.ts";
import { clientIp, writeAudit } from "../_shared/audit.ts";
import {
  type AnswerInput,
  type ExamSnapshot,
  gradeAttempt,
} from "../_shared/exam-marking.ts";

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
    const parsed = ExamRegradeInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const { exam_id, question_id, action, new_correct_option_id, reason } =
      parsed.data;

    const admin = getServiceRoleClient();

    const { data: exam, error: eErr } = await admin
      .from("exams")
      .select(
        "id, title, batch_id, marks_correct, marks_wrong, marks_skip, created_by",
      )
      .eq("id", exam_id)
      .maybeSingle();
    if (eErr) {
      return jsonError(500, "exam lookup failed", origin, eErr.message);
    }
    if (!exam) return jsonError(404, "exam not found", origin);

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

    const { data: eqRow, error: eqErr } = await admin
      .from("exam_questions")
      .select("exam_id, question_id")
      .eq("exam_id", exam_id)
      .eq("question_id", question_id)
      .maybeSingle();
    if (eqErr) {
      return jsonError(500, "exam_questions lookup failed", origin, eqErr.message);
    }
    if (!eqRow) return jsonError(404, "question not in this exam", origin);

    const { data: optsBefore, error: oErr } = await admin
      .from("question_options")
      .select("id, question_id, text_md, is_correct, sort_order")
      .eq("question_id", question_id)
      .order("sort_order", { ascending: true });
    if (oErr) {
      return jsonError(500, "options lookup failed", origin, oErr.message);
    }
    if (!optsBefore || optsBefore.length === 0) {
      return jsonError(409, "question has no options", origin);
    }
    if (
      action === "change_correct" &&
      new_correct_option_id &&
      !optsBefore.find((o) => o.id === new_correct_option_id)
    ) {
      return jsonError(400, "new_correct_option_id not in this question", origin);
    }

    const prevCorrect = optsBefore.find((o) => o.is_correct)?.id ?? null;

    // ---- Mutate the bank ----
    if (action === "change_correct" && new_correct_option_id) {
      const { error: clrErr } = await admin
        .from("question_options")
        .update({ is_correct: false })
        .eq("question_id", question_id);
      if (clrErr) {
        return jsonError(500, "clear is_correct failed", origin, clrErr.message);
      }
      const { error: setErr } = await admin
        .from("question_options")
        .update({ is_correct: true })
        .eq("id", new_correct_option_id);
      if (setErr) {
        return jsonError(500, "set is_correct failed", origin, setErr.message);
      }
    } else if (action === "mark_no_correct") {
      const { error: clrErr } = await admin
        .from("question_options")
        .update({ is_correct: false })
        .eq("question_id", question_id);
      if (clrErr) {
        return jsonError(500, "clear is_correct failed", origin, clrErr.message);
      }
    } else if (action === "mark_all_correct") {
      const { error: allErr } = await admin
        .from("question_options")
        .update({ is_correct: true })
        .eq("question_id", question_id);
      if (allErr) {
        return jsonError(500, "set all is_correct failed", origin, allErr.message);
      }
    }

    const { data: optsAfter } = await admin
      .from("question_options")
      .select("id, is_correct")
      .eq("question_id", question_id);
    const liveCorrectId = (optsAfter ?? []).find((o) => o.is_correct)?.id ?? null;

    // ---- Recompute every SUBMITTED attempt of this exam ----
    const { data: attempts, error: aErr } = await admin
      .from("exam_attempts")
      .select(
        "id, exam_id, student_id, score, max_score, correct_count, wrong_count, skipped_count, question_snapshot",
      )
      .eq("exam_id", exam_id)
      .not("submitted_at", "is", null);
    if (aErr) {
      return jsonError(500, "attempts lookup failed", origin, aErr.message);
    }

    const marks = {
      marks_correct: Number(exam.marks_correct),
      marks_wrong: Number(exam.marks_wrong),
      marks_skip: Number(exam.marks_skip),
    };

    // Per-attempt answer rows (all questions).
    const attemptIds = (attempts ?? []).map((a) => a.id);
    const { data: ansRows } = await admin
      .from("exam_answers")
      .select("attempt_id, question_id, selected_option_id")
      .in("attempt_id", attemptIds.length > 0 ? attemptIds : ["00000000-0000-0000-0000-000000000000"]);
    const ansByAttempt = new Map<string, Map<string, string | null>>();
    for (const a of ansRows ?? []) {
      const m = ansByAttempt.get(a.attempt_id) ?? new Map<string, string | null>();
      m.set(a.question_id, a.selected_option_id);
      ansByAttempt.set(a.attempt_id, m);
    }

    interface AttemptBefore {
      id: string;
      score: number;
      max_score: number;
      correct: number;
      wrong: number;
      skipped: number;
    }
    interface AttemptAfter extends AttemptBefore {
      delta: number;
    }
    const before_attempts: AttemptBefore[] = [];
    const after_attempts: AttemptAfter[] = [];

    for (const a of attempts ?? []) {
      const oldScore = Number(a.score ?? 0);
      const oldMax = Number(a.max_score ?? 0);
      const oldCorrect = a.correct_count ?? 0;
      const oldWrong = a.wrong_count ?? 0;
      const oldSkipped = a.skipped_count ?? 0;

      const snap = (a.question_snapshot ?? { questions: [] }) as ExamSnapshot;
      const ansMap = ansByAttempt.get(a.id) ?? new Map<string, string | null>();

      // Project new snapshot for the target question.
      const newSnap: ExamSnapshot = {
        questions: snap.questions.map((q) => {
          if (q.id !== question_id) return q;
          if (action === "change_correct") {
            return {
              ...q,
              correct_option_id: liveCorrectId,
              regrade_override: null,
            };
          }
          if (action === "mark_no_correct") {
            return {
              ...q,
              correct_option_id: null,
              regrade_override: "none" as const,
            };
          }
          // mark_all_correct
          return {
            ...q,
            regrade_override: "all" as const,
          };
        }),
      };

      // Re-grade ALL questions from snapshot + answer map. Overrides handled
      // inside gradeAnswer.
      const inputs: AnswerInput[] = newSnap.questions.map((q) => ({
        question_id: q.id,
        selected_option_id: ansMap.get(q.id) ?? null,
        correct_option_id: q.correct_option_id,
        regrade_override: q.regrade_override ?? null,
      }));
      const graded = gradeAttempt(inputs, marks);

      before_attempts.push({
        id: a.id,
        score: oldScore,
        max_score: oldMax,
        correct: oldCorrect,
        wrong: oldWrong,
        skipped: oldSkipped,
      });

      const { error: uErr } = await admin
        .from("exam_attempts")
        .update({
          score: graded.score,
          max_score: graded.max_score,
          correct_count: graded.correct_count,
          wrong_count: graded.wrong_count,
          skipped_count: graded.skipped_count,
          question_snapshot: newSnap,
        })
        .eq("id", a.id);
      if (uErr) {
        console.error(
          `regrade per-attempt update failed for ${a.id}:`,
          uErr.message,
        );
        continue;
      }

      after_attempts.push({
        id: a.id,
        score: graded.score,
        max_score: graded.max_score,
        correct: graded.correct_count,
        wrong: graded.wrong_count,
        skipped: graded.skipped_count,
        delta: graded.score - oldScore,
      });
    }

    await writeAudit(admin, {
      actor_user_id: caller.app_user_id,
      actor_role: callerIsAdmin ? adminRoleFor(caller) : "teacher",
      action: "exam_regrade",
      entity_table: "exams",
      entity_id: exam_id,
      before_data: {
        question_id,
        prev_correct_option_id: prevCorrect,
        options: optsBefore,
        attempts: before_attempts,
        action,
        reason,
      },
      after_data: {
        question_id,
        new_correct_option_id: liveCorrectId,
        action,
        attempts_updated: after_attempts.length,
        attempts: after_attempts,
      },
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent"),
    });

    return json(
      200,
      {
        exam_id,
        question_id,
        action,
        new_correct_option_id: liveCorrectId,
        attempts_updated: after_attempts.length,
        delta_summary: after_attempts.map((a) => ({ id: a.id, delta: a.delta })),
      },
      origin,
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("exam-regrade error:", err);
    return jsonError(500, "internal error", origin);
  }
});
