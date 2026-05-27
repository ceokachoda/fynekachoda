// Phase 6 CP5 — `quiz-submit` edge fn.
//
// Caller: authenticated student who owns the in-flight attempt.
// Input:  `{ attempt_id }`.
//
// Responsibilities (spec §5.5 + §6.5 + §6.6 + §6.7):
//   1. Verify caller owns the attempt AND it isn't already submitted.
//   2. Load quiz config + question/option set + correct keys (server-side).
//   3. Compute per-question outcome from the saved `quiz_answers` rows.
//   4. UPDATE `quiz_attempts` with `submitted_at`, score, counts,
//      `is_auto_submit = (now - started_at) > duration` flag.
//   5. UPSERT `activity_days` (IST) so streak math can count this day.
//   6. Audit `quiz_submitted` (best-effort).
//   7. Recompute mastery for the quiz's touched topics (D-070), best-effort.
//   8. Return scores + per-question solution payload (only post-submit reveals
//      `is_correct` + explanation per spec §6.7).
//
// Replay protection: a second call on the same attempt returns 409.
//
// D-014 — IST for activity_days.day; D-074 — submitted attempts feed streak.
// D-093 — admin audit; this fn audits with `actor_role = 'student'` for trail.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import { AuthError, loadCaller, requireAnyRole } from "../_shared/auth.ts";
import { QuizSubmitInputSchema } from "../_shared/schemas.ts";
import { clientIp, writeAudit } from "../_shared/audit.ts";

const EXAM_IMAGES_BUCKET = "exam-images";
const SOLUTION_IMAGE_TTL_SECONDS = 60 * 60 * 4;

function todayIstDateString(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

interface OptionFullRow {
  id: string;
  question_id: string;
  text_md: string;
  image_path: string | null;
  is_correct: boolean;
  sort_order: number;
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
    const parsed = QuizSubmitInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const { attempt_id } = parsed.data;

    const admin = getServiceRoleClient();

    const { data: attempt, error: attErr } = await admin
      .from("quiz_attempts")
      .select(
        "id, quiz_id, student_id, started_at, submitted_at, metadata",
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

    const { data: quiz, error: qErr } = await admin
      .from("quizzes")
      .select(
        "id, title, course_id, batch_id, duration_min, marks_correct, marks_wrong, marks_skip",
      )
      .eq("id", attempt.quiz_id)
      .maybeSingle();
    if (qErr) {
      return jsonError(500, "quiz lookup failed", origin, qErr.message);
    }
    if (!quiz) return jsonError(404, "quiz not found", origin);

    // Question set + correct keys (server-only).
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
    const questions = (qqRows ?? []).map((r: any) => r.questions).filter(
      // deno-lint-ignore no-explicit-any
      (q: any) => q && !q.is_archived,
    );
    const questionIds: string[] = questions.map((q: { id: string }) => q.id);

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
      { selected_option_id: string | null; is_flagged: boolean; answered_at: string | null }
    >();
    for (const a of answers ?? []) {
      answerByQ.set(a.question_id, {
        selected_option_id: a.selected_option_id,
        is_flagged: !!a.is_flagged,
        answered_at: a.answered_at,
      });
    }

    // ----- Grade -----
    const marksCorrect = Number(quiz.marks_correct);
    const marksWrong = Number(quiz.marks_wrong);
    const marksSkip = Number(quiz.marks_skip);

    let correct_count = 0;
    let wrong_count = 0;
    let skipped_count = 0;
    let score = 0;
    const max_score = questionIds.length * marksCorrect;

    interface PerQ {
      question_id: string;
      selected_option_id: string | null;
      correct_option_id: string | null;
      outcome: "correct" | "wrong" | "skipped";
      points: number;
      is_flagged: boolean;
    }
    const perQuestion: PerQ[] = [];

    for (const qid of questionIds) {
      const opts = optionsByQ.get(qid) ?? [];
      const correctOpt = opts.find((o) => o.is_correct);
      const correctOptId = correctOpt ? correctOpt.id : null;
      const ans = answerByQ.get(qid);
      const sel = ans?.selected_option_id ?? null;
      const isFlagged = ans?.is_flagged ?? false;

      let outcome: "correct" | "wrong" | "skipped";
      let points: number;
      if (sel === null) {
        outcome = "skipped";
        points = marksSkip;
        skipped_count += 1;
      } else if (correctOptId && sel === correctOptId) {
        outcome = "correct";
        points = marksCorrect;
        correct_count += 1;
      } else {
        outcome = "wrong";
        points = marksWrong;
        wrong_count += 1;
      }
      score += points;
      perQuestion.push({
        question_id: qid,
        selected_option_id: sel,
        correct_option_id: correctOptId,
        outcome,
        points,
        is_flagged: isFlagged,
      });
    }

    const submittedAt = new Date();
    const startedAtMs = new Date(attempt.started_at).getTime();
    const deadlineMs = startedAtMs + quiz.duration_min * 60_000;
    const is_auto_submit = submittedAt.getTime() > deadlineMs;

    const { data: updated, error: updErr } = await admin
      .from("quiz_attempts")
      .update({
        submitted_at: submittedAt.toISOString(),
        is_auto_submit,
        score,
        max_score,
        correct_count,
        wrong_count,
        skipped_count,
      })
      .eq("id", attempt_id)
      .is("submitted_at", null) // double-submit guard
      .select("id, submitted_at, score, max_score, correct_count, wrong_count, skipped_count, is_auto_submit")
      .maybeSingle();
    if (updErr) {
      return jsonError(500, "attempt update failed", origin, updErr.message);
    }
    if (!updated) {
      // Lost the race — another submit already landed.
      return jsonError(409, "attempt already submitted", origin);
    }

    // activity_days (D-074: submitted attempt counts as a meaningful action).
    const { error: actErr } = await admin
      .from("activity_days")
      .upsert(
        { student_id: caller.app_user_id, day: todayIstDateString(submittedAt) },
        { onConflict: "student_id,day", ignoreDuplicates: true },
      );
    if (actErr) {
      console.error("activity_days upsert failed:", actErr.message);
    }

    // Phase 8: recompute mastery for the topics this quiz touched (D-070
    // rolling-N). Best-effort — a failure here must never break the submit.
    try {
      const topicIds = Array.from(
        new Set(
          questions
            .map((q: { topic_id: string | null }) => q.topic_id)
            .filter((t: string | null): t is string => !!t),
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

    // Phase 10 (D-188): award practice-quiz badges (first_quiz, quiz_100, and any
    // freshly-cleared mastery_80_subject). Best-effort + idempotent — a failure here
    // must never block or fail the submit.
    try {
      const { error: badgeErr } = await admin.rpc("evaluate_student_badges", {
        p_student: caller.app_user_id,
        p_triggers: ["quiz_submit"],
      });
      if (badgeErr) console.error("badge eval failed:", badgeErr.message);
    } catch (e) {
      console.error("badge eval threw:", e);
    }

    // Audit.
    await writeAudit(admin, {
      actor_user_id: caller.app_user_id,
      actor_role: "student",
      action: "quiz_submitted",
      entity_table: "quiz_attempts",
      entity_id: attempt_id,
      after_data: {
        quiz_id: quiz.id,
        score,
        max_score,
        correct_count,
        wrong_count,
        skipped_count,
        is_auto_submit,
      },
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent"),
    });

    // Solutions: include explanation + related content lookup.
    const { data: solRows, error: solErr } = await admin
      .from("question_solutions")
      .select("question_id, explanation_md, related_content_id")
      .in("question_id", questionIds);
    if (solErr) {
      console.error("solutions lookup failed:", solErr.message);
    }
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
      { id: string; title: string; kind: string; topic_id: string }
    >();
    if (relatedIds.size > 0) {
      const { data: contents } = await admin
        .from("content_items")
        .select("id, title, kind, topic_id")
        .in("id", Array.from(relatedIds));
      for (const c of contents ?? []) {
        contentMap.set(c.id, c);
      }
    }

    // Sign images for prompts + options.
    const imagePaths = new Set<string>();
    for (const q of questions) {
      // deno-lint-ignore no-explicit-any
      if ((q as any).prompt_image_path) imagePaths.add((q as any).prompt_image_path);
    }
    for (const o of (optsAll ?? []) as OptionFullRow[]) {
      if (o.image_path) imagePaths.add(o.image_path);
    }
    const signedMap: Record<string, string> = {};
    if (imagePaths.size > 0) {
      const paths = Array.from(imagePaths);
      const { data: signed, error: signErr } = await admin.storage
        .from(EXAM_IMAGES_BUCKET)
        .createSignedUrls(paths, SOLUTION_IMAGE_TTL_SECONDS);
      if (signErr) {
        console.error("image sign failed:", signErr.message);
      } else {
        for (const s of signed ?? []) {
          if (s.path && s.signedUrl) signedMap[s.path] = s.signedUrl;
        }
      }
    }

    // Determine the display order of questions (snapshot from attempt meta if
    // present, fall back to canonical sort_order).
    // deno-lint-ignore no-explicit-any
    const snapshotOrder = ((attempt.metadata ?? {}) as any).question_order;
    const displayOrder: string[] = Array.isArray(snapshotOrder)
      ? snapshotOrder.filter((id: unknown) =>
        typeof id === "string" && questionIds.includes(id)
      )
      : questionIds;
    for (const qid of questionIds) {
      if (!displayOrder.includes(qid)) displayOrder.push(qid);
    }

    const perQByQ = new Map<string, PerQ>();
    for (const p of perQuestion) perQByQ.set(p.question_id, p);

    // deno-lint-ignore no-explicit-any
    const qById = new Map<string, any>();
    for (const q of questions) qById.set(q.id, q);

    const solutionQuestions = displayOrder.map((qid) => {
      const q = qById.get(qid);
      const opts = optionsByQ.get(qid) ?? [];
      // Use snapshot option order if present.
      // deno-lint-ignore no-explicit-any
      const optOrderSnap = ((attempt.metadata ?? {}) as any).option_order?.[qid];
      const optionIds: string[] = Array.isArray(optOrderSnap)
        ? optOrderSnap.filter((oid: unknown) =>
          typeof oid === "string" && opts.some((o) => o.id === oid)
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
      const perQ = perQByQ.get(qid);
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
        related_content: rc
          ? { id: rc.id, title: rc.title, kind: rc.kind }
          : null,
        your_option_id: perQ?.selected_option_id ?? null,
        correct_option_id: perQ?.correct_option_id ?? null,
        outcome: perQ?.outcome ?? "skipped",
        points: perQ?.points ?? 0,
        is_flagged: perQ?.is_flagged ?? false,
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
          marks_correct: marksCorrect,
          marks_wrong: marksWrong,
          marks_skip: marksSkip,
          duration_min: quiz.duration_min,
        },
        score,
        max_score,
        correct_count,
        wrong_count,
        skipped_count,
        started_at: attempt.started_at,
        submitted_at: updated.submitted_at,
        is_auto_submit,
        questions: solutionQuestions,
      },
      origin,
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("quiz-submit error:", err);
    return jsonError(500, "internal error", origin);
  }
});
