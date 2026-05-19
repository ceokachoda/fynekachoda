// Phase 7 — student exam attempt screen (top-level per D-169).
//
// Stages:
//   pre        — title + rules + countdown to starts_at; "Enter Exam" CTA.
//                Visible 24h before start (gate enforced by RLS list + edge fn).
//   attempt    — locked-down UI: question card + options + Q-grid + timer.
//                AppState listener bumps tab_switch_count via exam-tab-switch
//                fire-and-forget. Auto-save via PostgREST upsert. Submit on
//                timer expiry or user tap.
//   submitted  — short confirmation when result_release='manual' AND not yet
//                released. Replaces with results once results_released_at flips.
//   result     — score breakdown.
//   solution   — per-question solution cards (fetched on demand via
//                exam-attempt-result for fresh signed image URLs).
//
// Important: NO Reanimated, NO charts, NO animations — exam screen perf
// budget per CLAUDE.md ("Exam screen: no Reanimated, no charts, no images
// outside questions").

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, ChevronRight, RefreshCw, X } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { QuestionCard } from "@/components/quiz/QuestionCard";
import { OptionRadio, type OptionStatus } from "@/components/quiz/OptionRadio";
import { NavigationGrid, type QuestionStatus } from "@/components/quiz/NavigationGrid";
import { TimerPill } from "@/components/quiz/TimerPill";
import { FlagButton } from "@/components/quiz/FlagButton";
import { SolutionCard } from "@/components/quiz/SolutionCard";
import { TabSwitchBanner } from "@/components/exam/TabSwitchBanner";
import { useExamStart } from "@/features/exam/useExamStart";
import { useExamSubmit } from "@/features/exam/useExamSubmit";
import { useExamAttemptResult } from "@/features/exam/useExamAttemptResult";
import { useExamAutoSave } from "@/features/exam/useExamAutoSave";
import { useExamTabSwitchLogger } from "@/features/exam/useExamTabSwitchLogger";
import type {
  ExamSavedAnswer,
  ExamSubmitResponse,
  ExamSubmitResponseReleased,
} from "@/features/exam/types";

type Stage = "pre" | "attempt" | "submitted" | "result" | "solution";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

interface AnswerLocal {
  selected_option_id: string | null;
  is_flagged: boolean;
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
  if (hours > 0) return `${hours}h ${min}m ${pad(sec)}s`;
  return `${min}m ${pad(sec)}s`;
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

export default function ExamScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const examId = id ?? null;

  // Pre-attempt header info (loaded directly from `exams` because exam-start
  // refuses to fire until starts_at passes — but the student is in scope so
  // RLS lets us read the row).
  const [preInfo, setPreInfo] = useState<{
    title: string;
    starts_at: string;
    duration_min: number;
    result_release: "manual" | "instant";
    question_count: number;
    existing_attempt: {
      id: string;
      submitted_at: string | null;
    } | null;
  } | null>(null);
  const [preError, setPreError] = useState<string | null>(null);

  const [stage, setStage] = useState<Stage>("pre");
  const [now, setNow] = useState<number>(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadPre = useCallback(async () => {
    if (!examId) return;
    setPreError(null);
    const res = await supabase
      .from("exams")
      .select(
        "id, title, starts_at, duration_min, result_release, exam_questions(count), exam_attempts(id, submitted_at, student_id)",
      )
      .eq("id", examId)
      .maybeSingle();
    if (res.error || !res.data) {
      setPreError(res.error?.message ?? "Exam not visible to you.");
      return;
    }
    const r = res.data as Record<string, unknown>;
    const { data: sess } = await supabase.auth.getUser();
    const myAuthId = sess.user?.id;
    let mine: { id: string; submitted_at: string | null } | null = null;
    if (myAuthId) {
      // Map auth_user_id → app_users.id.
      const me = await supabase
        .from("app_users")
        .select("id")
        .eq("auth_user_id", myAuthId)
        .maybeSingle();
      const myId = me.data?.id as string | undefined;
      if (myId) {
        const attempts = (r.exam_attempts ?? []) as Array<{
          id: string;
          submitted_at: string | null;
          student_id: string;
        }>;
        const m = attempts.find((a) => a.student_id === myId) ?? null;
        if (m) mine = { id: m.id, submitted_at: m.submitted_at };
      }
    }
    setPreInfo({
      title: r.title as string,
      starts_at: r.starts_at as string,
      duration_min: r.duration_min as number,
      result_release: r.result_release as "manual" | "instant",
      question_count:
        ((r.exam_questions as Array<{ count: number }> | null) ?? [])[0]?.count ??
        0,
      existing_attempt: mine,
    });
    // If the student has a SUBMITTED attempt, jump straight to submitted/
    // result screen.
    if (mine?.submitted_at) {
      setStage("submitted");
    }
  }, [examId]);

  useEffect(() => {
    void loadPre();
  }, [loadPre]);
  useFocusEffect(
    useCallback(() => {
      void loadPre();
    }, [loadPre]),
  );

  // Lazy-init the attempt only when student taps "Enter Exam" (or auto on
  // re-entry to an in-flight attempt).
  const [didStart, setDidStart] = useState(false);
  const startState = useExamStart(didStart ? examId : null);
  const submitState = useExamSubmit();
  const attemptId = startState.data?.attempt_id ?? null;
  const autoSave = useExamAutoSave({ attemptId });
  const tabSwitch = useExamTabSwitchLogger(stage === "attempt" ? attemptId : null);

  // Sync initial tab-switch count from server payload.
  useEffect(() => {
    if (startState.data?.tab_switch_count !== undefined) {
      tabSwitch.setInitial(startState.data.tab_switch_count);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startState.data?.tab_switch_count]);

  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Map<string, AnswerLocal>>(new Map());
  const [submitResult, setSubmitResult] =
    useState<ExamSubmitResponse | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const autoSubmittedRef = useRef(false);

  useEffect(() => {
    if (!startState.data) return;
    const m = new Map<string, AnswerLocal>();
    for (const a of startState.data.saved_answers as ExamSavedAnswer[]) {
      m.set(a.question_id, {
        selected_option_id: a.selected_option_id,
        is_flagged: a.is_flagged,
      });
    }
    setAnswers(m);
    setStage("attempt");
  }, [startState.data]);

  const lazyResult = useExamAttemptResult(
    (stage === "solution" || (stage === "submitted" && preInfo?.existing_attempt && !submitResult))
      ? preInfo?.existing_attempt?.id ?? attemptId
      : null,
  );

  const questions = startState.data?.questions ?? [];
  const currentQuestion = questions[currentQ];

  const statuses: QuestionStatus[] = useMemo(() => {
    return questions.map((q) => {
      const a = answers.get(q.id);
      const answered = !!a?.selected_option_id;
      const flagged = !!a?.is_flagged;
      if (flagged && answered) return "flagged_answered";
      if (flagged) return "flagged_unanswered";
      if (answered) return "answered";
      return "unanswered";
    });
  }, [questions, answers]);

  const onSelectOption = (questionId: string, optionId: string) => {
    setAnswers((prev) => {
      const next = new Map(prev);
      const cur = next.get(questionId) ?? { selected_option_id: null, is_flagged: false };
      const upd = { ...cur, selected_option_id: optionId };
      next.set(questionId, upd);
      autoSave.enqueue({
        question_id: questionId,
        selected_option_id: optionId,
        is_flagged: upd.is_flagged,
      });
      return next;
    });
  };

  const onToggleFlag = (questionId: string) => {
    setAnswers((prev) => {
      const next = new Map(prev);
      const cur = next.get(questionId) ?? { selected_option_id: null, is_flagged: false };
      const upd = { ...cur, is_flagged: !cur.is_flagged };
      next.set(questionId, upd);
      autoSave.enqueue({
        question_id: questionId,
        selected_option_id: upd.selected_option_id,
        is_flagged: upd.is_flagged,
      });
      return next;
    });
  };

  const submitNow = async (auto: boolean) => {
    if (!attemptId) return;
    setConfirmSubmit(false);
    await autoSave.flush();
    const r = await submitState.submit(attemptId);
    if (r) {
      setSubmitResult(r);
      if (r.results_released) setStage("result");
      else setStage("submitted");
      if (auto) autoSubmittedRef.current = true;
    } else {
      Alert.alert("Submit failed", submitState.error ?? "Please retry.");
    }
  };

  // ---- Pre stage ----
  if (!examId) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <Text className="m-6 text-red-600">Missing exam id.</Text>
      </SafeAreaView>
    );
  }

  if (stage === "pre") {
    if (preError) {
      return (
        <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
          <View className="m-6">
            <Text className="text-red-600 mb-3">{preError}</Text>
            <Pressable
              onPress={() => router.back()}
              className="bg-blue-600 px-4 py-2 rounded-xl self-start"
            >
              <Text className="text-white font-semibold">Back</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }
    if (!preInfo) {
      return (
        <SafeAreaView className="flex-1 bg-white items-center justify-center" edges={["top"]}>
          <ActivityIndicator size="large" color="#2563EB" />
        </SafeAreaView>
      );
    }
    const startsAtMs = new Date(preInfo.starts_at).getTime();
    const endsAtMs = startsAtMs + preInfo.duration_min * 60_000;
    const isLive = now >= startsAtMs && now < endsAtMs;
    const isEnded = now >= endsAtMs;
    const isWaiting = now < startsAtMs;
    return (
      <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
        <View className="flex-row items-center px-5 pt-3 pb-2">
          <Pressable
            accessibilityLabel="Close"
            onPress={() => router.back()}
            className="w-9 h-9 items-center justify-center rounded-full bg-white border border-slate-200"
          >
            <X size={20} color="#0f172a" />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text className="text-2xl font-extrabold text-blue-900">{preInfo.title}</Text>
          <Text className="text-slate-600 mt-1">
            {fmtIstShort(preInfo.starts_at)} · {preInfo.duration_min} min · {preInfo.question_count} questions
          </Text>

          <View className="bg-white rounded-2xl p-4 border border-slate-200 mt-5">
            <Text className="text-base font-bold text-blue-900 mb-2">Rules</Text>
            <Bullet>Server clock decides. You can't change your phone clock to extend time.</Bullet>
            <Bullet>Leaving the app is LOGGED (counter visible to your teacher). No auto-submit.</Bullet>
            <Bullet>Auto-saves as you answer. If you re-open, you resume in place.</Bullet>
            <Bullet>
              Results are {preInfo.result_release === "instant" ? "shown immediately on submit" : "released by your teacher"}.
            </Bullet>
          </View>

          <View className="bg-white rounded-2xl p-5 border border-slate-200 mt-4 items-center">
            {isWaiting ? (
              <>
                <Text className="text-slate-500">Starts in</Text>
                <Text className="text-3xl font-extrabold text-blue-700 mt-1" style={{ fontVariant: ["tabular-nums"] }}>
                  {fmtCountdown(startsAtMs - now)}
                </Text>
                <Pressable
                  disabled
                  className="bg-slate-200 rounded-2xl py-4 mt-5 items-center w-full"
                >
                  <Text className="text-slate-500 font-bold">Enter Exam</Text>
                </Pressable>
              </>
            ) : isLive ? (
              <>
                <View className="flex-row items-center">
                  <View className="w-2.5 h-2.5 rounded-full bg-red-500 mr-2" />
                  <Text className="text-red-600 font-bold">Live now</Text>
                </View>
                <Text className="text-slate-500 mt-1">
                  Window closes in {fmtCountdown(endsAtMs - now)}
                </Text>
                <Pressable
                  onPress={() => setDidStart(true)}
                  className="bg-blue-600 rounded-2xl py-4 mt-5 items-center w-full"
                >
                  <Text className="text-white font-bold">Enter Exam</Text>
                </Pressable>
                {startState.error ? (
                  <Text className="text-red-600 mt-2 text-xs">{startState.error}</Text>
                ) : null}
              </>
            ) : isEnded ? (
              <>
                <Text className="text-slate-500">This exam has ended.</Text>
                {preInfo.existing_attempt ? (
                  <Pressable
                    onPress={() => setStage(preInfo.result_release === "instant" ? "result" : "submitted")}
                    className="bg-blue-600 rounded-2xl py-4 mt-4 items-center w-full"
                  >
                    <Text className="text-white font-bold">View Result</Text>
                  </Pressable>
                ) : null}
              </>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ---- Submitted (waiting for teacher) ----
  if (stage === "submitted") {
    const releasedNow =
      submitResult?.results_released ||
      (lazyResult.data?.exam.results_released_at !== null && !!lazyResult.data);
    if (releasedNow && lazyResult.data && !submitResult) {
      // Auto-flip to result view.
      setStage("result");
    }
    return (
      <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
        <View className="flex-row items-center px-5 pt-3 pb-2">
          <Pressable
            accessibilityLabel="Close"
            onPress={() => router.back()}
            className="w-9 h-9 items-center justify-center rounded-full bg-white border border-slate-200"
          >
            <X size={20} color="#0f172a" />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text className="text-2xl font-extrabold text-blue-900 text-center mt-10">
            Submitted
          </Text>
          <Text className="text-slate-600 text-center mt-2">
            Results will be released by your teacher.
          </Text>
          <Pressable
            onPress={() => void lazyResult.reload()}
            className="bg-slate-100 rounded-2xl py-3 mt-6 items-center border border-slate-200"
          >
            <Text className="text-slate-700 font-semibold">Check release status</Text>
          </Pressable>
          {lazyResult.locked ? (
            <Text className="text-slate-500 text-xs text-center mt-2">
              Still locked.
            </Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ---- Result ----
  if (stage === "result") {
    const released =
      submitResult && submitResult.results_released
        ? (submitResult as ExamSubmitResponseReleased)
        : null;
    const fallback = lazyResult.data;
    if (!released && !fallback) {
      return (
        <SafeAreaView className="flex-1 bg-slate-50 items-center justify-center" edges={["top"]}>
          <ActivityIndicator size="large" color="#2563EB" />
        </SafeAreaView>
      );
    }
    const score = released
      ? released.score
      : fallback?.score ?? 0;
    const maxScore = released
      ? released.max_score
      : fallback?.max_score ?? 0;
    const correct = released
      ? released.correct_count
      : fallback?.correct_count ?? 0;
    const wrong = released
      ? released.wrong_count
      : fallback?.wrong_count ?? 0;
    const skipped = released
      ? released.skipped_count
      : fallback?.skipped_count ?? 0;
    const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    return (
      <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
        <View className="flex-row items-center px-5 pt-3 pb-2">
          <Pressable
            accessibilityLabel="Close"
            onPress={() => router.back()}
            className="w-9 h-9 items-center justify-center rounded-full bg-white border border-slate-200"
          >
            <X size={20} color="#0f172a" />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text className="text-2xl font-extrabold text-blue-900 text-center">Result</Text>
          <View className="bg-white rounded-2xl p-6 border border-slate-200 mt-6 items-center">
            <Text className="text-5xl font-extrabold text-blue-700">
              {Math.round(score)}
              <Text className="text-2xl text-slate-400"> / {Math.round(maxScore)}</Text>
            </Text>
            <Text className="text-slate-500 mt-1">{pct}%</Text>
            <View className="flex-row mt-6 w-full justify-around">
              <Stat label="Correct" value={correct} color="#16a34a" />
              <Stat label="Wrong" value={wrong} color="#dc2626" />
              <Stat label="Skipped" value={skipped} color="#64748b" />
            </View>
          </View>
          <Pressable
            onPress={() => setStage("solution")}
            className="bg-blue-600 rounded-2xl py-4 mt-6 items-center"
          >
            <Text className="text-white font-bold text-base">View Solutions</Text>
          </Pressable>
          <Pressable
            onPress={() => router.back()}
            className="py-3 mt-2 items-center"
          >
            <Text className="text-slate-500">Back</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ---- Solution ----
  if (stage === "solution") {
    return (
      <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
        <View className="flex-row items-center px-5 pt-3 pb-2">
          <Pressable
            accessibilityLabel="Back"
            onPress={() => setStage("result")}
            className="w-9 h-9 items-center justify-center rounded-full bg-white border border-slate-200"
          >
            <ChevronLeft size={20} color="#0f172a" />
          </Pressable>
          <Text className="text-lg font-bold text-blue-900 ml-3 flex-1">Solutions</Text>
        </View>
        {lazyResult.isLoading && !lazyResult.data ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : lazyResult.data ? (
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            {lazyResult.data.questions.map((q, i) => (
              <SolutionCard key={q.id} index={i} total={lazyResult.data!.questions.length} q={q} />
            ))}
          </ScrollView>
        ) : (
          <View className="m-6">
            <Text className="text-red-600">{lazyResult.error ?? "No data."}</Text>
          </View>
        )}
      </SafeAreaView>
    );
  }

  // ---- Attempt (default) ----
  if (startState.isLoading && !startState.data) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center" edges={["top"]}>
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }
  if (startState.error && !startState.data) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View className="m-6">
          <Text className="text-red-600 mb-3">{startState.error}</Text>
          <Pressable
            onPress={() => void startState.load()}
            className="bg-blue-600 px-4 py-2 rounded-xl self-start"
          >
            <Text className="text-white font-semibold">Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }
  if (!startState.data) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center" edges={["top"]}>
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }
  const data = startState.data;
  const totalQ = questions.length;
  const answeredCount = Array.from(answers.values()).filter((a) => a.selected_option_id !== null).length;
  const flaggedCount = Array.from(answers.values()).filter((a) => a.is_flagged).length;
  const cur = currentQuestion;
  const curAns = cur ? answers.get(cur.id) : undefined;
  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 pt-3 pb-2">
        <Pressable
          accessibilityLabel="Exit"
          onPress={() => router.back()}
          className="w-9 h-9 items-center justify-center rounded-full bg-white border border-slate-200"
        >
          <X size={20} color="#0f172a" />
        </Pressable>
        <Text className="font-bold text-blue-900 mx-3 flex-1" numberOfLines={1}>
          {data.exam.title}
        </Text>
        <TimerPill
          deadlineAt={data.deadline_at}
          serverNow={data.server_now}
          onExpire={() => {
            if (autoSubmittedRef.current) return;
            autoSubmittedRef.current = true;
            void submitNow(true);
          }}
        />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 160 }}>
        <TabSwitchBanner count={tabSwitch.count} />
        {cur ? (
          <>
            <QuestionCard
              index={currentQ}
              total={totalQ}
              prompt_md={cur.prompt_md}
              prompt_image_url={cur.prompt_image_url}
              difficulty={cur.difficulty}
            />
            <View style={{ height: 16 }} />
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
                  onPress={() => onSelectOption(cur.id, o.id)}
                />
              );
            })}
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
              <FlagButton
                flagged={!!curAns?.is_flagged}
                onToggle={() => onToggleFlag(cur.id)}
              />
              <View style={{ flex: 1 }} />
              {curAns?.selected_option_id ? (
                <Pressable
                  onPress={() => {
                    if (!cur) return;
                    setAnswers((prev) => {
                      const next = new Map(prev);
                      const c = next.get(cur.id) ?? { selected_option_id: null, is_flagged: false };
                      const u = { ...c, selected_option_id: null };
                      next.set(cur.id, u);
                      autoSave.enqueue({
                        question_id: cur.id,
                        selected_option_id: null,
                        is_flagged: u.is_flagged,
                      });
                      return next;
                    });
                  }}
                  style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6 }}
                >
                  <RefreshCw size={14} color="#64748b" />
                  <Text style={{ color: "#64748b", marginLeft: 6 }}>Clear</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>

      <NavigationGrid
        total={totalQ}
        currentIndex={currentQ}
        statuses={statuses}
        onJump={(i) => setCurrentQ(i)}
      />

      <View className="flex-row items-center px-5 pb-3 gap-2">
        <Pressable
          accessibilityLabel="Previous"
          disabled={currentQ === 0}
          onPress={() => setCurrentQ((i) => Math.max(0, i - 1))}
          className="flex-row items-center bg-white border border-slate-200 rounded-2xl px-4 py-3"
          style={{ opacity: currentQ === 0 ? 0.5 : 1 }}
        >
          <ChevronLeft size={18} color="#0f172a" />
          <Text className="ml-1 font-semibold text-slate-800">Prev</Text>
        </Pressable>
        <View className="flex-1" />
        {currentQ < totalQ - 1 ? (
          <Pressable
            accessibilityLabel="Next"
            onPress={() => setCurrentQ((i) => Math.min(totalQ - 1, i + 1))}
            className="flex-row items-center bg-blue-600 rounded-2xl px-4 py-3"
          >
            <Text className="mr-1 font-semibold text-white">Next</Text>
            <ChevronRight size={18} color="#ffffff" />
          </Pressable>
        ) : (
          <Pressable
            accessibilityLabel="Submit exam"
            onPress={() => setConfirmSubmit(true)}
            className="bg-emerald-600 rounded-2xl px-4 py-3"
          >
            <Text className="font-bold text-white">Submit</Text>
          </Pressable>
        )}
      </View>

      <Modal transparent visible={confirmSubmit} animationType="fade" onRequestClose={() => setConfirmSubmit(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "center", paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 18, padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#0f172a" }}>Submit exam?</Text>
            <Text style={{ marginTop: 8, color: "#475569" }}>
              You've answered {answeredCount}/{totalQ}{flaggedCount > 0 ? `, flagged ${flaggedCount}` : ""}. This cannot be undone.
            </Text>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 16 }}>
              <Pressable onPress={() => setConfirmSubmit(false)} style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
                <Text style={{ color: "#64748b", fontWeight: "600" }}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={submitState.isSubmitting}
                onPress={() => void submitNow(false)}
                style={{ backgroundColor: "#059669", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginLeft: 8 }}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>
                  {submitState.isSubmitting ? "Submitting…" : "Submit"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ color, fontSize: 24, fontWeight: "800" }}>{value}</Text>
      <Text style={{ color: "#64748b", marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 6 }}>
      <Text style={{ color: "#2563EB", fontWeight: "800", marginRight: 8 }}>•</Text>
      <Text style={{ flex: 1, color: "#0f172a" }}>{children}</Text>
    </View>
  );
}
