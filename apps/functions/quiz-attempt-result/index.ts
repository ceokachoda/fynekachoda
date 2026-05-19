// Phase 6 CP5b — `quiz-attempt-result` edge fn.
//
// Caller: student (own attempt) OR teacher who can see the attempt OR admin.
// Input:  `{ attempt_id }`.
//
// Re-fetches a SUBMITTED attempt's result + per-question solution payload
// (mirrors the post-submit response from `quiz-submit`). Solves "the student
// navigated away and wants to re-open the solution screen" — signed image
// URLs are short-lived, so a fresh sign happens here every call.
//
// Read-only — no audit, no DB mutation. Replay-safe.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import { AuthError, loadCaller } from "../_shared/auth.ts";
import { QuizAttemptResultInputSchema } from "../_shared/schemas.ts";

const EXAM_IMAGES_BUCKET = "exam-images";
const IMAGE_TTL_SECONDS = 60 * 60 * 4;

interface OptionFullRow {
  id: string;
  question_id: string;
  text_md: string;
  image_path: string | null;
  is_correct: boolean;
  sort_order: number;
}

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
    const parsed = QuizAttemptResultInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const { attempt_id } = parsed.data;

    const admin = getServiceRoleClient();

    const { data: attempt, error: attErr } = await admin
      .from("quiz_attempts")
      .select(
        "id, quiz_id, student_id, started_at, submitted_at, score, max_score, correct_count, wrong_count, skipped_count, is_auto_submit, metadata",
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

    // Authorisation.
    const callerIsAdmin = isAdmin(caller.roles);
    const callerIsTeacher = caller.roles.includes("teacher");
    const callerIsOwner = attempt.student_id === caller.app_user_id;

    if (!callerIsAdmin && !callerIsOwner) {
      if (!callerIsTeacher) {
        return jsonError(403, "not authorised", origin);
      }
      // Teacher: must own the quiz OR teach the student's batch.
      const { data: q, error: qE } = await admin
        .from("quizzes")
        .select("id, created_by")
        .eq("id", attempt.quiz_id)
        .maybeSingle();
      if (qE) {
        return jsonError(500, "quiz lookup failed", origin, qE.message);
      }
      if (!q) return jsonError(404, "quiz not found", origin);
      let ok = q.created_by === caller.app_user_id;
      if (!ok) {
        const { data: s } = await admin
          .from("students")
          .select("user_id, batch_id")
          .eq("user_id", attempt.student_id)
          .maybeSingle();
        if (s) {
          const { data: bt } = await admin
            .from("batch_teachers")
            .select("batch_id, teacher_id")
            .eq("batch_id", s.batch_id)
            .eq("teacher_id", caller.app_user_id)
            .maybeSingle();
          ok = !!bt;
        }
      }
      if (!ok) return jsonError(403, "not authorised", origin);
    }

    const { data: quiz } = await admin
      .from("quizzes")
      .select("id, title, marks_correct, marks_wrong, marks_skip, duration_min")
      .eq("id", attempt.quiz_id)
      .maybeSingle();
    if (!quiz) return jsonError(404, "quiz not found", origin);

    const { data: qqRows, error: qqErr } = await admin
      .from("quiz_questions")
      .select(
        "question_id, sort_order, questions!inner(id, prompt_md, prompt_image_path, difficulty, topic_id, is_archived)",
      )
      .eq("quiz_id", quiz.id)
      .order("sort_order", { ascending: true });
    if (qqErr) {
      return jsonError(500, "quiz_questions lookup failed", origin, qqErr.message);
    }
    // deno-lint-ignore no-explicit-any
    const questions = (qqRows ?? []).map((r: any) => r.questions).filter(Boolean);
    const questionIds: string[] = questions.map((q: { id: string }) => q.id);
    // deno-lint-ignore no-explicit-any
    const qById = new Map<string, any>();
    for (const q of questions) qById.set(q.id, q);

    if (questionIds.length === 0) {
      return jsonError(409, "quiz has no questions", origin);
    }

    const { data: optsAll, error: oErr } = await admin
      .from("question_options")
      .select("id, question_id, text_md, image_path, is_correct, sort_order")
      .in("question_id", questionIds);
    if (oErr) {
      return jsonError(500, "options lookup failed", origin, oErr.message);
    }
    const optionsByQ = new Map<string, OptionFullRow[]>();
    for (const o of (optsAll ?? []) as OptionFullRow[]) {
      const list = optionsByQ.get(o.question_id) ?? [];
      list.push(o);
      optionsByQ.set(o.question_id, list);
    }

    const { data: answers, error: ansErr } = await admin
      .from("quiz_answers")
      .select("question_id, selected_option_id, is_flagged, answered_at")
      .eq("attempt_id", attempt_id);
    if (ansErr) {
      return jsonError(500, "answers lookup failed", origin, ansErr.message);
    }
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

    const { data: solRows } = await admin
      .from("question_solutions")
      .select("question_id, explanation_md, related_content_id")
      .in("question_id", questionIds);
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

    // Sign images.
    const imagePaths = new Set<string>();
    for (const q of questions) {
      // deno-lint-ignore no-explicit-any
      const p = (q as any).prompt_image_path as string | null;
      if (p) imagePaths.add(p);
    }
    for (const o of (optsAll ?? []) as OptionFullRow[]) {
      if (o.image_path) imagePaths.add(o.image_path);
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

    // Snapshot-aware ordering.
    // deno-lint-ignore no-explicit-any
    const meta = (attempt.metadata ?? {}) as any;
    const snapshotOrder = Array.isArray(meta.question_order)
      ? (meta.question_order as string[]).filter((id) => questionIds.includes(id))
      : [];
    const displayOrder: string[] = [...snapshotOrder];
    for (const qid of questionIds) {
      if (!displayOrder.includes(qid)) displayOrder.push(qid);
    }

    const solutionQuestions = displayOrder.map((qid) => {
      const q = qById.get(qid);
      const opts = optionsByQ.get(qid) ?? [];
      const optOrderSnap = meta.option_order?.[qid];
      const optionIds: string[] = Array.isArray(optOrderSnap)
        ? (optOrderSnap as string[]).filter((oid) =>
          opts.some((o) => o.id === oid)
        )
        : opts.sort((a, b) => a.sort_order - b.sort_order).map((o) => o.id);
      for (const o of opts) {
        if (!optionIds.includes(o.id)) optionIds.push(o.id);
      }
      const orderedOpts = optionIds
        .map((oid) => opts.find((o) => o.id === oid))
        .filter((o): o is OptionFullRow => Boolean(o))
        .map((o) => ({
          id: o.id,
          text_md: o.text_md,
          image_url: o.image_path ? signedMap[o.image_path] ?? null : null,
          is_correct: o.is_correct,
        }));
      const correctOpt = opts.find((o) => o.is_correct);
      const ans = answerByQ.get(qid);
      const sel = ans?.selected_option_id ?? null;
      const outcome: "correct" | "wrong" | "skipped" = sel === null
        ? "skipped"
        : correctOpt && sel === correctOpt.id
        ? "correct"
        : "wrong";
      const points = outcome === "correct"
        ? Number(quiz.marks_correct)
        : outcome === "wrong"
        ? Number(quiz.marks_wrong)
        : Number(quiz.marks_skip);
      const sol = solByQ.get(qid);
      const rc = sol?.related_content_id
        ? contentMap.get(sol.related_content_id) ?? null
        : null;
      return {
        id: qid,
        prompt_md: q?.prompt_md ?? "",
        prompt_image_url: q?.prompt_image_path
          ? signedMap[q.prompt_image_path] ?? null
          : null,
        difficulty: q?.difficulty ?? null,
        topic_id: q?.topic_id ?? null,
        options: orderedOpts,
        explanation_md: sol?.explanation_md ?? null,
        related_content: rc,
        your_option_id: sel,
        correct_option_id: correctOpt?.id ?? null,
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
        quiz: {
          id: quiz.id,
          title: quiz.title,
          marks_correct: Number(quiz.marks_correct),
          marks_wrong: Number(quiz.marks_wrong),
          marks_skip: Number(quiz.marks_skip),
          duration_min: quiz.duration_min,
        },
        score: Number(attempt.score),
        max_score: Number(attempt.max_score),
        correct_count: attempt.correct_count,
        wrong_count: attempt.wrong_count,
        skipped_count: attempt.skipped_count,
        started_at: attempt.started_at,
        submitted_at: attempt.submitted_at,
        is_auto_submit: !!attempt.is_auto_submit,
        questions: solutionQuestions,
      },
      origin,
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("quiz-attempt-result error:", err);
    return jsonError(500, "internal error", origin);
  }
});
