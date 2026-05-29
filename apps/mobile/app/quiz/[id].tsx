// Phase 6 — student quiz attempt + solution screen.
//
// Top-level Stack route (outside the (student) tab group) per D-157 / D-169:
// the tab bar would waste vertical space in a long question card. Layout:
//   stage = "intro"    — quiz title + rules + start button
//   stage = "attempt"  — question + options + timer + nav grid
//   stage = "result"   — score breakdown
//   stage = "solution" — per-question solution cards
//
// Auto-save: every option select / flag toggle goes through `useQuizAutoSave`
// (debounced upsert into `quiz_answers`, RLS-permitted for student/own/active
// attempt). All grading is server-side via `quiz-submit`.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, ChevronRight, RefreshCw, X } from "lucide-react-native";
import { QuestionCard } from "@/components/quiz/QuestionCard";
import { OptionRadio, type OptionStatus } from "@/components/quiz/OptionRadio";
import { NavigationGrid, type QuestionStatus } from "@/components/quiz/NavigationGrid";
import { TimerPill } from "@/components/quiz/TimerPill";
import { FlagButton } from "@/components/quiz/FlagButton";
import { SolutionCard } from "@/components/quiz/SolutionCard";
import { useQuizStart } from "@/features/quiz/useQuizStart";
import { useQuizSubmit } from "@/features/quiz/useQuizSubmit";
import { useQuizAttemptResult } from "@/features/quiz/useQuizAttemptResult";
import { useQuizAutoSave } from "@/features/quiz/useQuizAutoSave";
import type { QuizSubmitResponse, SavedAnswer } from "@/features/quiz/types";
import { LoadingScreen } from "@/components/LoadingScreen";

type Stage = "intro" | "attempt" | "result" | "solution";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

interface AnswerLocal {
  selected_option_id: string | null;
  is_flagged: boolean;
}

export default function QuizScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const quizId = id ?? null;

  const startState = useQuizStart(quizId);
  const submitState = useQuizSubmit();

  const [stage, setStage] = useState<Stage>("intro");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Map<string, AnswerLocal>>(new Map());
  const [submitResult, setSubmitResult] = useState<QuizSubmitResponse | null>(null);
  const [solutionAttemptId, setSolutionAttemptId] = useState<string | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [expired, setExpired] = useState(false);
  const autoSubmittedRef = useRef(false);

  const attemptId = startState.data?.attempt_id ?? null;
  const autoSave = useQuizAutoSave({ attemptId });
  const resultLazy = useQuizAttemptResult(
    stage === "solution" && solutionAttemptId ? solutionAttemptId : null,
  );

  // Initialise answers state from saved_answers when quiz-start payload arrives.
  useEffect(() => {
    if (!startState.data) return;
    const m = new Map<string, AnswerLocal>();
    for (const a of startState.data.saved_answers as SavedAnswer[]) {
      m.set(a.question_id, {
        selected_option_id: a.selected_option_id,
        is_flagged: a.is_flagged,
      });
    }
    setAnswers(m);
  }, [startState.data]);

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

  const submitNow = async (auto = false) => {
    if (!attemptId) return;
    setConfirmSubmit(false);
    await autoSave.flush();
    const r = await submitState.submit(attemptId);
    if (r) {
      setSubmitResult(r);
      setStage("result");
      if (auto) autoSubmittedRef.current = true;
    } else {
      Alert.alert(
        "Submit failed",
        submitState.error ?? "Please retry.",
      );
    }
  };

  const onTimerExpired = () => {
    // Surface a Submit button on every question once time is up, so a failed
    // auto-submit (network error) doesn't strand the student mid-quiz.
    setExpired(true);
    if (autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;
    void submitNow(true);
  };

  const openSolutionView = (attempt: QuizSubmitResponse) => {
    setSolutionAttemptId(attempt.attempt_id);
    setStage("solution");
  };

  // ---- Loading / error guards ----
  if (!quizId) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <Text className="m-6 text-red-600">Missing quiz id.</Text>
      </SafeAreaView>
    );
  }
  if (startState.isLoading && !startState.data) {
    return <LoadingScreen />;
  }
  if (startState.error && !startState.data) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View className="m-6">
          <Text className="text-red-600 mb-3">{startState.error}</Text>
          <Pressable onPress={() => void startState.load()} className="bg-blue-600 px-4 py-2 rounded-xl self-start">
            <Text className="text-white font-semibold">Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }
  if (!startState.data) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <Text className="m-6 text-slate-700">Quiz not available.</Text>
      </SafeAreaView>
    );
  }

  const data = startState.data;
  const totalQ = questions.length;
  const answeredCount = Array.from(answers.values()).filter((a) => a.selected_option_id !== null).length;
  const flaggedCount = Array.from(answers.values()).filter((a) => a.is_flagged).length;

  // ---- Intro stage ----
  if (stage === "intro") {
    return (
      <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
        <View className="flex-row items-center px-5 pt-3 pb-2">
          <Pressable accessibilityLabel="Close" onPress={() => router.back()} className="w-9 h-9 items-center justify-center rounded-full bg-white border border-slate-200">
            <X size={20} color="#0f172a" />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text className="text-2xl font-extrabold text-blue-900">{data.quiz.title}</Text>
          <Text className="text-slate-600 mt-1">
            {totalQ} question{totalQ === 1 ? "" : "s"} · {data.duration_min} min
          </Text>
          <View className="bg-white rounded-2xl p-4 border border-slate-200 mt-5">
            <Row label="Correct" value={`+${data.marks_correct}`} />
            <Row label="Wrong" value={`${data.marks_wrong}`} />
            <Row label="Skip" value={`${data.marks_skip}`} />
            <Row label="Total possible" value={`${totalQ * data.marks_correct}`} />
          </View>
          <Pressable
            onPress={() => setStage("attempt")}
            className="bg-blue-600 rounded-2xl py-4 mt-6 items-center"
          >
            <Text className="text-white font-bold text-base">Start Quiz</Text>
          </Pressable>
          <Text className="text-xs text-slate-500 mt-3 text-center">
            Auto-saves every action. You can leave and come back.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ---- Result stage ----
  if (stage === "result" && submitResult) {
    const pct = submitResult.max_score > 0
      ? Math.round((submitResult.score / submitResult.max_score) * 100)
      : 0;
    return (
      <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text className="text-2xl font-extrabold text-blue-900 text-center">Result</Text>
          <View className="bg-white rounded-2xl p-6 border border-slate-200 mt-6 items-center">
            <Text className="text-5xl font-extrabold text-blue-700">
              {Math.round(submitResult.score)}
              <Text className="text-2xl text-slate-400"> / {Math.round(submitResult.max_score)}</Text>
            </Text>
            <Text className="text-slate-500 mt-1">{pct}%</Text>
            <View className="flex-row mt-6 w-full justify-around">
              <Stat label="Correct" value={submitResult.correct_count} color="#16a34a" />
              <Stat label="Wrong" value={submitResult.wrong_count} color="#dc2626" />
              <Stat label="Skipped" value={submitResult.skipped_count} color="#64748b" />
            </View>
          </View>
          <Pressable
            onPress={() => openSolutionView(submitResult)}
            className="bg-blue-600 rounded-2xl py-4 mt-6 items-center"
          >
            <Text className="text-white font-bold text-base">View Solutions</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setSubmitResult(null);
              setAnswers(new Map());
              setCurrentQ(0);
              autoSubmittedRef.current = false;
              setExpired(false);
              void startState.load();
              setStage("intro");
            }}
            className="bg-slate-100 rounded-2xl py-4 mt-3 items-center border border-slate-200"
          >
            <Text className="text-slate-700 font-bold text-base">Retake</Text>
          </Pressable>
          <Pressable
            onPress={() => router.back()}
            className="py-3 mt-2 items-center"
          >
            <Text className="text-slate-500">Back to Library</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ---- Solution stage ----
  if (stage === "solution") {
    const payload = submitResult ?? resultLazy.data;
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
        {resultLazy.isLoading && !payload ? (
          <LoadingScreen background="bg-transparent" />
        ) : payload ? (
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            {payload.questions.map((q, i) => (
              <SolutionCard key={q.id} index={i} total={payload.questions.length} q={q} />
            ))}
          </ScrollView>
        ) : (
          <View className="m-6">
            <Text className="text-red-600">{resultLazy.error ?? "No data."}</Text>
          </View>
        )}
      </SafeAreaView>
    );
  }

  // ---- Attempt stage (default) ----
  const cur = currentQuestion;
  const curAns = cur ? answers.get(cur.id) : undefined;
  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 pt-3 pb-2">
        <Pressable
          accessibilityLabel="Exit quiz"
          onPress={() => router.back()}
          className="w-9 h-9 items-center justify-center rounded-full bg-white border border-slate-200"
        >
          <X size={20} color="#0f172a" />
        </Pressable>
        <Text className="font-bold text-blue-900 mx-3 flex-1" numberOfLines={1}>
          {data.quiz.title}
        </Text>
        <TimerPill
          deadlineAt={data.deadline_at}
          serverNow={data.server_now}
          onExpire={onTimerExpired}
        />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 160 }}>
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
          accessibilityLabel="Previous question"
          disabled={currentQ === 0}
          onPress={() => setCurrentQ((i) => Math.max(0, i - 1))}
          className="flex-row items-center bg-white border border-slate-200 rounded-2xl px-4 py-3"
          style={{ opacity: currentQ === 0 ? 0.5 : 1 }}
        >
          <ChevronLeft size={18} color="#0f172a" />
          <Text className="ml-1 font-semibold text-slate-800">Prev</Text>
        </Pressable>
        <View className="flex-1" />
        {currentQ < totalQ - 1 && !expired ? (
          <Pressable
            accessibilityLabel="Next question"
            onPress={() => setCurrentQ((i) => Math.min(totalQ - 1, i + 1))}
            className="flex-row items-center bg-blue-600 rounded-2xl px-4 py-3"
          >
            <Text className="mr-1 font-semibold text-white">Next</Text>
            <ChevronRight size={18} color="#ffffff" />
          </Pressable>
        ) : (
          <Pressable
            accessibilityLabel="Submit quiz"
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
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#0f172a" }}>Submit quiz?</Text>
            <Text style={{ marginTop: 8, color: "#475569" }}>
              You&apos;ve answered {answeredCount}/{totalQ}{flaggedCount > 0 ? `, flagged ${flaggedCount}` : ""}.
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
      <Text style={{ color: "#64748b" }}>{label}</Text>
      <Text style={{ color: "#0f172a", fontWeight: "600" }}>{value}</Text>
    </View>
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
