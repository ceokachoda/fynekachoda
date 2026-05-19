// Phase 7 CP4 — `exam-start` edge fn.
//
// Caller: authenticated student. Input: `{ exam_id }`.
//
// Responsibilities (spec §5.4):
//   1. Verify the student is in the exam's batch.
//   2. Verify the exam is published AND now is within
//      [starts_at, starts_at + duration_min). If now < starts_at → 400 early.
//      If now >= starts_at + duration_min → 400 ended.
//   3. Idempotently INSERT `exam_attempts` ON CONFLICT (exam_id, student_id)
//      → DO NOTHING. If insert lands, build `question_snapshot` = full
//      question + option content (randomised per attempt) WITH the
//      server-only `correct_option_id` per question. If a row already
//      existed (idempotent re-entry), load it.
//   4. Compute `remaining_sec` = `min(starts_at + duration, now + duration) - now`
//      i.e., late entry gets only remaining-window time (D-052).
//   5. Sign image URLs for every prompt + option image (4h TTL).
//   6. Return SANITISED payload — no `correct_option_id`, no `is_correct`.
//
// Security:
//   - The snapshot stored in DB carries `correct_option_id` (server-side).
//   - The HTTP response sanitises it via `sanitiseSnapshotForStudent`.
//   - All Storage objects are private; signed via service role per D-171.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import { AuthError, loadCaller, requireAnyRole } from "../_shared/auth.ts";
import { ExamStartInputSchema } from "../_shared/schemas.ts";
import {
  type ExamSnapshot,
  sanitiseSnapshotForStudent,
  shuffleStable,
  type SnapshotQuestion,
} from "../_shared/exam-marking.ts";

const EXAM_IMAGES_BUCKET = "exam-images";
// 6h covers the longest allowed duration (360m) + post-submit solution view.
const IMAGE_URL_TTL_SECONDS = 60 * 60 * 6;

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
    const parsed = ExamStartInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const { exam_id } = parsed.data;

    const admin = getServiceRoleClient();

    // Resolve student's batch.
    const { data: stuRow, error: stuErr } = await admin
      .from("students")
      .select("user_id, batch_id")
      .eq("user_id", caller.app_user_id)
      .maybeSingle();
    if (stuErr) {
      return jsonError(500, "student lookup failed", origin, stuErr.message);
    }
    if (!stuRow) return jsonError(403, "no student profile", origin);
    const studentBatchId = stuRow.batch_id as string;

    // Exam + scope check.
    const { data: exam, error: exErr } = await admin
      .from("exams")
      .select(
        "id, title, batch_id, starts_at, duration_min, marks_correct, marks_wrong, marks_skip, randomize_questions, randomize_options, result_release, results_released_at, is_published",
      )
      .eq("id", exam_id)
      .maybeSingle();
    if (exErr) {
      return jsonError(500, "exam lookup failed", origin, exErr.message);
    }
    if (!exam) return jsonError(404, "exam not found", origin);
    if (!exam.is_published) return jsonError(403, "exam not published", origin);
    if (exam.batch_id !== studentBatchId) {
      return jsonError(403, "exam not in your batch", origin);
    }

    const now = new Date();
    const startsAt = new Date(exam.starts_at);
    const hardCutMs = startsAt.getTime() + exam.duration_min * 60_000;

    if (now.getTime() < startsAt.getTime()) {
      const secs = Math.ceil((startsAt.getTime() - now.getTime()) / 1000);
      return jsonError(400, "exam has not started yet", origin, {
        starts_at: exam.starts_at,
        seconds_until_start: secs,
      });
    }
    if (now.getTime() >= hardCutMs) {
      return jsonError(400, "exam has ended", origin, {
        ended_at: new Date(hardCutMs).toISOString(),
      });
    }

    // Question set + correct keys (server-side; sanitised before serialise).
    const { data: eqRows, error: eqErr } = await admin
      .from("exam_questions")
      .select(
        "question_id, sort_order, questions!inner(id, prompt_md, prompt_image_path, difficulty, topic_id, is_archived)",
      )
      .eq("exam_id", exam_id)
      .order("sort_order", { ascending: true });
    if (eqErr) {
      return jsonError(500, "exam_questions lookup failed", origin, eqErr.message);
    }
    // deno-lint-ignore no-explicit-any
    const activeQuestions: QuestionRow[] = (eqRows ?? [])
      // deno-lint-ignore no-explicit-any
      .map((r: any) => r.questions as QuestionRow)
      .filter((q) => q && !q.is_archived);
    if (activeQuestions.length === 0) {
      return jsonError(409, "exam has no questions", origin);
    }
    const questionIds = activeQuestions.map((q) => q.id);

    const { data: optsAll, error: oErr } = await admin
      .from("question_options")
      .select("id, question_id, text_md, image_path, is_correct, sort_order")
      .in("question_id", questionIds)
      .order("sort_order", { ascending: true });
    if (oErr) {
      return jsonError(500, "options lookup failed", origin, oErr.message);
    }
    const optionsByQ = new Map<string, OptionRow[]>();
    for (const o of (optsAll ?? []) as OptionRow[]) {
      const list = optionsByQ.get(o.question_id) ?? [];
      list.push(o);
      optionsByQ.set(o.question_id, list);
    }

    // Idempotency: an existing row for (exam_id, student_id) is REUSED.
    const { data: existing, error: exiErr } = await admin
      .from("exam_attempts")
      .select(
        "id, exam_id, student_id, started_at, deadline_at, submitted_at, tab_switch_count, question_snapshot",
      )
      .eq("exam_id", exam_id)
      .eq("student_id", caller.app_user_id)
      .maybeSingle();
    if (exiErr) {
      return jsonError(500, "attempt lookup failed", origin, exiErr.message);
    }

    let attemptId: string;
    let startedAt: string;
    let deadlineAt: string;
    let snapshot: ExamSnapshot;
    let tabSwitchCount = 0;

    if (existing) {
      if (existing.submitted_at !== null) {
        return jsonError(409, "exam already submitted", origin, {
          submitted_at: existing.submitted_at,
        });
      }
      attemptId = existing.id;
      startedAt = existing.started_at;
      deadlineAt = existing.deadline_at;
      snapshot = (existing.question_snapshot ?? { questions: [] }) as ExamSnapshot;
      tabSwitchCount = existing.tab_switch_count ?? 0;
    } else {
      // Build a fresh snapshot. Order honours `randomize_questions` +
      // `randomize_options`. The same snapshot is what the server uses to
      // score the attempt later, even if the bank is edited mid-window.
      const orderedQuestionIds = exam.randomize_questions
        ? shuffleStable(questionIds)
        : questionIds;
      const snapshotQuestions: SnapshotQuestion[] = [];
      for (const qid of orderedQuestionIds) {
        const q = activeQuestions.find((x) => x.id === qid);
        if (!q) continue;
        const opts = optionsByQ.get(qid) ?? [];
        const orderedOptIds = exam.randomize_options
          ? shuffleStable(opts.map((o) => o.id))
          : opts.map((o) => o.id);
        const orderedOpts = orderedOptIds
          .map((oid) => opts.find((o) => o.id === oid))
          .filter((o): o is OptionRow => Boolean(o));
        const correct = opts.find((o) => o.is_correct);
        snapshotQuestions.push({
          id: q.id,
          prompt_md: q.prompt_md,
          prompt_image_path: q.prompt_image_path,
          difficulty: q.difficulty,
          topic_id: q.topic_id,
          options: orderedOpts.map((o) => ({
            id: o.id,
            text_md: o.text_md,
            image_path: o.image_path,
          })),
          correct_option_id: correct ? correct.id : null,
        });
      }
      snapshot = { questions: snapshotQuestions };

      // Late-entry-aware deadline: min(starts_at + duration, now + duration).
      const startedAtDate = now;
      const deadlineDate = new Date(
        Math.min(hardCutMs, startedAtDate.getTime() + exam.duration_min * 60_000),
      );
      startedAt = startedAtDate.toISOString();
      deadlineAt = deadlineDate.toISOString();

      const { data: created, error: insErr } = await admin
        .from("exam_attempts")
        .insert({
          exam_id,
          student_id: caller.app_user_id,
          started_at: startedAt,
          deadline_at: deadlineAt,
          question_snapshot: snapshot,
        })
        .select("id, started_at, deadline_at, tab_switch_count")
        .single();
      if (insErr) {
        // Race condition: another concurrent start may have inserted first.
        // Re-fetch and treat as idempotent.
        if (insErr.code === "23505") {
          const { data: race } = await admin
            .from("exam_attempts")
            .select(
              "id, started_at, deadline_at, submitted_at, tab_switch_count, question_snapshot",
            )
            .eq("exam_id", exam_id)
            .eq("student_id", caller.app_user_id)
            .single();
          if (race) {
            if (race.submitted_at !== null) {
              return jsonError(409, "exam already submitted", origin);
            }
            attemptId = race.id;
            startedAt = race.started_at;
            deadlineAt = race.deadline_at;
            snapshot = (race.question_snapshot ?? { questions: [] }) as ExamSnapshot;
            tabSwitchCount = race.tab_switch_count ?? 0;
          } else {
            return jsonError(500, "attempt insert failed", origin, insErr.message);
          }
        } else {
          return jsonError(500, "attempt insert failed", origin, insErr.message);
        }
      } else {
        attemptId = created.id;
        startedAt = created.started_at;
        deadlineAt = created.deadline_at;
        tabSwitchCount = created.tab_switch_count ?? 0;
      }
    }

    // Load any auto-saved answers (for refresh / app-kill resume).
    const { data: savedAnswers, error: ansErr } = await admin
      .from("exam_answers")
      .select("question_id, selected_option_id, is_flagged, answered_at")
      .eq("attempt_id", attemptId);
    if (ansErr) {
      return jsonError(500, "saved answers lookup failed", origin, ansErr.message);
    }

    // Sign all image paths from the snapshot in one round-trip.
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
        .createSignedUrls(paths, IMAGE_URL_TTL_SECONDS);
      if (signErr) {
        console.error("image sign failed:", signErr.message);
      } else {
        for (const s of signed ?? []) {
          if (s.path && s.signedUrl) signedMap[s.path] = s.signedUrl;
        }
      }
    }

    const sanitised = sanitiseSnapshotForStudent(snapshot);
    const clientQuestions = sanitised.questions.map((q) => ({
      id: q.id,
      prompt_md: q.prompt_md,
      prompt_image_url: q.prompt_image_path
        ? signedMap[q.prompt_image_path] ?? null
        : null,
      difficulty: q.difficulty,
      options: q.options.map((o) => ({
        id: o.id,
        text_md: o.text_md,
        image_url: o.image_path ? signedMap[o.image_path] ?? null : null,
      })),
    }));

    const serverNow = new Date();
    return json(
      200,
      {
        attempt_id: attemptId,
        status: "in_flight",
        started_at: startedAt,
        deadline_at: deadlineAt,
        server_now: serverNow.toISOString(),
        tab_switch_count: tabSwitchCount,
        exam: {
          id: exam.id,
          title: exam.title,
          duration_min: exam.duration_min,
          marks_correct: Number(exam.marks_correct),
          marks_wrong: Number(exam.marks_wrong),
          marks_skip: Number(exam.marks_skip),
          result_release: exam.result_release,
          randomize_questions: exam.randomize_questions,
          randomize_options: exam.randomize_options,
        },
        questions: clientQuestions,
        saved_answers: savedAnswers ?? [],
      },
      origin,
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("exam-start error:", err);
    return jsonError(500, "internal error", origin);
  }
});
