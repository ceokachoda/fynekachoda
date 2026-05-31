"use client";

// Phase 3 — student exam attempt + result screen.
//
// 5-stage state machine:
//   pre        — title + rules + countdown to starts_at. Enter Exam CTA
//                appears once the [starts_at, ends_at) window opens.
//                D-181 routing: an existing submitted attempt → result
//                (instant release) OR submitted (manual release waiting).
//   attempt    — locked UI: QuestionCard + OptionRadio + NavigationGrid +
//                TimerPill (server-anchored, D-183). Auto-save 500ms.
//                Tab-switch logging via Page Visibility API + window.blur.
//   submitted  — manual-release waiting screen (LockedResultCard).
//   result     — score breakdown + Review Solutions.
//   solution   — SolutionCard list (post-release).
//
// Locked UI rules: no side-rail (route lives outside the (protected)
// group), no text-select on the question area, context-menu disabled,
// no confetti, no animations beyond Tailwind's basic transition. Server
// is the real guard — UI lockdown is a soft deterrent.

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
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
import { TabSwitchBanner } from "@/components/exam/TabSwitchBanner";
import { LockedResultCard } from "@/components/exam/LockedResultCard";
import { useExamPreInfo } from "@/features/exams/useExamPreInfo";
import { useExamStart } from "@/features/exams/useExamStart";
import { useExamSubmit } from "@/features/exams/useExamSubmit";
import { useExamAttemptResult } from "@/features/exams/useExamAttemptResult";
import { useExamAutoSave } from "@/features/exams/useExamAutoSave";
import { useExamTabSwitchLogger } from "@/features/exams/useExamTabSwitchLogger";
import { useServerTimeOffset } from "@/features/exams/useServerTimeOffset";
import {
  computeStatuses,
  countAnswered,
  countFlagged,
  unansweredIndices,
} from "@/features/quiz/attemptHelpers";
import type {
  ExamSavedAnswer,
  ExamSubmitResponse,
  ExamSubmitResponseReleased,
} from "@/features/exams/types";

type Stage = "pre" | "attempt" | "submitted" | "result" | "solution";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

interface AnswerLocal {
  selected_option_id: string | null;
  is_flagged: boolean;
}

interface ExamState {
  stage: Stage;
  currentIndex: number;
  answers: Map<string, AnswerLocal>;
}

type ExamAction =
  | { type: "set-stage"; stage: Stage }
  | { type: "set-index"; index: number }
  | { type: "set-answers"; answers: Map<string, AnswerLocal> }
  | {
      type: "update-answer";
      questionId: string;
      patch: Partial<AnswerLocal>;
    };

function examReducer(state: ExamState, action: ExamAction): ExamState {
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
  }
}

function fmtCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const min = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  if (days > 0) return `${days}d ${hours}h ${min}m`;
  if (hours > 0) return `${hours}h ${pad(min)}m ${pad(sec)}s`;
  return `${pad(min)}m ${pad(sec)}s`;
}

function fmtIstShort(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

interface Props {
  examId: string;
}

export function ExamClient(props: Props) {
  return (
    <QueryProvider>
      <SessionProvider>
        <ExamClientInner {...props} />
      </SessionProvider>
    </QueryProvider>
  );
}

function ExamClientInner({ examId }: Props) {
  const router = useRouter();
  const preInfo = useExamPreInfo(examId);
  const startState = useExamStart(examId);
  const submitState = useExamSubmit();

  const [state, dispatch] = useReducer(examReducer, {
    stage: "pre",
    currentIndex: 0,
    answers: new Map<string, AnswerLocal>(),
  });
  const [submitResult, setSubmitResult] = useState<ExamSubmitResponse | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const autoSubmittedRef = useRef(false);

  // Stable so NavigationGrid's memoized cells don't all re-render on every
  // answer change. dispatch from useReducer is referentially stable.
  const handleJump = useCallback(
    (i: number) => dispatch({ type: "set-index", index: i }),
    [],
  );

  // D-181: re-open routing. As soon as preInfo arrives, decide where to land.
  // The decision is one-way (only ever moves AWAY from "pre"); the user can
  // navigate back to result via the X→library bounce if needed.
  const reopenAppliedRef = useRef(false);
  useEffect(() => {
    if (!preInfo.data || reopenAppliedRef.current) return;
    const a = preInfo.data.existing_attempt;
    if (!a?.submitted_at) return;
    reopenAppliedRef.current = true;
    if (preInfo.data.result_release === "instant" || preInfo.data.results_released_at) {
      dispatch({ type: "set-stage", stage: "result" });
    } else {
      dispatch({ type: "set-stage", stage: "submitted" });
    }
  }, [preInfo.data]);

  const attemptId =
    startState.data?.attempt_id ?? preInfo.data?.existing_attempt?.id ?? null;
  const autoSave = useExamAutoSave({ attemptId });
  const tabSwitch = useExamTabSwitchLogger(
    state.stage === "attempt" ? attemptId : null,
  );
  const { offsetMs, ready: offsetReady } = useServerTimeOffset(
    startState.data?.server_now ?? null,
  );

  // Hydrate saved answers on entry to the attempt stage. Also lift the
  // banner counter from whatever the server already counted (so an entered
  // attempt with a prior switch shows it from the get-go).
  useEffect(() => {
    if (!startState.data) return;
    const m = new Map<string, AnswerLocal>();
    for (const a of startState.data.saved_answers as ExamSavedAnswer[]) {
      m.set(a.question_id, {
        selected_option_id: a.selected_option_id,
        is_flagged: a.is_flagged,
      });
    }
    dispatch({ type: "set-answers", answers: m });
    dispatch({ type: "set-stage", stage: "attempt" });
    if (typeof startState.data.tab_switch_count === "number") {
      tabSwitch.setInitial(startState.data.tab_switch_count);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startState.data]);

  // Lazy result hook — only mounts when we move into submitted / result /
  // solution. Disjoint cache key from any attempt-stage data.
  const lazyResult = useExamAttemptResult(
    state.stage === "submitted" ||
      state.stage === "result" ||
      state.stage === "solution"
      ? attemptId
      : null,
  );

  // ===== Pre-stage tick =====
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (state.stage !== "pre") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [state.stage]);

  // ===== Locked UI deterrents (during attempt) =====
  useEffect(() => {
    if (state.stage !== "attempt") return;
    const onCtx = (e: MouseEvent) => e.preventDefault();
    // Disable text selection on the page during attempt — best-effort. The
    // server-side deadline + RLS is the real protection.
    document.body.classList.add("select-none");
    document.addEventListener("contextmenu", onCtx);
    return () => {
      document.body.classList.remove("select-none");
      document.removeEventListener("contextmenu", onCtx);
    };
  }, [state.stage]);

  const questions = useMemo(
    () => startState.data?.questions ?? [],
    [startState.data?.questions],
  );
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

  const submit = useCallback(
    async (auto = false) => {
      if (!attemptId) return;
      setConfirmOpen(false);
      await autoSave.flush();
      const r = await submitState.submit(attemptId);
      if (r) {
        setSubmitResult(r);
        if (r.results_released) {
          dispatch({ type: "set-stage", stage: "result" });
        } else {
          dispatch({ type: "set-stage", stage: "submitted" });
        }
        if (auto) autoSubmittedRef.current = true;
      }
    },
    [attemptId, autoSave, submitState],
  );

  const onTimerExpired = useCallback(() => {
    if (autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;
    void submit(true);
  }, [submit]);

  // Auto-flip submitted → result the moment the teacher releases (lazyResult
  // re-fetches on focus). Mirrors mobile behavior.
  useEffect(() => {
    if (state.stage !== "submitted") return;
    if (!lazyResult.data) return;
    const released =
      lazyResult.data.exam.results_released_at !== null ||
      lazyResult.data.exam.result_release === "instant";
    if (released) {
      dispatch({ type: "set-stage", stage: "result" });
    }
  }, [state.stage, lazyResult.data]);

  // Inverse guard: if we're on the result stage but nothing is released yet
  // (no submit payload AND the lazy result is locked), flip back to submitted.
  // Done in an effect — never dispatch during render.
  useEffect(() => {
    if (state.stage !== "result") return;
    const released = !!(submitResult && submitResult.results_released);
    const fallback = lazyResult.data;
    if (!released && !fallback && lazyResult.locked) {
      dispatch({ type: "set-stage", stage: "submitted" });
    }
  }, [state.stage, submitResult, lazyResult.data, lazyResult.locked]);

  // ===== Render guards =====
  if (preInfo.isLoading && !preInfo.data) {
    return (
      <div className="grid min-h-svh place-items-center bg-slate-50">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }
  if (preInfo.error && !preInfo.data) {
    return (
      <div className="mx-auto max-w-md p-6">
        <h1 className="mb-2 text-lg font-bold text-red-700">
          Couldn&apos;t open exam
        </h1>
        <p className="mb-4 text-sm text-slate-600">{preInfo.error}</p>
        <Button onClick={() => router.push("/classes")}>Back to Classes</Button>
      </div>
    );
  }
  const pre = preInfo.data;
  if (!pre) {
    return (
      <div className="mx-auto max-w-md p-6 text-sm text-slate-500">
        Exam not available.
      </div>
    );
  }

  // D-181 flicker guard: when re-entering with a submitted attempt, the
  // reopenAppliedRef useEffect dispatches the stage change AFTER the first
  // paint. Without this guard, the user would briefly see the "pre" stage's
  // Enter-Exam UI before being moved to result/submitted. Render the loader
  // for that frame instead.
  if (state.stage === "pre" && pre.existing_attempt?.submitted_at) {
    return (
      <div className="grid min-h-svh place-items-center bg-slate-50">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  // ===== Pre =====
  if (state.stage === "pre") {
    const startsAtMs = new Date(pre.starts_at).getTime();
    const endsAtMs = startsAtMs + pre.duration_min * 60_000;
    const isLive = now >= startsAtMs && now < endsAtMs;
    const isEnded = now >= endsAtMs;
    const isWaiting = now < startsAtMs;
    return (
      <div className="min-h-svh bg-slate-50">
        <header className="flex items-center px-5 pt-4">
          <button
            type="button"
            aria-label="Close"
            onClick={() => router.push("/classes")}
            className="flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
          >
            <X className="size-4" />
          </button>
        </header>
        <main className="mx-auto max-w-2xl px-5 pb-12 pt-4">
          <h1 className="text-2xl font-extrabold text-blue-900">{pre.title}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {fmtIstShort(pre.starts_at)} · {pre.duration_min} min ·{" "}
            {pre.question_count} questions
          </p>
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="mb-2 text-sm font-bold text-blue-900">Rules</p>
            <ul className="space-y-2 text-sm text-slate-700">
              <Rule>Server clock decides. Changing your device clock won&apos;t buy you extra time.</Rule>
              <Rule>Leaving this tab is LOGGED (counter visible to your teacher). No auto-submit on tab switch.</Rule>
              <Rule>Auto-saves as you answer. You can refresh and resume in place — same remaining time.</Rule>
              <Rule>
                Results are{" "}
                {pre.result_release === "instant"
                  ? "shown immediately on submit"
                  : "released by your teacher"}
                .
              </Rule>
            </ul>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-center">
            {isWaiting ? (
              <>
                <p className="text-sm text-slate-500">Starts in</p>
                <p
                  className="mt-1 text-3xl font-extrabold tabular-nums text-blue-700"
                  data-testid="pre-countdown"
                >
                  {fmtCountdown(startsAtMs - now)}
                </p>
                <Button disabled className="mt-5 w-full py-6 text-base font-bold">
                  Enter Exam
                </Button>
              </>
            ) : isLive ? (
              <>
                <div className="flex items-center justify-center gap-2">
                  <span className="inline-block size-2.5 rounded-full bg-red-500" />
                  <p className="font-bold text-red-600">Live now</p>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Window closes in {fmtCountdown(endsAtMs - now)}
                </p>
                <Button
                  className="mt-5 w-full bg-primary py-6 text-base font-bold"
                  data-testid="exam-enter"
                  onClick={() => void startState.load()}
                  disabled={startState.isLoading}
                >
                  {startState.isLoading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Starting…
                    </>
                  ) : (
                    "Enter Exam"
                  )}
                </Button>
                {startState.error ? (
                  <p className="mt-2 text-xs text-red-600">{startState.error}</p>
                ) : null}
              </>
            ) : isEnded ? (
              <>
                <p className="text-sm text-slate-500">This exam has ended.</p>
                {pre.existing_attempt ? (
                  <Button
                    className="mt-4 w-full bg-primary py-6 text-base font-bold"
                    onClick={() =>
                      dispatch({
                        type: "set-stage",
                        stage:
                          pre.result_release === "instant"
                            ? "result"
                            : "submitted",
                      })
                    }
                  >
                    View Result
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        </main>
      </div>
    );
  }

  // ===== Submitted (waiting for teacher release) =====
  if (state.stage === "submitted") {
    return (
      <div className="min-h-svh bg-slate-50">
        <header className="flex items-center px-5 pt-4">
          <button
            type="button"
            aria-label="Close"
            onClick={() => router.push("/classes")}
            className="flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
          >
            <X className="size-4" />
          </button>
        </header>
        <main className="mx-auto max-w-2xl px-5 pb-12 pt-4">
          <LockedResultCard
            submittedAt={pre.existing_attempt?.submitted_at ?? submitResult?.submitted_at ?? null}
            tabSwitchCount={
              submitResult?.tab_switch_count ?? lazyResult.data?.tab_switch_count
            }
            refreshing={lazyResult.isLoading}
            onRefresh={() => void lazyResult.reload()}
          />
        </main>
      </div>
    );
  }

  // ===== Result =====
  if (state.stage === "result") {
    const released =
      submitResult && submitResult.results_released
        ? (submitResult as ExamSubmitResponseReleased)
        : null;
    const fallback = lazyResult.data;
    if (!released && !fallback) {
      // Either still loading, or locked (teacher hasn't released). The effect
      // above flips a locked attempt back to "submitted" after paint; show the
      // loader for that frame instead of dispatching during render.
      return (
        <div className="grid min-h-svh place-items-center bg-slate-50">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      );
    }
    const score = released ? released.score : fallback?.score ?? 0;
    const maxScore = released ? released.max_score : fallback?.max_score ?? 0;
    const correct = released ? released.correct_count : fallback?.correct_count ?? 0;
    const wrong = released ? released.wrong_count : fallback?.wrong_count ?? 0;
    const skipped = released ? released.skipped_count : fallback?.skipped_count ?? 0;
    const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    return (
      <div className="min-h-svh bg-slate-50">
        <header className="flex items-center px-5 pt-4">
          <button
            type="button"
            aria-label="Close"
            onClick={() => router.push("/classes")}
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
            data-testid="exam-result"
          >
            <div className="text-center">
              <p className="text-5xl font-extrabold text-blue-700">
                {Math.round(score)}
                <span className="text-2xl text-slate-400"> / {Math.round(maxScore)}</span>
              </p>
              <p className="mt-1 text-sm text-slate-500">{pct}%</p>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2">
              <Stat label="Correct" value={correct} tone="emerald" />
              <Stat label="Wrong" value={wrong} tone="red" />
              <Stat label="Skipped" value={skipped} tone="slate" />
            </div>
          </div>
          <Button
            className="mt-6 w-full bg-primary py-6 text-base font-bold"
            data-testid="exam-review-solutions"
            onClick={() => dispatch({ type: "set-stage", stage: "solution" })}
          >
            Review solutions
          </Button>
          <Button
            variant="ghost"
            className="mt-2 w-full"
            onClick={() => router.push("/classes")}
          >
            Back to Classes
          </Button>
        </main>
      </div>
    );
  }

  // ===== Solution =====
  if (state.stage === "solution") {
    const payload = lazyResult.data;
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
          {lazyResult.isLoading && !payload ? (
            <div className="grid place-items-center py-12">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
          ) : payload ? (
            <div className="space-y-4">
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
              {lazyResult.error ?? "No data."}
            </p>
          )}
        </main>
      </div>
    );
  }

  // ===== Attempt (default) =====
  const data = startState.data;
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
        <h1 className="mb-2 text-lg font-bold text-red-700">Couldn&apos;t enter exam</h1>
        <p className="mb-4 text-sm text-slate-600">{startState.error}</p>
        <Button onClick={() => void startState.load()}>Retry</Button>
        <Button
          variant="ghost"
          className="ml-2"
          onClick={() => router.push("/classes")}
        >
          Back
        </Button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="grid min-h-svh place-items-center bg-slate-50">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  const cur = currentQuestion;
  const curAns = cur ? state.answers.get(cur.id) : undefined;
  return (
    <div className="flex min-h-svh flex-col bg-slate-50">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-5 py-3">
        <button
          type="button"
          aria-label="Exit exam"
          onClick={() => router.push("/classes")}
          className="flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
          title="Leaving counts as a tab switch"
        >
          <X className="size-4" />
        </button>
        <h1
          className="min-w-0 flex-1 truncate text-base font-bold text-blue-900"
          title={data.exam.title}
        >
          {data.exam.title}
        </h1>
        {offsetReady ? (
          <TimerPill
            deadlineAt={data.deadline_at}
            serverNow={data.server_now}
            offsetMs={offsetMs}
            onExpire={onTimerExpired}
          />
        ) : (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-sm font-bold tabular-nums text-slate-500"
            aria-label="Syncing server time"
          >
            <Clock className="size-3.5" />
            --:--
          </span>
        )}
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 select-none px-5 pb-44 pt-3">
        <TabSwitchBanner count={tabSwitch.count} />
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
        {state.currentIndex < totalQ - 1 ? (
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
            data-testid="exam-submit"
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
        variant="exam"
        onConfirm={() => void submit(false)}
      />
    </div>
  );
}

function Rule({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-primary" />
      <span className="text-sm leading-snug text-slate-700">{children}</span>
    </li>
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
