"use client";

// Phase 4 Track 4B — exam results board (roster + question analysis) for the
// teacher's release/regrade screen. Mirrors mobile useExamResultsBoard.ts.

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

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

export interface ResultsBoardExam {
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
}

export function useExamResultsBoard(examId: string | null) {
  return useQuery({
    queryKey: ["exam-results-board", examId],
    enabled: !!examId,
    queryFn: async (): Promise<{
      exam: ResultsBoardExam;
      roster: ResultsBoardAttempt[];
      questions: QuestionAnalysisRow[];
    }> => {
      const supabase = createSupabaseBrowserClient();
      const eRes = await supabase
        .from("exams")
        .select(
          "id, title, batch_id, is_published, results_released_at, result_release, duration_min, starts_at, marks_correct, marks_wrong, marks_skip",
        )
        .eq("id", examId)
        .maybeSingle();
      if (eRes.error || !eRes.data) {
        throw new Error(eRes.error?.message ?? "Exam not found.");
      }
      const e = eRes.data as Record<string, unknown>;
      const exam: ResultsBoardExam = {
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
      };

      const aRes = await supabase
        .from("exam_attempts")
        .select(
          "id, student_id, submitted_at, score, max_score, correct_count, wrong_count, skipped_count, tab_switch_count, auto_submitted, students!inner(user_id, app_users!user_id(full_name))",
        )
        .eq("exam_id", examId)
        .order("score", { ascending: false, nullsFirst: false });
      if (aRes.error) throw new Error(aRes.error.message);
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
      const roster: ResultsBoardAttempt[] = (
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

      const eqRes = await supabase
        .from("exam_questions")
        .select("question_id, sort_order, questions!inner(id, prompt_md)")
        .eq("exam_id", examId)
        .order("sort_order", { ascending: true });
      if (eqRes.error) throw new Error(eqRes.error.message);
      const examQuestions = (
        (eqRes.data ?? []) as unknown as Array<{
          question_id: string;
          sort_order: number;
          questions: { id: string; prompt_md: string };
        }>
      ).map((row) => ({
        question_id: row.question_id,
        prompt_md: row.questions.prompt_md,
      }));

      const submittedIds = roster
        .filter((r) => r.submitted_at !== null)
        .map((r) => r.attempt_id);
      const ansRes = submittedIds.length
        ? await supabase
            .from("exam_answers")
            .select("attempt_id, question_id, selected_option_id")
            .in("attempt_id", submittedIds)
        : { data: [] };
      const selByQ = new Map<string, Map<string, string | null>>();
      for (const a of (ansRes.data ?? []) as Array<{
        attempt_id: string;
        question_id: string;
        selected_option_id: string | null;
      }>) {
        const m =
          selByQ.get(a.question_id) ?? new Map<string, string | null>();
        m.set(a.attempt_id, a.selected_option_id);
        selByQ.set(a.question_id, m);
      }

      const snapRes = await supabase
        .from("exam_attempts")
        .select("id, question_snapshot")
        .eq("exam_id", examId)
        .not("submitted_at", "is", null);
      const correctByAttemptQ = new Map<string, string | null>();
      const overrideByAttemptQ = new Map<string, "all" | "none" | null>();
      for (const a of (snapRes.data ?? []) as Array<{
        id: string;
        question_snapshot: {
          questions?: Array<{
            id: string;
            correct_option_id: string | null;
            regrade_override?: "all" | "none" | null;
          }>;
        };
      }>) {
        for (const q of a.question_snapshot?.questions ?? []) {
          correctByAttemptQ.set(`${a.id}:${q.id}`, q.correct_option_id);
          overrideByAttemptQ.set(`${a.id}:${q.id}`, q.regrade_override ?? null);
        }
      }
      const questions: QuestionAnalysisRow[] = examQuestions.map((q) => {
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
            // none → no credit
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
      return { exam, roster, questions };
    },
    staleTime: 30_000,
  });
}
