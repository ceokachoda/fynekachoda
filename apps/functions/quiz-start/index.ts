// Phase 6 CP4 — `quiz-start` edge fn.
//
// Caller: authenticated student. Input: `{ quiz_id }`.
//
// Responsibilities (spec §5.4 + §6.1):
//   1. Verify caller is a student in the quiz's course/batch scope.
//   2. Idempotently return an in-flight attempt OR create a new one.
//   3. Snapshot the per-attempt question + option order in
//      `quiz_attempts.metadata` so app-kill / refresh resumes in place.
//   4. Build a SANITISED payload — questions + options stripped of
//      `is_correct`. Server is the only source of truth for grading.
//   5. Sign image URLs for any prompt/option images stored in `exam-images`.
//
// Security:
//   - `is_correct` is never selected into the response object. Even the
//     server-side join is column-scoped to avoid accidental leak.
//   - Storage objects in `exam-images` are private (CP7); edge fn signs via
//     service role per D-171.
//   - Caller must be `student` role AND `is_active`; loadCaller enforces.
//
// Decisions in play:
//   - D-050/D-051 practice quiz semantics: in-flight retake = reuse attempt.
//   - D-054 randomisation defaults on; per-attempt snapshot.
//   - D-014 IST for any future date emission (none here).
//   - D-171 storage signed URLs via service role.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import { AuthError, loadCaller, requireAnyRole } from "../_shared/auth.ts";
import { QuizStartInputSchema } from "../_shared/schemas.ts";

const EXAM_IMAGES_BUCKET = "exam-images";
// 4h covers the longest allowed duration (240m) + post-submit solution view.
const IMAGE_URL_TTL_SECONDS = 60 * 60 * 4;

function shuffle<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    // Math.random is fine for randomisation here — no security impact.
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

interface OptionRow {
  id: string;
  question_id: string;
  text_md: string;
  image_path: string | null;
  is_correct: boolean;
  sort_order: number;
}

interface QuestionRow {
  id: string;
  prompt_md: string;
  prompt_image_path: string | null;
  difficulty: string | null;
  topic_id: string;
  is_archived: boolean;
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
    const parsed = QuizStartInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const { quiz_id } = parsed.data;

    const admin = getServiceRoleClient();

    // Resolve student's batch + course (needed for scope check).
    const { data: stuRow, error: stuErr } = await admin
      .from("students")
      .select("user_id, batch_id, batches!inner(id, course_id)")
      .eq("user_id", caller.app_user_id)
      .maybeSingle();
    if (stuErr) {
      return jsonError(500, "student lookup failed", origin, stuErr.message);
    }
    if (!stuRow) return jsonError(403, "no student profile", origin);
    // deno-lint-ignore no-explicit-any
    const studentCourseId = (stuRow as any).batches?.course_id as string;
    const studentBatchId = stuRow.batch_id as string;

    // Quiz + scope check.
    const { data: quiz, error: qErr } = await admin
      .from("quizzes")
      .select(
        "id, title, course_id, batch_id, topic_id, chapter_id, is_published, duration_min, marks_correct, marks_wrong, marks_skip, randomize_questions, randomize_options",
      )
      .eq("id", quiz_id)
      .maybeSingle();
    if (qErr) {
      return jsonError(500, "quiz lookup failed", origin, qErr.message);
    }
    if (!quiz) return jsonError(404, "quiz not found", origin);
    if (!quiz.is_published) {
      return jsonError(403, "quiz not published", origin);
    }
    if (quiz.course_id !== studentCourseId) {
      return jsonError(403, "quiz not in your course", origin);
    }
    if (quiz.batch_id !== null && quiz.batch_id !== studentBatchId) {
      return jsonError(403, "quiz not in your batch", origin);
    }

    // Pull questions in their canonical order; we discard archived rows here
    // so an admin archiving mid-quiz cleanly removes them from new attempts.
    const { data: qqRows, error: qqErr } = await admin
      .from("quiz_questions")
      .select(
        "quiz_id, question_id, sort_order, questions!inner(id, prompt_md, prompt_image_path, difficulty, topic_id, is_archived)",
      )
      .eq("quiz_id", quiz_id)
      .order("sort_order", { ascending: true });
    if (qqErr) {
      return jsonError(500, "quiz_questions lookup failed", origin, qqErr.message);
    }
    // deno-lint-ignore no-explicit-any
    const activeQuestions: QuestionRow[] = (qqRows ?? [])
      // deno-lint-ignore no-explicit-any
      .map((r: any) => r.questions as QuestionRow)
      .filter((q) => q && !q.is_archived);
    if (activeQuestions.length === 0) {
      return jsonError(409, "quiz has no questions", origin);
    }
    const questionIds = activeQuestions.map((q) => q.id);

    // NOTE: deliberately selects `is_correct` only so the marker is locally
    // stripped before responding. The column is needed later for the
    // `option_order` snapshot to remain stable across resume.
    const { data: optsAll, error: oErr } = await admin
      .from("question_options")
      .select("id, question_id, text_md, image_path, is_correct, sort_order")
      .in("question_id", questionIds)
      .order("sort_order", { ascending: true });
    if (oErr) {
      return jsonError(500, "options lookup failed", origin, oErr.message);
    }
    const optionsByQuestion = new Map<string, OptionRow[]>();
    for (const o of (optsAll ?? []) as OptionRow[]) {
      const list = optionsByQuestion.get(o.question_id) ?? [];
      list.push(o);
      optionsByQuestion.set(o.question_id, list);
    }

    // Idempotency: an in-flight attempt for (student, quiz) is reused, NOT
    // re-created. The active-index makes this O(1).
    const { data: inflight, error: inflightErr } = await admin
      .from("quiz_attempts")
      .select(
        "id, quiz_id, student_id, started_at, submitted_at, metadata",
      )
      .eq("quiz_id", quiz_id)
      .eq("student_id", caller.app_user_id)
      .is("submitted_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (inflightErr) {
      return jsonError(
        500,
        "in-flight attempt lookup failed",
        origin,
        inflightErr.message,
      );
    }

    let attemptId: string;
    let startedAt: string;
    let questionOrder: string[];
    let optionOrder: Record<string, string[]>;

    if (inflight) {
      attemptId = inflight.id;
      startedAt = inflight.started_at;
      // deno-lint-ignore no-explicit-any
      const meta = (inflight.metadata ?? {}) as any;
      questionOrder = Array.isArray(meta.question_order)
        ? meta.question_order.filter((qid: unknown) =>
          typeof qid === "string" && questionIds.includes(qid)
        )
        : [];
      optionOrder = (meta.option_order && typeof meta.option_order === "object")
        ? (meta.option_order as Record<string, string[]>)
        : {};
      // Backfill any newly-added (or previously missing) entries.
      const ids = new Set(questionOrder);
      for (const qid of questionIds) {
        if (!ids.has(qid)) {
          questionOrder.push(qid);
        }
      }
      for (const qid of questionOrder) {
        const knownIds = (optionsByQuestion.get(qid) ?? []).map((o) => o.id);
        if (!optionOrder[qid] || !Array.isArray(optionOrder[qid])) {
          optionOrder[qid] = knownIds;
        } else {
          // Drop ids that no longer belong (option deleted) and append new ones.
          const known = new Set(knownIds);
          const kept = optionOrder[qid].filter((oid) => known.has(oid));
          for (const oid of knownIds) {
            if (!kept.includes(oid)) kept.push(oid);
          }
          optionOrder[qid] = kept;
        }
      }
    } else {
      const orderedQuestionIds = quiz.randomize_questions
        ? shuffle(questionIds)
        : questionIds;
      questionOrder = orderedQuestionIds;
      optionOrder = {};
      for (const qid of orderedQuestionIds) {
        const opts = optionsByQuestion.get(qid) ?? [];
        const ids = quiz.randomize_options
          ? shuffle(opts.map((o) => o.id))
          : opts.map((o) => o.id);
        optionOrder[qid] = ids;
      }
      const { data: created, error: insErr } = await admin
        .from("quiz_attempts")
        .insert({
          quiz_id,
          student_id: caller.app_user_id,
          is_practice: true,
          metadata: {
            question_order: questionOrder,
            option_order: optionOrder,
          },
        })
        .select("id, started_at, metadata")
        .single();
      if (insErr) {
        return jsonError(500, "attempt insert failed", origin, insErr.message);
      }
      attemptId = created.id;
      startedAt = created.started_at;
    }

    // Load any auto-saved answers for resume.
    const { data: savedAnswers, error: ansErr } = await admin
      .from("quiz_answers")
      .select("question_id, selected_option_id, is_flagged, answered_at")
      .eq("attempt_id", attemptId);
    if (ansErr) {
      return jsonError(
        500,
        "saved answers lookup failed",
        origin,
        ansErr.message,
      );
    }

    // Collect every storage path that needs signing.
    const imagePaths = new Set<string>();
    for (const q of activeQuestions) {
      if (q.prompt_image_path) imagePaths.add(q.prompt_image_path);
    }
    for (const o of (optsAll ?? []) as OptionRow[]) {
      if (o.image_path) imagePaths.add(o.image_path);
    }
    const signedMap: Record<string, string> = {};
    if (imagePaths.size > 0) {
      const paths = Array.from(imagePaths);
      const { data: signed, error: signErr } = await admin.storage
        .from(EXAM_IMAGES_BUCKET)
        .createSignedUrls(paths, IMAGE_URL_TTL_SECONDS);
      if (signErr) {
        return jsonError(500, "image sign failed", origin, signErr.message);
      }
      for (const s of signed ?? []) {
        if (s.path && s.signedUrl) signedMap[s.path] = s.signedUrl;
      }
    }

    // Build sanitised payload — `is_correct` is NEVER serialised.
    const qById = new Map<string, QuestionRow>();
    for (const q of activeQuestions) qById.set(q.id, q);
    const oById = new Map<string, OptionRow>();
    for (const o of (optsAll ?? []) as OptionRow[]) oById.set(o.id, o);

    const questions = questionOrder
      .filter((qid) => qById.has(qid))
      .map((qid) => {
        const q = qById.get(qid)!;
        const orderedIds = optionOrder[qid] ?? [];
        const options = orderedIds
          .filter((oid) => oById.has(oid))
          .map((oid) => {
            const o = oById.get(oid)!;
            return {
              id: o.id,
              text_md: o.text_md,
              image_url: o.image_path
                ? signedMap[o.image_path] ?? null
                : null,
            };
          });
        return {
          id: q.id,
          prompt_md: q.prompt_md,
          prompt_image_url: q.prompt_image_path
            ? signedMap[q.prompt_image_path] ?? null
            : null,
          difficulty: q.difficulty,
          options,
        };
      });

    const serverNow = new Date();
    const deadlineAt = new Date(
      new Date(startedAt).getTime() + quiz.duration_min * 60_000,
    );

    return json(
      200,
      {
        attempt_id: attemptId,
        status: "in_flight",
        started_at: startedAt,
        server_now: serverNow.toISOString(),
        deadline_at: deadlineAt.toISOString(),
        duration_min: quiz.duration_min,
        marks_correct: Number(quiz.marks_correct),
        marks_wrong: Number(quiz.marks_wrong),
        marks_skip: Number(quiz.marks_skip),
        quiz: {
          id: quiz.id,
          title: quiz.title,
          topic_id: quiz.topic_id,
          chapter_id: quiz.chapter_id,
          randomize_questions: quiz.randomize_questions,
          randomize_options: quiz.randomize_options,
        },
        questions,
        saved_answers: savedAnswers ?? [],
      },
      origin,
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("quiz-start error:", err);
    return jsonError(500, "internal error", origin);
  }
});
