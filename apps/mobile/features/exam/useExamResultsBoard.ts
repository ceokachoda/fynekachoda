import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/features/auth/network-errors";
import { invokeEdgeFn } from "@/lib/edge-fn";

export interface ResultsBoardAttempt {
  attempt_id: string;
  student_id: string;
  student_name: string;
  submitted_at: string | null;
  score: number | null;
  max_score: number | null;
  correct_count: number | null;
  wrong_count: number | null;
  skipped_count: number | null;
  tab_switch_count: number;
  auto_submitted: boolean;
}

export interface QuestionAnalysisRow {
  question_id: string;
  prompt_md: string;
  total_attempts: number;
  correct_attempts: number;
  pct_correct: number;
}

interface State {
  exam: {
    id: string;
    title: string;
    batch_id: string;
    is_published: boolean;
    results_released_at: string | null;
    result_release: "manual" | "instant";
    duration_min: number;
    starts_at: string;
    marks_correct: number;
    marks_wrong: number;
    marks_skip: number;
  } | null;
  roster: ResultsBoardAttempt[];
  questions: QuestionAnalysisRow[];
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useExamResultsBoard(examId: string | null): State {
  const [exam, setExam] = useState<State["exam"]>(null);
  const [roster, setRoster] = useState<ResultsBoardAttempt[]>([]);
  const [questions, setQuestions] = useState<QuestionAnalysisRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!examId) return;
    setIsLoading(true);
    setError(null);
    try {
      const eRes = await withTimeout(
        supabase
          .from("exams")
          .select(
            "id, title, batch_id, is_published, results_released_at, result_release, duration_min, starts_at, marks_correct, marks_wrong, marks_skip",
          )
          .eq("id", examId)
          .maybeSingle(),
      );
      if (eRes.error || !eRes.data) {
        setError(eRes.error?.message ?? "Exam not found.");
        return;
      }
      const e = eRes.data as Record<string, unknown>;
      setExam({
        id: e.id as string,
        title: e.title as string,
        batch_id: e.batch_id as string,
        is_published: e.is_published as boolean,
        results_released_at: e.results_released_at as string | null,
        result_release: e.result_release as "manual" | "instant",
        duration_min: e.duration_min as number,
        starts_at: e.starts_at as string,
        marks_correct: Number(e.marks_correct),
        marks_wrong: Number(e.marks_wrong),
        marks_skip: Number(e.marks_skip),
      });

      // Roster sorted by score desc (nulls last). Embed student name via
      // students→app_users (FK hint required per db-conventions).
      const aRes = await withTimeout(
        supabase
          .from("exam_attempts")
          .select(
            "id, student_id, submitted_at, score, max_score, correct_count, wrong_count, skipped_count, tab_switch_count, auto_submitted, students!inner(user_id, app_users!user_id(full_name))",
          )
          .eq("exam_id", examId)
          .order("score", { ascending: false, nullsFirst: false }),
      );
      if (aRes.error) {
        setError(aRes.error.message);
        return;
      }
      type ARow = {
        id: string;
        student_id: string;
        submitted_at: string | null;
        score: number | null;
        max_score: number | null;
        correct_count: number | null;
        wrong_count: number | null;
        skipped_count: number | null;
        tab_switch_count: number;
        auto_submitted: boolean;
        students: { app_users: { full_name: string } | null } | null;
      };
      const mappedRoster: ResultsBoardAttempt[] = (
        (aRes.data ?? []) as unknown as ARow[]
      ).map((a) => ({
        attempt_id: a.id,
        student_id: a.student_id,
        student_name: a.students?.app_users?.full_name ?? "(unknown)",
        submitted_at: a.submitted_at,
        score: a.score !== null ? Number(a.score) : null,
        max_score: a.max_score !== null ? Number(a.max_score) : null,
        correct_count: a.correct_count,
        wrong_count: a.wrong_count,
        skipped_count: a.skipped_count,
        tab_switch_count: a.tab_switch_count,
        auto_submitted: a.auto_submitted,
      }));
      setRoster(mappedRoster);

      // Question analysis: pull exam_questions + snapshot per-attempt to count
      // correct selections. Compute client-side from RLS-readable
      // exam_answers + exam_attempts (teacher_read policies).
      const eqRes = await withTimeout(
        supabase
          .from("exam_questions")
          .select(
            "question_id, sort_order, questions!inner(id, prompt_md)",
          )
          .eq("exam_id", examId)
          .order("sort_order", { ascending: true }),
      );
      if (eqRes.error) {
        setError(eqRes.error.message);
        return;
      }
      const examQuestions = ((eqRes.data ?? []) as unknown as Array<{
        question_id: string;
        sort_order: number;
        questions: { id: string; prompt_md: string };
      }>).map((row) => ({
        question_id: row.question_id,
        prompt_md: row.questions.prompt_md,
      }));
      const ansRes = await withTimeout(
        supabase
          .from("exam_answers")
          .select("attempt_id, question_id, selected_option_id")
          .in(
            "attempt_id",
            mappedRoster
              .filter((r) => r.submitted_at !== null)
              .map((r) => r.attempt_id),
          ),
      );
      const ans = ansRes.data ?? [];
      // Map: question_id → Map(attempt_id → selected_option_id).
      const selByQ = new Map<string, Map<string, string | null>>();
      for (const a of ans) {
        const m =
          selByQ.get(a.question_id) ?? new Map<string, string | null>();
        m.set(a.attempt_id, a.selected_option_id);
        selByQ.set(a.question_id, m);
      }
      // For each attempt, look up the snapshot's correct_option_id AND any
      // regrade_override ("all" → everyone correct, "none" → everyone
      // skipped) so the analysis bar matches the regraded scores the edge fn
      // computed via gradeAttempt (D-179). Reading only correct_option_id
      // would leave the bar stale after mark_all_correct.
      const correctByAttemptQ = new Map<string, string | null>();
      const overrideByAttemptQ = new Map<string, "all" | "none" | null>();
      // Answer keys (correct_option_id + regrade_override) via a teacher-scoped
      // edge fn — `question_snapshot` is no longer directly selectable by
      // `authenticated` (it would leak the answer key to students mid-exam; see
      // migration 20260529120000).
      const {
        status: keyStatus,
        body: keyBody,
        error: keyErr,
      } = await invokeEdgeFn<{
        attempts: Array<{
          attempt_id: string;
          questions: Array<{
            id: string;
            correct_option_id: string | null;
            regrade_override: "all" | "none" | null;
          }>;
        }>;
      }>("exam-answer-keys", { exam_id: examId });
      if (keyStatus !== 200 || !keyBody) {
        throw new Error(keyErr ?? `answer-keys failed (${keyStatus})`);
      }
      for (const a of keyBody.attempts) {
        for (const q of a.questions) {
          correctByAttemptQ.set(`${a.attempt_id}:${q.id}`, q.correct_option_id);
          overrideByAttemptQ.set(
            `${a.attempt_id}:${q.id}`,
            q.regrade_override ?? null,
          );
        }
      }

      const qa: QuestionAnalysisRow[] = examQuestions.map((q) => {
        const sel = selByQ.get(q.question_id) ?? new Map();
        let correct = 0;
        let total = 0;
        for (const [attemptId, selectedOptId] of sel.entries()) {
          total++;
          const key = `${attemptId}:${q.question_id}`;
          const override = overrideByAttemptQ.get(key) ?? null;
          if (override === "all") {
            correct++;
          } else if (override === "none") {
            // no correct credit after mark_no_correct
          } else {
            const correctOpt = correctByAttemptQ.get(key);
            if (correctOpt && selectedOptId === correctOpt) correct++;
          }
        }
        return {
          question_id: q.question_id,
          prompt_md: q.prompt_md,
          total_attempts: total,
          correct_attempts: correct,
          pct_correct: total > 0 ? Math.round((correct / total) * 100) : 0,
        };
      });
      setQuestions(qa);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load results.");
    } finally {
      setIsLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { exam, roster, questions, isLoading, error, reload };
}
