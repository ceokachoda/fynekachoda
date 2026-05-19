// Phase 7 CP9b — `exam-attempt-result` edge fn (mirrors quiz D-175).
//
// Caller: student (own attempt) OR teacher (own exam OR student's batch)
// OR admin. Input: `{ attempt_id }`.
//
// Re-fetches a SUBMITTED attempt's result + per-question solution payload.
// Solves "the student navigated away and wants to re-open the solution
// screen" — signed image URLs are short-lived, so this signs fresh every
// call.
//
// Crucially, for STUDENTS we ALSO gate on `exam.results_released_at IS NOT NULL`
// (unless `result_release='instant'`). A student who has submitted but
// before the teacher releases gets a 423 LOCKED with the "Submitted —
// results will be released by your teacher." UX hint.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import { AuthError, loadCaller } from "../_shared/auth.ts";
import { ExamAttemptResultInputSchema } from "../_shared/schemas.ts";
import { type ExamSnapshot } from "../_shared/exam-marking.ts";

const EXAM_IMAGES_BUCKET = "exam-images";
const IMAGE_TTL_SECONDS = 60 * 60 * 6;

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

    const rawBody = await req.json().catch(() => null);
    if (rawBody === null) return jsonError(400, "invalid JSON body", origin);
    const parsed = ExamAttemptResultInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const { attempt_id } = parsed.data;

    const admin = getServiceRoleClient();

    const { data: attempt, error: attErr } = await admin
      .from("exam_attempts")
      .select(
        "id, exam_id, student_id, started_at, submitted_at, auto_submitted, tab_switch_count, score, max_score, correct_count, wrong_count, skipped_count, question_snapshot",
      )
      .eq("id", attempt_id)
      .maybeSingle();
    if (attErr) {
      return jsonError(500, "attempt lookup failed", origin, attErr.message);
    }
    if (!attempt) return jsonError(404, "attempt not found", origin);
    if (attempt.submitted_at === null) {
      return jsonError(409, "attempt not submitted yet", origin);
    }

    const callerIsAdmin = isAdmin(caller.roles);
    const callerIsTeacher = caller.roles.includes("teacher");
    const callerIsOwner = attempt.student_id === caller.app_user_id;

    const { data: exam, error: eErr } = await admin
      .from("exams")
      .select(
        "id, title, batch_id, marks_correct, marks_wrong, marks_skip, duration_min, result_release, results_released_at, created_by",
      )
      .eq("id", attempt.exam_id)
      .maybeSingle();
    if (eErr) return jsonError(500, "exam lookup failed", origin, eErr.message);
    if (!exam) return jsonError(404, "exam not found", origin);

    // Authorisation + release gate.
    if (!callerIsAdmin && !callerIsOwner) {
      if (!callerIsTeacher) {
        return jsonError(403, "not authorised", origin);
      }
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
      if (!ok) return jsonError(403, "not authorised", origin);
    } else if (callerIsOwner && !callerIsAdmin) {
      // Student release gate.
      const released =
        exam.result_release === "instant" ||
        exam.results_released_at !== null;
      if (!released) {
        return jsonError(423, "results not released yet", origin, {
          status: "submitted_awaiting_release",
          submitted_at: attempt.submitted_at,
          tab_switch_count: attempt.tab_switch_count,
        });
      }
    }

    const snapshot = (attempt.question_snapshot ?? { questions: [] }) as ExamSnapshot;
    const questionIds = snapshot.questions.map((q) => q.id);

    // Load student's saved answers for outcome mapping.
    const { data: answers } = await admin
      .from("exam_answers")
      .select("question_id, selected_option_id, is_flagged")
      .eq("attempt_id", attempt_id);
    const answerByQ = new Map<
      string,
      { selected_option_id: string | null; is_flagged: boolean }
    >();
    for (const a of answers ?? []) {
      answerByQ.set(a.question_id, {
        selected_option_id: a.selected_option_id,
        is_flagged: !!a.is_flagged,
      });
    }

    // Solutions (post-release).
    const { data: solRows } = await admin
      .from("question_solutions")
      .select("question_id, explanation_md, related_content_id")
      .in("question_id", questionIds.length > 0 ? questionIds : ["00000000-0000-0000-0000-000000000000"]);
    const solByQ = new Map<
      string,
      { explanation_md: string; related_content_id: string | null }
    >();
    for (const s of solRows ?? []) {
      solByQ.set(s.question_id, {
        explanation_md: s.explanation_md,
        related_content_id: s.related_content_id,
      });
    }
    const relatedIds = new Set<string>();
    for (const s of solByQ.values()) {
      if (s.related_content_id) relatedIds.add(s.related_content_id);
    }
    const contentMap = new Map<
      string,
      { id: string; title: string; kind: string }
    >();
    if (relatedIds.size > 0) {
      const { data: contents } = await admin
        .from("content_items")
        .select("id, title, kind")
        .in("id", Array.from(relatedIds));
      for (const c of contents ?? []) {
        contentMap.set(c.id, { id: c.id, title: c.title, kind: c.kind });
      }
    }

    // Sign every image referenced by the snapshot.
    const imagePaths = new Set<string>();
    for (const q of snapshot.questions) {
      if (q.prompt_image_path) imagePaths.add(q.prompt_image_path);
      for (const o of q.options) {
        if (o.image_path) imagePaths.add(o.image_path);
      }
    }
    const signedMap: Record<string, string> = {};
    if (imagePaths.size > 0) {
      const paths = Array.from(imagePaths);
      const { data: signed, error: signErr } = await admin.storage
        .from(EXAM_IMAGES_BUCKET)
        .createSignedUrls(paths, IMAGE_TTL_SECONDS);
      if (signErr) {
        console.error("image sign failed:", signErr.message);
      } else {
        for (const s of signed ?? []) {
          if (s.path && s.signedUrl) signedMap[s.path] = s.signedUrl;
        }
      }
    }

    const marksCorrect = Number(exam.marks_correct);
    const marksWrong = Number(exam.marks_wrong);
    const marksSkip = Number(exam.marks_skip);

    const solutionQuestions = snapshot.questions.map((q) => {
      const ans = answerByQ.get(q.id);
      const sel = ans?.selected_option_id ?? null;
      const correctId = q.correct_option_id;
      let outcome: "correct" | "wrong" | "skipped";
      let points: number;
      if (q.regrade_override === "none") {
        outcome = "skipped";
        points = marksSkip;
      } else if (q.regrade_override === "all") {
        outcome = "correct";
        points = marksCorrect;
      } else if (sel === null) {
        outcome = "skipped";
        points = marksSkip;
      } else if (correctId && sel === correctId) {
        outcome = "correct";
        points = marksCorrect;
      } else {
        outcome = "wrong";
        points = marksWrong;
      }
      const sol = solByQ.get(q.id);
      const rc = sol?.related_content_id
        ? contentMap.get(sol.related_content_id) ?? null
        : null;
      return {
        id: q.id,
        prompt_md: q.prompt_md,
        prompt_image_url: q.prompt_image_path
          ? signedMap[q.prompt_image_path] ?? null
          : null,
        difficulty: q.difficulty,
        topic_id: q.topic_id,
        options: q.options.map((o) => ({
          id: o.id,
          text_md: o.text_md,
          image_url: o.image_path ? signedMap[o.image_path] ?? null : null,
          is_correct: o.id === correctId,
        })),
        explanation_md: sol?.explanation_md ?? null,
        related_content: rc,
        your_option_id: sel,
        correct_option_id: correctId,
        outcome,
        points,
        is_flagged: ans?.is_flagged ?? false,
      };
    });

    return json(
      200,
      {
        attempt_id,
        status: "submitted",
        exam: {
          id: exam.id,
          title: exam.title,
          marks_correct: marksCorrect,
          marks_wrong: marksWrong,
          marks_skip: marksSkip,
          duration_min: exam.duration_min,
          result_release: exam.result_release,
          results_released_at: exam.results_released_at,
        },
        score: Number(attempt.score),
        max_score: Number(attempt.max_score),
        correct_count: attempt.correct_count,
        wrong_count: attempt.wrong_count,
        skipped_count: attempt.skipped_count,
        started_at: attempt.started_at,
        submitted_at: attempt.submitted_at,
        auto_submitted: !!attempt.auto_submitted,
        tab_switch_count: attempt.tab_switch_count,
        questions: solutionQuestions,
      },
      origin,
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("exam-attempt-result error:", err);
    return jsonError(500, "internal error", origin);
  }
});
