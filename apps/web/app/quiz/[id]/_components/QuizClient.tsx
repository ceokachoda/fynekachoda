"use client";

// Phase 3 — student quiz attempt + solution screen.
//
// Outside the (protected) group on purpose (mirrors mobile D-169) so the
// AppShell side-rail doesn't render. Auth is enforced by middleware.ts.
//
// 4-stage state machine:
//   intro     — quiz meta + rules + Start
//   attempt   — QuestionCard + OptionRadio + FlagButton + NavigationGrid +
//               TimerPill. Auto-saves on every change.
//   result    — score breakdown + Review Solutions / Retake.
//   solution  — per-question SolutionCard (allowed: is_correct + explanation).

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { QueryProvider } from "@/lib/query";
import { SessionProvider } from "@/features/auth/SessionProvider";
import { FlagButton } from "@/components/quiz/FlagButton";
import { NavigationGrid, type QuestionStatus } from "@/components/quiz/NavigationGrid";
import { OptionRadio, type OptionStatus } from "@/components/quiz/OptionRadio";
import { QuestionCard } from "@/components/quiz/QuestionCard";
import { SolutionCard } from "@/components/quiz/SolutionCard";
import { SubmitConfirmDialog } from "@/components/quiz/SubmitConfirmDialog";
import { TimerPill } from "@/components/quiz/TimerPill";
import { useQuizStart } from "@/features/quiz/useQuizStart";
import { useQuizSubmit } from "@/features/quiz/useQuizSubmit";
import { useQuizAttemptResult } from "@/features/quiz/useQuizAttemptResult";
import { useQuizAutoSave } from "@/features/quiz/useQuizAutoSave";
import {
  computeStatuses,
  countAnswered,
  countFlagged,
  unansweredIndices,
} from "@/features/quiz/attemptHelpers";
import type {
  QuizSubmitResponse,
  SavedAnswer,
} from "@/features/quiz/types";

type Stage = "intro" | "attempt" | "result" | "solution";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

interface AnswerLocal {
  selected_option_id: string | null;
  is_flagged: boolean;
}

interface AttemptState {
  stage: Stage;
  currentIndex: number;
  answers: Map<string, AnswerLocal>;
}

type AttemptAction =
  | { type: "set-stage"; stage: Stage }
  | { type: "set-index"; index: number }
  | { type: "set-answers"; answers: Map<string, AnswerLocal> }
  | {
      type: "update-answer";
      questionId: string;
      patch: Partial<AnswerLocal>;
    }
  | { type: "reset"; nextStage: Stage };

function attemptReducer(state: AttemptState, action: AttemptAction): AttemptState {
  switch (action.type) {
    case "set-stage":
      return { ...state, stage: action.stage };
    case "set-index":
      return { ...state, currentIndex: action.index };
    case "set-answers":
      return { ...state, answers: action.answers };
    case "update-answer": {
      const next = new Map(state.answers);
      const cur = next.get(action.questionId) ?? {
        selected_option_id: null,
        is_flagged: false,
      };
      next.set(action.questionId, { ...cur, ...action.patch });
      return { ...state, answers: next };
    }
    case "reset":
      return {
        stage: action.nextStage,
        currentIndex: 0,
        answers: new Map(),
      };
  }
}

interface Props {
  quizId: string;
}

// Outer wrapper supplies the QueryProvider + SessionProvider that the
// (protected) layout normally gives Phase 2 features. The quiz route lives
// OUTSIDE that group so we wire it up here.
export function QuizClient(props: Props) {
  return (
    <QueryProvider>
      <SessionProvider>
        <QuizClientInner {...props} />
      </SessionProvider>
    </QueryProvider>
  );
}

function QuizClientInner({ quizId }: Props) {
  const router = useRouter();
  const startState = useQuizStart(quizId);
  const submitState = useQuizSubmit();

  const [state, dispatch] = useReducer(attemptReducer, {
    stage: "intro",
    currentIndex: 0,
    answers: new Map<string, AnswerLocal>(),
  });
  const [submitResult, setSubmitResult] = useState<QuizSubmitResponse | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [expired, setExpired] = useState(false);
  const [solutionAttemptId, setSolutionAttemptId] = useState<string | null>(null);
  const autoSubmittedRef = useRef(false);

  const attemptId = startState.data?.attempt_id ?? null;
  const autoSave = useQuizAutoSave({ attemptId });

  // Stable so NavigationGrid's memoized cells don't all re-render on every
  // answer change. dispatch from useReducer is referentially stable.
  const handleJump = useCallback(
    (i: number) => dispatch({ type: "set-index", index: i }),
    [],
  );

  // Hydrate local answers state from saved_answers when the start payload
  // arrives (supports refresh-mid-attempt resume).
  useEffect(() => {
    if (!startState.data) return;
    const m = new Map<string, AnswerLocal>();
    for (const a of startState.data.saved_answers as SavedAnswer[]) {
      m.set(a.question_id, {
        selected_option_id: a.selected_option_id,
        is_flagged: a.is_flagged,
      });
    }
    dispatch({ type: "set-answers", answers: m });
    // If the student already has answers, they're mid-attempt — jump them
    // straight to the attempt stage. The mobile equivalent flow does the
    // same. Fresh starts stay on intro until the explicit Start tap.
    if (m.size > 0) {
      dispatch({ type: "set-stage", stage: "attempt" });
    }
  }, [startState.data]);

  // Result-stage hook — disjoint query identity from attempt-stage to avoid
  // is_correct cache leaks. Only mounts when we're navigating into solutions.
  const resultLazy = useQuizAttemptResult(
    state.stage === "solution" && solutionAttemptId ? solutionAttemptId : null,
  );

  const data = startState.data;
  const questions = useMemo(() => data?.questions ?? [], [data?.questions]);
  const totalQ = questions.length;
  const currentQuestion = questions[state.currentIndex];

  const statuses: QuestionStatus[] = useMemo(
    () => computeStatuses(questions, state.answers),
    [questions, state.answers],
  );

  const answeredCount = useMemo(
    () => countAnswered(state.answers),
    [state.answers],
  );
  const flaggedCount = useMemo(
    () => countFlagged(state.answers),
    [state.answers],
  );
  const unansweredList = useMemo(
    () => unansweredIndices(questions, state.answers),
    [questions, state.answers],
  );

  const onSelectOption = (questionId: string, optionId: string) => {
    dispatch({
      type: "update-answer",
      questionId,
      patch: { selected_option_id: optionId },
    });
    autoSave.enqueue({
      question_id: questionId,
      selected_option_id: optionId,
      is_flagged: state.answers.get(questionId)?.is_flagged ?? false,
    });
  };

  const onClearOption = (questionId: string) => {
    const cur = state.answers.get(questionId);
    dispatch({
      type: "update-answer",
      questionId,
      patch: { selected_option_id: null },
    });
    autoSave.enqueue({
      question_id: questionId,
      selected_option_id: null,
      is_flagged: cur?.is_flagged ?? false,
    });
  };

  const onToggleFlag = (questionId: string) => {
    const cur = state.answers.get(questionId);
    const next = !cur?.is_flagged;
    dispatch({
      type: "update-answer",
      questionId,
      patch: { is_flagged: next },
    });
    autoSave.enqueue({
      question_id: questionId,
      selected_option_id: cur?.selected_option_id ?? null,
      is_flagged: next,
    });
  };

  const submit = async (auto = false) => {
    if (!attemptId) return;
    setConfirmOpen(false);
    await autoSave.flush();
    const r = await submitState.submit(attemptId);
    if (r) {
      setSubmitResult(r);
      dispatch({ type: "set-stage", stage: "result" });
      if (auto) autoSubmittedRef.current = true;
    }
  };

  const onTimerExpired = () => {
    setExpired(true);
    if (autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;
    void submit(true);
  };

  const openSolutions = (attempt: QuizSubmitResponse) => {
    setSolutionAttemptId(attempt.attempt_id);
    dispatch({ type: "set-stage", stage: "solution" });
  };

  if (startState.isLoading && !data) {
    return (
      <div className="grid min-h-svh place-items-center bg-slate-50">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }
  if (startState.error && !data) {
    return (
      <div className="mx-auto max-w-md p-6">
        <h1 className="mb-2 text-lg font-bold text-red-700">
          Couldn&apos;t open quiz
        </h1>
        <p className="mb-4 text-sm text-slate-600">{startState.error}</p>
        <Button onClick={() => void startState.load()}>Retry</Button>
        <Button
          variant="ghost"
          className="ml-2"
          onClick={() => router.push("/library")}
        >
          Back
        </Button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mx-auto max-w-md p-6 text-sm text-slate-500">
        Quiz not available.
      </div>
    );
  }

  // ===== Intro =====
  if (state.stage === "intro") {
    return (
      <div className="min-h-svh bg-slate-50">
        <header className="flex items-center px-5 pt-4">
          <button
            type="button"
            aria-label="Close"
            onClick={() => router.push("/library")}
            className="flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
          >
            <X className="size-4" />
          </button>
        </header>
        <main className="mx-auto max-w-2xl px-5 pb-12 pt-4">
          <h1 className="text-2xl font-extrabold text-blue-900">
            {data.quiz.title}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {totalQ} question{totalQ === 1 ? "" : "s"} · {data.duration_min} min
          </p>
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
            <Row label="Correct" value={`+${data.marks_correct}`} />
            <Row label="Wrong" value={`${data.marks_wrong}`} />
            <Row label="Skip" value={`${data.marks_skip}`} />
            <Row
              label="Total possible"
              value={`${totalQ * data.marks_correct}`}
            />
          </div>
          <Button
            className="mt-6 w-full bg-primary py-6 text-base font-bold"
            data-testid="quiz-start"
            onClick={() => dispatch({ type: "set-stage", stage: "attempt" })}
          >
            Start Quiz
          </Button>
          <p className="mt-3 text-center text-xs text-slate-500">
            Auto-saves every action. You can refresh or leave and come back.
          </p>
        </main>
      </div>
    );
  }

  // ===== Result =====
  if (state.stage === "result" && submitResult) {
    const pct = submitResult.max_score > 0
      ? Math.round((submitResult.score / submitResult.max_score) * 100)
      : 0;
    return (
      <div className="min-h-svh bg-slate-50">
        <header className="flex items-center px-5 pt-4">
          <button
            type="button"
            aria-label="Close"
            onClick={() => router.push("/library")}
            className="flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
          >
            <X className="size-4" />
          </button>
        </header>
        <main className="mx-auto max-w-2xl px-5 pb-12 pt-2">
          <h1 className="text-center text-2xl font-extrabold text-blue-900">
            Result
          </h1>
          <div
            className="mt-6 rounded-2xl border border-slate-200 bg-white p-6"
            data-testid="quiz-result"
          >
            <div className="text-center">
              <p className="text-5xl font-extrabold text-blue-700">
                {Math.round(submitResult.score)}
                <span className="text-2xl text-slate-400">
                  {" "}/ {Math.round(submitResult.max_score)}
                </span>
              </p>
              <p className="mt-1 text-sm text-slate-500">{pct}%</p>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2">
              <Stat label="Correct" value={submitResult.correct_count} tone="emerald" />
              <Stat label="Wrong" value={submitResult.wrong_count} tone="red" />
              <Stat label="Skipped" value={submitResult.skipped_count} tone="slate" />
            </div>
          </div>
          <Button
            className="mt-6 w-full bg-primary py-6 text-base font-bold"
            data-testid="review-solutions"
            onClick={() => openSolutions(submitResult)}
          >
            Review solutions
          </Button>
          <Button
            variant="outline"
            className="mt-3 w-full py-6 text-base font-bold"
            onClick={() => {
              setSubmitResult(null);
              autoSubmittedRef.current = false;
              setExpired(false);
              dispatch({ type: "reset", nextStage: "intro" });
              void startState.load();
            }}
          >
            Retake
          </Button>
          <Button
            variant="ghost"
            className="mt-2 w-full"
            onClick={() => router.push("/library")}
          >
            Back to Library
          </Button>
        </main>
      </div>
    );
  }

  // ===== Solution =====
  if (state.stage === "solution") {
    const payload = submitResult ?? resultLazy.data;
    return (
      <div className="min-h-svh bg-slate-50">
        <header className="flex items-center gap-3 px-5 pt-4">
          <button
            type="button"
            aria-label="Back"
            onClick={() => dispatch({ type: "set-stage", stage: "result" })}
            className="flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
          >
            <ChevronLeft className="size-4" />
          </button>
          <h1 className="text-lg font-bold text-blue-900">Solutions</h1>
        </header>
        <main className="mx-auto max-w-2xl px-5 pb-12 pt-2">
          {resultLazy.isLoading && !payload ? (
            <div className="grid place-items-center py-12">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
          ) : payload ? (
            <div className="space-y-4" data-testid="solution-list">
              {payload.questions.map((q, i) => (
                <SolutionCard
                  key={q.id}
                  index={i}
                  total={payload.questions.length}
                  q={q}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-red-600">
              {resultLazy.error ?? "No data."}
            </p>
          )}
        </main>
      </div>
    );
  }

  // ===== Attempt (default) =====
  const cur = currentQuestion;
  const curAns = cur ? state.answers.get(cur.id) : undefined;
  return (
    <div className="flex min-h-svh flex-col bg-slate-50">
      <header className="flex items-center gap-3 px-5 pt-4">
        <button
          type="button"
          aria-label="Exit quiz"
          onClick={() => router.push("/library")}
          className="flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
        >
          <X className="size-4" />
        </button>
        <h1
          className="min-w-0 flex-1 truncate text-base font-bold text-blue-900"
          title={data.quiz.title}
        >
          {data.quiz.title}
        </h1>
        <TimerPill
          deadlineAt={data.deadline_at}
          serverNow={data.server_now}
          onExpire={onTimerExpired}
        />
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-44 pt-3">
        {cur ? (
          <>
            <QuestionCard
              index={state.currentIndex}
              total={totalQ}
              prompt_md={cur.prompt_md}
              prompt_image_url={cur.prompt_image_url}
              difficulty={cur.difficulty}
            />
            <div className="mt-4 space-y-2" role="radiogroup">
              {cur.options.map((o, i) => {
                const selected = curAns?.selected_option_id === o.id;
                const status: OptionStatus = selected ? "selected" : "default";
                return (
                  <OptionRadio
                    key={o.id}
                    letter={LETTERS[i] ?? String(i + 1)}
                    text_md={o.text_md}
                    image_url={o.image_url}
                    status={status}
                    onClick={() => onSelectOption(cur.id, o.id)}
                  />
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <FlagButton
                flagged={!!curAns?.is_flagged}
                onToggle={() => onToggleFlag(cur.id)}
              />
              {curAns?.selected_option_id ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
                  onClick={() => onClearOption(cur.id)}
                >
                  <RotateCcw className="size-3.5" /> Clear
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </main>
      <NavigationGrid
        total={totalQ}
        currentIndex={state.currentIndex}
        statuses={statuses}
        onJump={handleJump}
      />
      <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-5 py-3">
        <Button
          variant="outline"
          disabled={state.currentIndex === 0}
          onClick={() =>
            dispatch({
              type: "set-index",
              index: Math.max(0, state.currentIndex - 1),
            })
          }
        >
          <ChevronLeft className="mr-1 size-4" />
          Prev
        </Button>
        <p className="hidden text-xs text-slate-500 sm:block">
          Answered {answeredCount}/{totalQ}
          {flaggedCount > 0 ? ` · ${flaggedCount} flagged` : ""}
        </p>
        {state.currentIndex < totalQ - 1 && !expired ? (
          <Button
            onClick={() =>
              dispatch({
                type: "set-index",
                index: Math.min(totalQ - 1, state.currentIndex + 1),
              })
            }
          >
            Next <ChevronRight className="ml-1 size-4" />
          </Button>
        ) : (
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            data-testid="quiz-submit"
            onClick={() => setConfirmOpen(true)}
          >
            Submit
          </Button>
        )}
      </div>
      <SubmitConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        answeredCount={answeredCount}
        total={totalQ}
        flaggedCount={flaggedCount}
        unansweredIndices={unansweredList}
        isSubmitting={submitState.isSubmitting}
        variant="quiz"
        onConfirm={() => void submit(false)}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900 tabular-nums">{value}</span>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "red" | "slate";
}) {
  const color =
    tone === "emerald"
      ? "text-emerald-600"
      : tone === "red"
        ? "text-red-600"
        : "text-slate-500";
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center">
      <p className={`text-2xl font-extrabold tabular-nums ${color}`}>{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
    </div>
  );
}
