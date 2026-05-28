"use client";

// Phase 4 Track 4B — teacher exam results board (FocusLayout). Mirrors mobile
// exam-results. Release goes through exam-release-results edge fn; Regrade
// through exam-regrade (full-recompute per D-179).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2, Megaphone, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Pill } from "@/components/fyne/Pill";
import { FocusLayout } from "@/components/fyne/FocusLayout";
import { QueryProvider } from "@/lib/query";
import { SessionProvider } from "@/features/auth/SessionProvider";
import {
  useExamResultsBoard,
  type QuestionAnalysisRow,
} from "@/features/teacher/useExamResultsBoard";
import {
  useExamRegrade,
  useExamRelease,
} from "@/features/teacher/mutations";
import { ExamRegradeDialog } from "@/components/teacher/ExamRegradeDialog";
import { ConfirmDialog } from "@/components/teacher/ConfirmDialog";

interface Props {
  examId: string;
}

export function ExamResultsClient({ examId }: Props) {
  return (
    <FocusLayout className="bg-slate-50">
      <QueryProvider>
        <SessionProvider>
          <ExamResultsInner examId={examId} />
        </SessionProvider>
      </QueryProvider>
    </FocusLayout>
  );
}

function ExamResultsInner({ examId }: Props) {
  const router = useRouter();
  const board = useExamResultsBoard(examId);
  const release = useExamRelease();
  const regrade = useExamRegrade();
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [regradeTarget, setRegradeTarget] = useState<QuestionAnalysisRow | null>(
    null,
  );

  if (board.isLoading && !board.data) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }
  if (!board.data) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-red-600">
          {board.error instanceof Error
            ? board.error.message
            : "Couldn't load this exam."}
        </p>
      </div>
    );
  }

  const { exam, roster, questions } = board.data;
  const submittedRoster = roster.filter((r) => r.submitted_at !== null);
  const released = !!exam.results_released_at;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-32">
      <header className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Back"
          onClick={() => router.push("/exams")}
        >
          <ChevronLeft />
        </Button>
        <h1
          className="truncate text-xl font-bold text-slate-900"
          data-testid="exam-results-title"
        >
          {exam.title}
        </h1>
      </header>

      <section className="rounded-2xl border border-slate-100 bg-white p-4">
        <p className="text-xs text-slate-500">
          {roster.length} attempt{roster.length === 1 ? "" : "s"} ·{" "}
          {submittedRoster.length} submitted · {questions.length} questions
        </p>
        <div className="mt-1 flex items-center">
          <span
            className="mr-2 inline-block size-2.5 rounded-full"
            style={{ backgroundColor: released ? "#059669" : "#f59e0b" }}
          />
          <p
            className="text-sm font-semibold"
            style={{ color: released ? "#059669" : "#92400e" }}
          >
            {released
              ? `Results released ${new Date(exam.results_released_at!).toLocaleString(
                  "en-IN",
                  {
                    timeZone: "Asia/Kolkata",
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  },
                )}`
              : "Results NOT released"}
          </p>
        </div>
        {!released ? (
          <Button
            onClick={() => setReleaseOpen(true)}
            className="mt-3 w-full"
            data-testid="results-release"
          >
            <Megaphone />
            Release results to students
          </Button>
        ) : null}
      </section>

      <section>
        <h2 className="mb-2 text-base font-bold text-slate-900">Roster</h2>
        {submittedRoster.length === 0 ? (
          <p className="rounded-2xl border border-slate-100 bg-white p-4 italic text-slate-500">
            No submitted attempts yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {submittedRoster.map((r) => {
              const pct =
                r.score !== null && r.max_score && r.max_score > 0
                  ? Math.round((r.score / r.max_score) * 100)
                  : 0;
              return (
                <li
                  key={r.attempt_id}
                  className="flex items-center rounded-2xl border border-slate-100 bg-white p-3"
                >
                  <div className="mr-3 flex size-9 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-primary">
                    {r.student_name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {r.student_name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {r.correct_count ?? 0}✓ · {r.wrong_count ?? 0}✗ ·{" "}
                      {r.skipped_count ?? 0} skipped
                      {r.auto_submitted ? " · auto" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-extrabold text-primary">
                      {r.score !== null ? Math.round(r.score) : "—"}
                      <span className="text-xs text-slate-400">
                        /{r.max_score ? Math.round(r.max_score) : 0}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500">{pct}%</p>
                    {r.tab_switch_count > 0 ? (
                      <Pill tone="warning" className="mt-1">
                        <ShieldAlert className="mr-1 size-3" />
                        tab×{r.tab_switch_count}
                      </Pill>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-base font-bold text-slate-900">
          Question analysis
        </h2>
        {questions.length === 0 ? (
          <p className="rounded-2xl border border-slate-100 bg-white p-4 italic text-slate-500">
            No questions in this exam.
          </p>
        ) : (
          <ul className="space-y-2">
            {questions.map((qa, i) => {
              const color =
                qa.pct_correct >= 70
                  ? "#16a34a"
                  : qa.pct_correct >= 40
                    ? "#f59e0b"
                    : "#dc2626";
              return (
                <li
                  key={qa.question_id}
                  className="rounded-2xl border border-slate-100 bg-white p-3"
                >
                  <div className="flex items-start">
                    <span className="mr-2 mt-0.5 text-xs font-bold text-slate-500">
                      Q{i + 1}
                    </span>
                    <p className="line-clamp-2 flex-1 text-sm text-slate-800">
                      {qa.prompt_md}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full"
                        style={{
                          width: `${qa.pct_correct}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                    <span
                      className="w-12 text-right text-sm font-bold"
                      style={{ color }}
                    >
                      {qa.pct_correct}%
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRegradeTarget(qa)}
                      data-testid={`regrade-${qa.question_id}`}
                    >
                      Regrade
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {qa.correct_attempts}/{qa.total_attempts} correct
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={releaseOpen}
        onOpenChange={setReleaseOpen}
        title="Release results?"
        description="Students will be able to view scores + solutions immediately. Admins can unrelease later."
        confirmLabel={release.isPending ? "Releasing…" : "Release"}
        destructive
        pending={release.isPending}
        onConfirm={async () => {
          await release.mutateAsync({ exam_id: examId });
          setReleaseOpen(false);
          await board.refetch();
        }}
      />

      <ExamRegradeDialog
        open={!!regradeTarget}
        onOpenChange={(v) => {
          if (!v) setRegradeTarget(null);
        }}
        examId={examId}
        question={regradeTarget}
        submitting={regrade.isPending}
        onSubmit={async (input) => {
          if (!regradeTarget) return;
          const res = await regrade.mutateAsync({
            exam_id: examId,
            question_id: regradeTarget.question_id,
            action: input.action,
            reason: input.reason,
            ...(input.new_correct_option_id
              ? { new_correct_option_id: input.new_correct_option_id }
              : {}),
          });
          setRegradeTarget(null);
          await board.refetch();
          if (typeof window !== "undefined") {
            window.alert(
              `${res?.attempts_updated ?? 0} attempt(s) recomputed.`,
            );
          }
        }}
      />

      {/* Loader-related visual is via the dialog's own pending state, but a
          quick page-level spinner during a manual refetch keeps it obvious. */}
      {board.isFetching && !board.isLoading ? (
        <p className="fixed bottom-4 right-4 flex items-center rounded-full bg-white px-3 py-1.5 text-xs shadow">
          <Loader2 className="mr-1 size-3 animate-spin" />
          Refreshing…
        </p>
      ) : null}
    </div>
  );
}
