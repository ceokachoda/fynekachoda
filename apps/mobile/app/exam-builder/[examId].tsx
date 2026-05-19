// Phase 7 — teacher exam builder (top-level per D-169).
//
// Supports New (examId="new") and Edit (uuid) modes. Writes go through
// PostgREST with RLS (exams_teacher_insert / update / delete policies)
// and exam_questions PUT via teacher-write policy.
//
// Spec §4: edits after publish allowed up to `starts_at - 1h`; we surface
// a warning but still allow the write — DB does not enforce that window
// because admin override is required at the edge fn for late edits.

import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/features/auth/network-errors";
import { useSession } from "@/features/auth/useSession";
import { useTeacherBatches } from "@/features/exam/useTeacherBatches";
import { useExamBuilder } from "@/features/exam/useTeacherExamBuilder";
import { useQuestionBank } from "@/features/quiz/useQuestionBank";

type Picker = "batch" | "duration" | "release" | "date" | null;

function fmtIstShort(iso: string | null): string {
  if (!iso) return "(pick date)";
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

// Round a Date forward to the next 15-minute boundary (in local TZ).
function round15(d: Date): Date {
  const out = new Date(d);
  out.setSeconds(0, 0);
  const m = out.getMinutes();
  const inc = (15 - (m % 15)) % 15;
  if (inc > 0) out.setMinutes(m + inc);
  return out;
}

function nextHalfHourStartsAt(): string {
  const d = round15(new Date(Date.now() + 30 * 60_000));
  return d.toISOString();
}

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120, 180];

export default function ExamBuilderScreen() {
  const router = useRouter();
  const { examId } = useLocalSearchParams<{ examId?: string }>();
  const id = examId ?? "new";
  const { appUser } = useSession();
  const builder = useExamBuilder(id as string);
  const teacherBatches = useTeacherBatches();
  const bank = useQuestionBank();

  const [title, setTitle] = useState("");
  const [batchId, setBatchId] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [durationMin, setDurationMin] = useState<number>(60);
  const [marksCorrect, setMarksCorrect] = useState("4");
  const [marksWrong, setMarksWrong] = useState("-1");
  const [marksSkip, setMarksSkip] = useState("0");
  const [randomizeQ, setRandomizeQ] = useState(true);
  const [randomizeO, setRandomizeO] = useState(true);
  const [resultRelease, setResultRelease] = useState<"manual" | "instant">("manual");
  const [questionIds, setQuestionIds] = useState<string[]>([]);
  const [picker, setPicker] = useState<Picker>(null);
  const [showBank, setShowBank] = useState(false);
  const [bankFilter, setBankFilter] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!builder.exam) return;
    setTitle(builder.exam.title);
    setBatchId(builder.exam.batch_id);
    setStartsAt(builder.exam.starts_at);
    setDurationMin(builder.exam.duration_min);
    setMarksCorrect(String(builder.exam.marks_correct));
    setMarksWrong(String(builder.exam.marks_wrong));
    setMarksSkip(String(builder.exam.marks_skip));
    setRandomizeQ(builder.exam.randomize_questions);
    setRandomizeO(builder.exam.randomize_options);
    setResultRelease(builder.exam.result_release);
    setQuestionIds(builder.questions.map((q) => q.question_id));
  }, [builder.exam, builder.questions]);

  useEffect(() => {
    if (id === "new" && !startsAt) {
      setStartsAt(nextHalfHourStartsAt());
    }
  }, [id, startsAt]);

  const selectedBatch = useMemo(
    () => teacherBatches.batches.find((b) => b.batch_id === batchId) ?? null,
    [teacherBatches.batches, batchId],
  );

  const canSave =
    title.trim().length > 0 &&
    batchId !== null &&
    startsAt !== null &&
    durationMin >= 1 &&
    durationMin <= 360;

  const save = async (publish: boolean) => {
    if (!appUser?.id) return;
    if (!canSave) {
      Alert.alert(
        "Missing fields",
        "Add title + batch + start time + duration before saving.",
      );
      return;
    }
    if (publish && questionIds.length === 0) {
      Alert.alert(
        "No questions",
        "Add at least one question before publishing.",
      );
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        batch_id: batchId,
        starts_at: startsAt,
        duration_min: durationMin,
        marks_correct: Number.parseFloat(marksCorrect) || 4,
        marks_wrong: Number.parseFloat(marksWrong) || -1,
        marks_skip: Number.parseFloat(marksSkip) || 0,
        randomize_questions: randomizeQ,
        randomize_options: randomizeO,
        result_release: resultRelease,
        is_published: publish,
        created_by: appUser.id,
      };
      let savedId = id;
      if (id === "new") {
        const ins = await withTimeout(
          supabase.from("exams").insert(payload).select("id").single(),
        );
        if (ins.error || !ins.data) {
          Alert.alert("Save failed", ins.error?.message ?? "insert");
          return;
        }
        savedId = ins.data.id;
      } else {
        const upd = await withTimeout(
          supabase.from("exams").update(payload).eq("id", id),
        );
        if (upd.error) {
          Alert.alert("Save failed", upd.error.message);
          return;
        }
      }

      // Replace exam_questions: delete then re-insert with sort_order.
      await withTimeout(
        supabase.from("exam_questions").delete().eq("exam_id", savedId),
      );
      if (questionIds.length > 0) {
        const rows = questionIds.map((qid, i) => ({
          exam_id: savedId,
          question_id: qid,
          sort_order: i,
        }));
        const eqIns = await withTimeout(
          supabase.from("exam_questions").insert(rows),
        );
        if (eqIns.error) {
          Alert.alert("Save failed", eqIns.error.message);
          return;
        }
      }
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const addFromBank = (qid: string) => {
    setQuestionIds((prev) => (prev.includes(qid) ? prev : [...prev, qid]));
  };

  const removeAt = (i: number) => {
    setQuestionIds((prev) => prev.filter((_, idx) => idx !== i));
  };

  const moveUp = (i: number) => {
    if (i === 0) return;
    setQuestionIds((prev) => {
      const next = [...prev];
      const a = next[i - 1];
      const b = next[i];
      if (a === undefined || b === undefined) return prev;
      next[i - 1] = b;
      next[i] = a;
      return next;
    });
  };

  const moveDown = (i: number) => {
    setQuestionIds((prev) => {
      if (i >= prev.length - 1) return prev;
      const next = [...prev];
      const a = next[i];
      const b = next[i + 1];
      if (a === undefined || b === undefined) return prev;
      next[i] = b;
      next[i + 1] = a;
      return next;
    });
  };

  if (builder.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center" edges={["top"]}>
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }
  if (builder.error) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <Text className="m-6 text-red-600">{builder.error}</Text>
      </SafeAreaView>
    );
  }

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
        <Text className="text-lg font-bold text-blue-900 ml-3 flex-1">
          {id === "new" ? "New Exam" : "Edit Exam"}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <Card title="Basics">
          <Field label="Title">
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Unit Test 4 — Mechanics"
              className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-base text-slate-900"
              placeholderTextColor="#94a3b8"
            />
          </Field>
          <Field label="Batch">
            <Pressable
              onPress={() => setPicker("batch")}
              className="bg-white border border-slate-200 rounded-xl px-3 py-3 flex-row items-center justify-between"
            >
              <Text className="text-slate-900">
                {selectedBatch
                  ? `${selectedBatch.batch_name} · ${selectedBatch.course_code}`
                  : "Choose batch"}
              </Text>
              <ChevronDown size={16} color="#64748b" />
            </Pressable>
          </Field>
          <Field label="Starts">
            <Pressable
              onPress={() => setPicker("date")}
              className="bg-white border border-slate-200 rounded-xl px-3 py-3 flex-row items-center justify-between"
            >
              <Text className="text-slate-900">{fmtIstShort(startsAt)}</Text>
              <ChevronDown size={16} color="#64748b" />
            </Pressable>
          </Field>
          <Field label="Duration">
            <Pressable
              onPress={() => setPicker("duration")}
              className="bg-white border border-slate-200 rounded-xl px-3 py-3 flex-row items-center justify-between"
            >
              <Text className="text-slate-900">{durationMin} min</Text>
              <ChevronDown size={16} color="#64748b" />
            </Pressable>
          </Field>
        </Card>

        <Card title="Marking & options">
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Text className="text-xs text-slate-500 mb-1">+ Correct</Text>
              <TextInput
                value={marksCorrect}
                onChangeText={setMarksCorrect}
                keyboardType="numeric"
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
              />
            </View>
            <View className="flex-1">
              <Text className="text-xs text-slate-500 mb-1">− Wrong</Text>
              <TextInput
                value={marksWrong}
                onChangeText={setMarksWrong}
                keyboardType="numeric"
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
              />
            </View>
            <View className="flex-1">
              <Text className="text-xs text-slate-500 mb-1">Skip</Text>
              <TextInput
                value={marksSkip}
                onChangeText={setMarksSkip}
                keyboardType="numeric"
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
              />
            </View>
          </View>
          <Row label="Randomize question order">
            <Switch value={randomizeQ} onValueChange={setRandomizeQ} />
          </Row>
          <Row label="Randomize option order">
            <Switch value={randomizeO} onValueChange={setRandomizeO} />
          </Row>
          <Row label="Result release">
            <Pressable
              onPress={() => setPicker("release")}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 flex-row items-center"
            >
              <Text className="text-slate-900 mr-1">
                {resultRelease === "manual" ? "Manual" : "Instant"}
              </Text>
              <ChevronDown size={14} color="#64748b" />
            </Pressable>
          </Row>
        </Card>

        <Card title={`Questions · ${questionIds.length}`}>
          {questionIds.length === 0 ? (
            <Text className="text-slate-500 italic">
              No questions yet. Add some from the bank below.
            </Text>
          ) : (
            questionIds.map((qid, i) => (
              <View
                key={qid}
                className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl p-3 mb-2"
              >
                <Text className="text-slate-500 mr-2 font-bold w-6">
                  {i + 1}.
                </Text>
                <Text className="flex-1 text-slate-800" numberOfLines={2}>
                  {bank.rows.find((r) => r.id === qid)?.prompt_md ?? builder.questions.find((q) => q.question_id === qid)?.prompt_md ?? `Question ${qid.slice(0, 8)}…`}
                </Text>
                <View className="flex-row ml-2">
                  <Pressable onPress={() => moveUp(i)} className="p-1.5">
                    <Text className="text-slate-500 font-bold">↑</Text>
                  </Pressable>
                  <Pressable onPress={() => moveDown(i)} className="p-1.5">
                    <Text className="text-slate-500 font-bold">↓</Text>
                  </Pressable>
                  <Pressable onPress={() => removeAt(i)} className="p-1.5">
                    <Trash2 size={14} color="#dc2626" />
                  </Pressable>
                </View>
              </View>
            ))
          )}
          <Pressable
            onPress={() => setShowBank(true)}
            className="bg-blue-600 rounded-xl py-3 items-center flex-row justify-center mt-2"
          >
            <Plus size={16} color="#ffffff" />
            <Text className="text-white font-semibold ml-2">
              Add from Question Bank
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/quiz-builder/new" as never)}
            className="bg-white border border-slate-200 rounded-xl py-3 items-center flex-row justify-center mt-2"
          >
            <Text className="text-slate-800 font-semibold">
              + New Question (via quiz builder)
            </Text>
          </Pressable>
        </Card>

        <View className="h-3" />
        <Pressable
          disabled={saving}
          onPress={() => void save(false)}
          className="bg-slate-100 border border-slate-200 rounded-2xl py-4 items-center mb-2"
          style={{ opacity: saving ? 0.6 : 1 }}
        >
          <Text className="text-slate-800 font-bold text-base">Save Draft</Text>
        </Pressable>
        <Pressable
          disabled={saving}
          onPress={() => void save(true)}
          className="bg-blue-600 rounded-2xl py-4 items-center"
          style={{ opacity: saving ? 0.6 : 1 }}
        >
          <Text className="text-white font-bold text-base">
            {saving ? "Saving…" : "Publish"}
          </Text>
        </Pressable>
      </ScrollView>

      <PickerModal
        title="Choose batch"
        visible={picker === "batch"}
        onClose={() => setPicker(null)}
        items={teacherBatches.batches.map((b) => ({
          key: b.batch_id,
          label: `${b.batch_name} · ${b.course_code}`,
        }))}
        selectedKey={batchId}
        onSelect={(k) => {
          setBatchId(k);
          setPicker(null);
        }}
      />
      <PickerModal
        title="Duration"
        visible={picker === "duration"}
        onClose={() => setPicker(null)}
        items={DURATION_PRESETS.map((m) => ({
          key: String(m),
          label: `${m} minutes`,
        }))}
        selectedKey={String(durationMin)}
        onSelect={(k) => {
          setDurationMin(Number.parseInt(k, 10));
          setPicker(null);
        }}
      />
      <PickerModal
        title="Result release"
        visible={picker === "release"}
        onClose={() => setPicker(null)}
        items={[
          { key: "manual", label: "Manual (teacher releases later)" },
          { key: "instant", label: "Instant (release on submit)" },
        ]}
        selectedKey={resultRelease}
        onSelect={(k) => {
          setResultRelease(k as "manual" | "instant");
          setPicker(null);
        }}
      />
      <StartDatePicker
        visible={picker === "date"}
        startsAt={startsAt}
        onClose={() => setPicker(null)}
        onChange={(iso) => {
          setStartsAt(iso);
          setPicker(null);
        }}
      />

      <Modal
        visible={showBank}
        animationType="slide"
        onRequestClose={() => setShowBank(false)}
      >
        <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
          <View className="flex-row items-center px-5 pt-3 pb-2">
            <Pressable
              accessibilityLabel="Close"
              onPress={() => setShowBank(false)}
              className="w-9 h-9 items-center justify-center rounded-full bg-white border border-slate-200"
            >
              <X size={20} color="#0f172a" />
            </Pressable>
            <Text className="text-lg font-bold text-blue-900 ml-3 flex-1">
              Question Bank
            </Text>
          </View>
          <View className="px-5 pb-2 flex-row items-center bg-white border border-slate-200 rounded-xl mx-5">
            <Search size={16} color="#94a3b8" />
            <TextInput
              value={bankFilter}
              onChangeText={(t) => {
                setBankFilter(t);
                void bank.reload({ search: t });
              }}
              placeholder="Search prompt…"
              className="flex-1 ml-2 py-2 text-slate-900"
              placeholderTextColor="#94a3b8"
            />
          </View>
          <FlatList
            data={bank.rows}
            keyExtractor={(r) => r.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            renderItem={({ item }) => {
              const picked = questionIds.includes(item.id);
              return (
                <Pressable
                  onPress={() => addFromBank(item.id)}
                  disabled={picked}
                  className="bg-white border border-slate-200 rounded-xl p-3"
                  style={{ opacity: picked ? 0.5 : 1 }}
                >
                  <Text className="text-slate-900" numberOfLines={2}>
                    {item.prompt_md}
                  </Text>
                  <View className="flex-row items-center mt-1">
                    <Text className="text-xs text-slate-500">
                      {item.difficulty ?? "—"} · {item.option_count} options
                    </Text>
                    {picked ? (
                      <View className="ml-auto flex-row items-center">
                        <Check size={14} color="#059669" />
                        <Text className="ml-1 text-emerald-600 text-xs font-semibold">
                          Added
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <Text className="text-slate-500 italic text-center mt-12">
                No questions in the bank yet.
              </Text>
            }
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="bg-white rounded-2xl p-4 mb-3 border border-slate-200">
      <Text className="text-base font-bold text-blue-900 mb-3">{title}</Text>
      {children}
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mb-3">
      <Text className="text-xs text-slate-500 mb-1">{label}</Text>
      {children}
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="flex-row items-center justify-between mt-3">
      <Text className="text-slate-700">{label}</Text>
      {children}
    </View>
  );
}

function PickerModal({
  title,
  visible,
  onClose,
  items,
  selectedKey,
  onSelect,
}: {
  title: string;
  visible: boolean;
  onClose: () => void;
  items: Array<{ key: string; label: string }>;
  selectedKey: string | null;
  onSelect: (k: string) => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(15,23,42,0.45)",
          justifyContent: "center",
          paddingHorizontal: 24,
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ backgroundColor: "#fff", borderRadius: 18, padding: 16, maxHeight: "70%" }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#0f172a", marginBottom: 12 }}>
            {title}
          </Text>
          <ScrollView>
            {items.map((it) => (
              <Pressable
                key={it.key}
                onPress={() => onSelect(it.key)}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 8,
                  borderRadius: 10,
                  backgroundColor: selectedKey === it.key ? "#eff6ff" : "transparent",
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                {selectedKey === it.key ? (
                  <Check size={16} color="#2563EB" />
                ) : (
                  <View style={{ width: 16 }} />
                )}
                <Text style={{ marginLeft: 8, color: "#0f172a", fontSize: 15 }}>
                  {it.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Minimal date + time picker — uses ScrollViews of buttons because react-
// native-datetimepicker would add a native module dep. 15-min steps;
// horizon = today + 30 days.
function StartDatePicker({
  visible,
  startsAt,
  onClose,
  onChange,
}: {
  visible: boolean;
  startsAt: string | null;
  onClose: () => void;
  onChange: (iso: string) => void;
}) {
  const baseDate = startsAt ? new Date(startsAt) : round15(new Date(Date.now() + 30 * 60_000));
  const [pickedDate, setPickedDate] = useState<Date>(baseDate);

  useEffect(() => {
    setPickedDate(startsAt ? new Date(startsAt) : round15(new Date(Date.now() + 30 * 60_000)));
  }, [startsAt, visible]);

  const days = Array.from({ length: 31 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    d.setHours(pickedDate.getHours(), pickedDate.getMinutes(), 0, 0);
    return d;
  });
  // 96 quarter-hours in a day.
  const times: Array<{ h: number; m: number }> = [];
  for (let h = 0; h < 24; h++) for (let m = 0; m < 60; m += 15) times.push({ h, m });

  const setDayPart = (d: Date) => {
    const nd = new Date(pickedDate);
    nd.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    setPickedDate(nd);
  };
  const setTimePart = (h: number, m: number) => {
    const nd = new Date(pickedDate);
    nd.setHours(h, m, 0, 0);
    setPickedDate(nd);
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(15,23,42,0.45)",
          justifyContent: "center",
          paddingHorizontal: 24,
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ backgroundColor: "#fff", borderRadius: 18, padding: 16, maxHeight: "85%" }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#0f172a", marginBottom: 12 }}>
            Pick start date + time
          </Text>
          <Text style={{ fontSize: 13, color: "#475569", marginBottom: 6 }}>Date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {days.map((d, i) => {
              const isSel =
                d.toDateString() === pickedDate.toDateString();
              return (
                <Pressable
                  key={i}
                  onPress={() => setDayPart(d)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    marginRight: 6,
                    borderRadius: 12,
                    backgroundColor: isSel ? "#2563EB" : "#f1f5f9",
                  }}
                >
                  <Text
                    style={{
                      color: isSel ? "#ffffff" : "#0f172a",
                      fontWeight: "700",
                      fontSize: 12,
                      textAlign: "center",
                    }}
                  >
                    {d.toLocaleDateString("en-IN", { weekday: "short" })}
                  </Text>
                  <Text
                    style={{
                      color: isSel ? "#ffffff" : "#0f172a",
                      fontSize: 12,
                      textAlign: "center",
                    }}
                  >
                    {d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={{ fontSize: 13, color: "#475569", marginBottom: 6 }}>
            Time (IST, 15-min slots)
          </Text>
          <ScrollView style={{ maxHeight: 240 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {times.map(({ h, m }) => {
                const isSel = pickedDate.getHours() === h && pickedDate.getMinutes() === m;
                const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
                return (
                  <Pressable
                    key={`${h}:${m}`}
                    onPress={() => setTimePart(h, m)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 10,
                      backgroundColor: isSel ? "#2563EB" : "#f1f5f9",
                      margin: 3,
                    }}
                  >
                    <Text
                      style={{
                        color: isSel ? "#ffffff" : "#0f172a",
                        fontWeight: "700",
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {pad(h)}:{pad(m)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
          <Pressable
            onPress={() => onChange(pickedDate.toISOString())}
            style={{
              marginTop: 14,
              backgroundColor: "#2563EB",
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Use this time</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
