// Phase 7 — teacher exam results board with release + regrade.
//
// Top-level Stack route per D-169. Reads via `useExamResultsBoard` (RLS
// scopes); mutations via `exam-release-results` + `exam-regrade` edge fns.

import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ListChecks,
  Megaphone,
  ShieldAlert,
} from "lucide-react-native";
import { invokeEdgeFn } from "@/lib/edge-fn";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/features/auth/network-errors";
import {
  type QuestionAnalysisRow,
  useExamResultsBoard,
} from "@/features/exam/useExamResultsBoard";

type RegradeAction = "change_correct" | "mark_no_correct" | "mark_all_correct";

interface RegradeQuestion {
  question_id: string;
  prompt_md: string;
  options: Array<{ id: string; text_md: string; is_correct: boolean; sort_order: number }>;
}

export default function ExamResultsScreen() {
  const router = useRouter();
  const { examId } = useLocalSearchParams<{ examId?: string }>();
  const id = examId ?? null;
  const board = useExamResultsBoard(id);
  const [releasing, setReleasing] = useState(false);
  const [regradeOpen, setRegradeOpen] = useState(false);
  const [regradeQuestion, setRegradeQuestion] = useState<RegradeQuestion | null>(null);
  const [regradeAction, setRegradeAction] = useState<RegradeAction>("change_correct");
  const [newCorrectId, setNewCorrectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [regrading, setRegrading] = useState(false);

  const { reload: reloadBoard } = board;
  useFocusEffect(
    useCallback(() => {
      void reloadBoard();
    }, [reloadBoard]),
  );

  const released = board.exam?.results_released_at !== null;

  const onRelease = async () => {
    if (!id) return;
    Alert.alert(
      "Release results?",
      "Students will be able to view scores + solutions immediately. This cannot be undone (admins can un-release).",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Release",
          style: "destructive",
          onPress: async () => {
            setReleasing(true);
            try {
              const { status, body } = await invokeEdgeFn<{ exam_id: string; results_released_at: string }>(
                "exam-release-results",
                { exam_id: id },
              );
              if (status === 200) {
                await board.reload();
              } else {
                Alert.alert("Release failed", `Status ${status}: ${(body as { error?: string })?.error ?? "unknown"}`);
              }
            } finally {
              setReleasing(false);
            }
          },
        },
      ],
    );
  };

  const openRegrade = async (qa: QuestionAnalysisRow) => {
    // Load full options for the question.
    const r = await withTimeout(
      supabase
        .from("question_options")
        .select("id, text_md, is_correct, sort_order")
        .eq("question_id", qa.question_id)
        .order("sort_order", { ascending: true }),
    );
    if (r.error || !r.data) {
      Alert.alert("Couldn't load options", r.error?.message ?? "no data");
      return;
    }
    setRegradeQuestion({
      question_id: qa.question_id,
      prompt_md: qa.prompt_md,
      options: r.data as Array<{ id: string; text_md: string; is_correct: boolean; sort_order: number }>,
    });
    setRegradeAction("change_correct");
    setNewCorrectId(
      (r.data as Array<{ id: string; is_correct: boolean }>).find((o) => o.is_correct)?.id ?? null,
    );
    setReason("");
    setRegradeOpen(true);
  };

  const submitRegrade = async () => {
    if (!id || !regradeQuestion) return;
    if (reason.trim().length < 3) {
      Alert.alert("Reason required", "Please write a short justification (3+ chars).");
      return;
    }
    if (regradeAction === "change_correct" && !newCorrectId) {
      Alert.alert("Pick the new correct option", "Tap one of the options before submitting.");
      return;
    }
    setRegrading(true);
    try {
      const body: Record<string, unknown> = {
        exam_id: id,
        question_id: regradeQuestion.question_id,
        action: regradeAction,
        reason: reason.trim(),
      };
      if (regradeAction === "change_correct") body.new_correct_option_id = newCorrectId;
      const { status, body: resp } = await invokeEdgeFn<{ attempts_updated: number }>(
        "exam-regrade",
        body,
      );
      if (status === 200) {
        setRegradeOpen(false);
        Alert.alert(
          "Regrade complete",
          `${(resp as { attempts_updated?: number })?.attempts_updated ?? 0} attempt(s) recomputed.`,
        );
        await board.reload();
      } else {
        Alert.alert("Regrade failed", `Status ${status}: ${(resp as { error?: string })?.error ?? "unknown"}`);
      }
    } finally {
      setRegrading(false);
    }
  };

  if (!id) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <Text className="m-6 text-red-600">Missing exam id.</Text>
      </SafeAreaView>
    );
  }
  if (board.isLoading && !board.exam) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center" edges={["top"]}>
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }
  if (board.error) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <Text className="m-6 text-red-600">{board.error}</Text>
      </SafeAreaView>
    );
  }
  if (!board.exam) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <Text className="m-6 text-slate-700">Exam not found.</Text>
      </SafeAreaView>
    );
  }

  const submittedRoster = board.roster.filter((r) => r.submitted_at !== null);

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-3 pb-2">
        <Pressable
          accessibilityLabel="Back"
          onPress={() => router.back()}
          className="w-9 h-9 items-center justify-center rounded-full bg-white border border-slate-200"
        >
          <ChevronLeft size={20} color="#0f172a" />
        </Pressable>
        <Text className="text-lg font-bold text-blue-900 ml-3 flex-1" numberOfLines={1}>
          {board.exam.title}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
        <View className="bg-white rounded-2xl p-4 border border-slate-200">
          <Text className="text-xs text-slate-500">
            {board.roster.length} attempt{board.roster.length === 1 ? "" : "s"} · {submittedRoster.length} submitted · {board.questions.length} questions
          </Text>
          <View className="flex-row items-center mt-1">
            <View
              className="w-2.5 h-2.5 rounded-full mr-2"
              style={{ backgroundColor: released ? "#059669" : "#f59e0b" }}
            />
            <Text className="text-sm font-semibold" style={{ color: released ? "#059669" : "#92400e" }}>
              {released ? `Results released ${new Date(board.exam.results_released_at!).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}` : "Results NOT released"}
            </Text>
          </View>
          {!released ? (
            <Pressable
              disabled={releasing}
              onPress={() => void onRelease()}
              className="bg-blue-600 rounded-2xl py-3 mt-3 items-center flex-row justify-center"
              style={{ opacity: releasing ? 0.6 : 1 }}
            >
              <Megaphone size={16} color="#ffffff" />
              <Text className="ml-2 text-white font-bold">
                {releasing ? "Releasing…" : "Release Results to Students"}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Text className="text-base font-bold text-blue-900 mt-5 mb-2">Roster</Text>
        {submittedRoster.length === 0 ? (
          <Text className="text-slate-500 italic">No submitted attempts yet.</Text>
        ) : (
          submittedRoster.map((r) => {
            const pct = r.score !== null && r.max_score && r.max_score > 0
              ? Math.round((r.score / r.max_score) * 100)
              : 0;
            return (
              <View key={r.attempt_id} className="bg-white rounded-2xl p-3 border border-slate-200 mb-2 flex-row items-center">
                <View className="w-9 h-9 rounded-full bg-blue-100 items-center justify-center mr-3">
                  <Text className="text-blue-700 font-bold">{r.student_name.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-slate-900 font-semibold" numberOfLines={1}>{r.student_name}</Text>
                  <Text className="text-xs text-slate-500">
                    {r.correct_count ?? 0}✓ · {r.wrong_count ?? 0}✗ · {r.skipped_count ?? 0} skipped
                    {r.auto_submitted ? "  · auto" : ""}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-lg font-extrabold text-blue-700">
                    {r.score !== null ? Math.round(r.score) : "—"}
                    <Text className="text-xs text-slate-400">/{r.max_score ? Math.round(r.max_score) : 0}</Text>
                  </Text>
                  <Text className="text-xs text-slate-500">{pct}%</Text>
                  {r.tab_switch_count > 0 ? (
                    <View className="flex-row items-center mt-0.5">
                      <ShieldAlert size={10} color={r.tab_switch_count >= 3 ? "#dc2626" : "#92400e"} />
                      <Text className="ml-1 text-xs font-bold" style={{ color: r.tab_switch_count >= 3 ? "#dc2626" : "#92400e" }}>
                        tab×{r.tab_switch_count}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })
        )}

        <Text className="text-base font-bold text-blue-900 mt-5 mb-2">Question analysis</Text>
        {board.questions.length === 0 ? (
          <Text className="text-slate-500 italic">No questions in this exam.</Text>
        ) : (
          board.questions.map((qa, i) => (
            <View key={qa.question_id} className="bg-white rounded-2xl p-3 border border-slate-200 mb-2">
              <View className="flex-row items-start">
                <Text className="text-slate-500 font-bold mr-2 mt-0.5">Q{i + 1}</Text>
                <Text className="flex-1 text-slate-800" numberOfLines={2}>{qa.prompt_md}</Text>
              </View>
              <View className="flex-row items-center mt-2">
                <View className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <View
                    style={{
                      width: `${qa.pct_correct}%`,
                      backgroundColor: qa.pct_correct >= 70 ? "#16a34a" : qa.pct_correct >= 40 ? "#f59e0b" : "#dc2626",
                      height: "100%",
                    }}
                  />
                </View>
                <Text className="text-sm font-bold ml-3 text-slate-700" style={{ width: 48, textAlign: "right" }}>
                  {qa.pct_correct}%
                </Text>
                <Pressable
                  onPress={() => void openRegrade(qa)}
                  className="ml-2 bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5"
                >
                  <Text className="text-slate-700 font-semibold text-xs">Regrade</Text>
                </Pressable>
              </View>
              <Text className="text-xs text-slate-500 mt-1">
                {qa.correct_attempts}/{qa.total_attempts} correct
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={regradeOpen}
        animationType="slide"
        onRequestClose={() => setRegradeOpen(false)}
      >
        <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
          <View className="flex-row items-center px-5 pt-3 pb-2">
            <Pressable
              accessibilityLabel="Close"
              onPress={() => setRegradeOpen(false)}
              className="w-9 h-9 items-center justify-center rounded-full bg-white border border-slate-200"
            >
              <ChevronLeft size={20} color="#0f172a" />
            </Pressable>
            <Text className="text-lg font-bold text-blue-900 ml-3 flex-1">Regrade</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
            {regradeQuestion ? (
              <>
                <Text className="text-slate-800" numberOfLines={4}>{regradeQuestion.prompt_md}</Text>
                <View className="bg-white rounded-2xl p-3 border border-slate-200 mt-3">
                  <Text className="text-xs text-slate-500 mb-2">Choose action</Text>
                  <RegradeOption
                    selected={regradeAction === "change_correct"}
                    label="Change correct option"
                    description="Pick a new correct option. Other options become wrong."
                    onPress={() => setRegradeAction("change_correct")}
                  />
                  <RegradeOption
                    selected={regradeAction === "mark_no_correct"}
                    label="Mark no correct"
                    description="Everyone gets marks_skip for this question."
                    onPress={() => setRegradeAction("mark_no_correct")}
                  />
                  <RegradeOption
                    selected={regradeAction === "mark_all_correct"}
                    label="Mark all correct"
                    description="Everyone gets full marks for this question."
                    onPress={() => setRegradeAction("mark_all_correct")}
                  />
                </View>
                {regradeAction === "change_correct" ? (
                  <View className="bg-white rounded-2xl p-3 border border-slate-200 mt-3">
                    <Text className="text-xs text-slate-500 mb-2">Pick new correct</Text>
                    {regradeQuestion.options.map((o) => {
                      const sel = newCorrectId === o.id;
                      return (
                        <Pressable
                          key={o.id}
                          onPress={() => setNewCorrectId(o.id)}
                          className="flex-row items-center py-2"
                        >
                          <View
                            className="w-5 h-5 rounded-full border-2 mr-2 items-center justify-center"
                            style={{ borderColor: sel ? "#2563EB" : "#cbd5e1" }}
                          >
                            {sel ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#2563EB" }} /> : null}
                          </View>
                          <Text className="flex-1 text-slate-900" numberOfLines={2}>{o.text_md}</Text>
                          {o.is_correct ? (
                            <View className="ml-2 bg-emerald-50 px-2 py-0.5 rounded-full">
                              <Text className="text-emerald-600 text-xs font-bold">PREV</Text>
                            </View>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
                <View className="bg-white rounded-2xl p-3 border border-slate-200 mt-3">
                  <Text className="text-xs text-slate-500 mb-1">Reason (audit log)</Text>
                  <TextInput
                    value={reason}
                    onChangeText={setReason}
                    placeholder="Why are you regrading this question?"
                    multiline
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 min-h-[80px]"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                <View className="flex-row items-start bg-yellow-50 border border-yellow-300 rounded-xl p-3 mt-3">
                  <AlertTriangle size={14} color="#92400e" />
                  <Text className="ml-2 text-yellow-900 text-xs flex-1">
                    This recomputes every submitted attempt&apos;s score. The original key + per-attempt scores are saved to audit_log.
                  </Text>
                </View>
                <Pressable
                  disabled={regrading}
                  onPress={() => void submitRegrade()}
                  className="bg-rose-600 rounded-2xl py-4 items-center flex-row justify-center mt-4"
                  style={{ opacity: regrading ? 0.6 : 1 }}
                >
                  <CheckCircle2 size={16} color="#ffffff" />
                  <Text className="ml-2 text-white font-bold text-base">
                    {regrading ? "Regrading…" : "Apply Regrade"}
                  </Text>
                </Pressable>
              </>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function RegradeOption({
  selected,
  label,
  description,
  onPress,
}: {
  selected: boolean;
  label: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-start py-2.5"
    >
      <View
        className="w-5 h-5 rounded-full border-2 mr-2 mt-0.5 items-center justify-center"
        style={{ borderColor: selected ? "#dc2626" : "#cbd5e1" }}
      >
        {selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#dc2626" }} /> : null}
      </View>
      <View className="flex-1">
        <Text className="text-slate-900 font-semibold">{label}</Text>
        <Text className="text-slate-500 text-xs mt-0.5">{description}</Text>
      </View>
    </Pressable>
  );
}
