// Phase 7 — teacher offline-scores entry (top-level per D-169).
//
// Spec §9. Teacher picks a batch + test name + date + (optional) subject +
// max_score, then enters per-student score for the batch roster. Save All
// calls `offline-score-upsert` with the entries array.

import { useEffect, useMemo, useState } from "react";
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
import { useRouter } from "expo-router";
import { Check, ChevronDown, ChevronLeft, Save } from "lucide-react-native";
import { invokeEdgeFn } from "@/lib/edge-fn";
import { useTeacherBatches } from "@/features/exam/useTeacherBatches";
import { useBatchSubjects } from "@/features/exam/useBatchSubjects";
import { useOfflineScores } from "@/features/exam/useOfflineScores";

type Picker = "batch" | "subject" | "date" | null;

function todayIstIso(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function fmtDateShort(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function OfflineScoresScreen() {
  const router = useRouter();
  const teacherBatches = useTeacherBatches();
  const [batchId, setBatchId] = useState<string | null>(null);
  const subjects = useBatchSubjects(batchId);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [testName, setTestName] = useState("");
  const [testDate, setTestDate] = useState<string>(todayIstIso());
  const [maxScore, setMaxScore] = useState<string>("100");
  const ofs = useOfflineScores({ batchId, testName: testName.trim() || null, testDate });

  const [picker, setPicker] = useState<Picker>(null);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Hydrate existing scores when a saved test is found. Merge into any
  // in-progress typing (existing wins for those students) and never clobber
  // typed values when no existing rows match — typing a new test name
  // triggers refetches that would otherwise wipe scores already entered.
  useEffect(() => {
    if (ofs.existing.length === 0) return;
    setScores((prev) => {
      const next = { ...prev };
      for (const e of ofs.existing) next[e.student_id] = String(e.score);
      return next;
    });
    setNotes((prev) => {
      const next = { ...prev };
      for (const e of ofs.existing) {
        if (e.notes) next[e.student_id] = e.notes;
      }
      return next;
    });
  }, [ofs.existing]);

  const selectedBatch = useMemo(
    () => teacherBatches.batches.find((b) => b.batch_id === batchId) ?? null,
    [teacherBatches.batches, batchId],
  );
  const selectedSubject = subjects.subjects.find((s) => s.id === subjectId) ?? null;

  const maxScoreNum = Number.parseFloat(maxScore);
  const canSave =
    selectedBatch !== null &&
    testName.trim().length >= 1 &&
    testDate.length === 10 &&
    Number.isFinite(maxScoreNum) &&
    maxScoreNum > 0;

  const onSave = async () => {
    if (!selectedBatch || !canSave) {
      Alert.alert("Missing fields", "Pick batch + test name + date + max score.");
      return;
    }
    const entries = ofs.roster
      .map((s) => {
        const raw = scores[s.student_id];
        if (raw === undefined || raw === "") return null;
        const n = Number.parseFloat(raw);
        if (!Number.isFinite(n)) return null;
        return {
          student_id: s.student_id,
          score: n,
          notes: notes[s.student_id]?.trim() || undefined,
        };
      })
      .filter((e): e is { student_id: string; score: number; notes: string | undefined } => !!e);
    if (entries.length === 0) {
      Alert.alert("No scores", "Enter at least one student's score before saving.");
      return;
    }
    // Quick client-side validation.
    for (const e of entries) {
      if (e.score < 0 || e.score > maxScoreNum) {
        Alert.alert(
          "Out of range",
          `A score for ${ofs.roster.find((r) => r.student_id === e.student_id)?.full_name ?? "a student"} is outside [0, ${maxScoreNum}].`,
        );
        return;
      }
    }
    setSaving(true);
    try {
      const { status, body } = await invokeEdgeFn<{
        inserted_count: number;
        updated_count: number;
      }>("offline-score-upsert", {
        batch_id: selectedBatch.batch_id,
        test_name: testName.trim(),
        test_date: testDate,
        subject_id: subjectId ?? undefined,
        max_score: maxScoreNum,
        entries,
      });
      if (status === 200) {
        Alert.alert(
          "Saved",
          `${(body as { inserted_count?: number })?.inserted_count ?? 0} new, ${(body as { updated_count?: number })?.updated_count ?? 0} updated.`,
        );
        await ofs.reload();
      } else {
        Alert.alert(
          "Save failed",
          `Status ${status}: ${(body as { error?: string })?.error ?? "unknown"}`,
        );
      }
    } finally {
      setSaving(false);
    }
  };

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
        <Text className="text-lg font-bold text-blue-900 ml-3 flex-1">Offline Test Scores</Text>
      </View>

      <FlatList
        data={ofs.roster}
        keyExtractor={(s) => s.student_id}
        contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
        ListHeaderComponent={
          <View>
            <View className="bg-white rounded-2xl p-4 border border-slate-200 mb-3">
              <Field label="Batch">
                <Pressable
                  onPress={() => setPicker("batch")}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-3 flex-row items-center justify-between"
                >
                  <Text className="text-slate-900">
                    {selectedBatch ? `${selectedBatch.batch_name} · ${selectedBatch.course_code}` : "Choose batch"}
                  </Text>
                  <ChevronDown size={16} color="#64748b" />
                </Pressable>
              </Field>
              <Field label="Test name">
                <TextInput
                  value={testName}
                  onChangeText={setTestName}
                  placeholder="e.g. Weekly Test 12"
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900"
                  placeholderTextColor="#94a3b8"
                />
              </Field>
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Text className="text-xs text-slate-500 mb-1">Date</Text>
                  <Pressable
                    onPress={() => setPicker("date")}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-3"
                  >
                    <Text className="text-slate-900">{fmtDateShort(testDate)}</Text>
                  </Pressable>
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-slate-500 mb-1">Max score</Text>
                  <TextInput
                    value={maxScore}
                    onChangeText={setMaxScore}
                    keyboardType="numeric"
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900"
                  />
                </View>
              </View>
              <Field label="Subject (optional)">
                <Pressable
                  onPress={() => setPicker("subject")}
                  disabled={!selectedBatch}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-3 flex-row items-center justify-between"
                  style={{ opacity: selectedBatch ? 1 : 0.5 }}
                >
                  <Text className="text-slate-900">
                    {selectedSubject ? selectedSubject.name : "None"}
                  </Text>
                  <ChevronDown size={16} color="#64748b" />
                </Pressable>
              </Field>
            </View>
            {!selectedBatch ? (
              <Text className="text-slate-500 italic px-2">Pick a batch above to load its roster.</Text>
            ) : ofs.isLoading ? (
              <View className="items-center py-6">
                <ActivityIndicator size="small" color="#2563EB" />
              </View>
            ) : ofs.error ? (
              <Text className="text-red-600 px-2">{ofs.error}</Text>
            ) : (
              <Text className="text-base font-bold text-blue-900 px-2 mb-2">
                Roster · {ofs.roster.length} student{ofs.roster.length === 1 ? "" : "s"}
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const existing = ofs.existing.find((e) => e.student_id === item.student_id);
          return (
            <View className="bg-white rounded-2xl p-3 border border-slate-200 mb-2">
              <View className="flex-row items-center">
                <View className="w-9 h-9 rounded-full bg-blue-100 items-center justify-center mr-3">
                  <Text className="text-blue-700 font-bold">
                    {item.full_name.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <Text className="flex-1 text-slate-900 font-semibold" numberOfLines={1}>
                  {item.full_name}
                </Text>
                <TextInput
                  value={scores[item.student_id] ?? ""}
                  onChangeText={(t) =>
                    setScores((p) => ({ ...p, [item.student_id]: t }))
                  }
                  placeholder="—"
                  keyboardType="numeric"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 w-20 text-right"
                  placeholderTextColor="#94a3b8"
                />
                <Text className="text-slate-400 ml-1">/ {Number(maxScore) || 0}</Text>
              </View>
              {existing ? (
                <Text className="text-xs text-emerald-600 mt-1 ml-12">
                  Previous: {existing.score}
                </Text>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          selectedBatch && !ofs.isLoading ? (
            <Text className="text-slate-500 italic text-center mt-4">
              No students in this batch yet.
            </Text>
          ) : null
        }
      />

      <View className="absolute bottom-0 left-0 right-0 px-5 py-4 bg-white border-t border-slate-200">
        <Pressable
          disabled={saving || !canSave}
          onPress={() => void onSave()}
          className="bg-blue-600 rounded-2xl py-4 items-center flex-row justify-center"
          style={{ opacity: saving || !canSave ? 0.6 : 1 }}
        >
          <Save size={16} color="#ffffff" />
          <Text className="ml-2 text-white font-bold text-base">
            {saving ? "Saving…" : "Save All"}
          </Text>
        </Pressable>
      </View>

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
          setSubjectId(null);
          setPicker(null);
        }}
      />
      <PickerModal
        title="Subject"
        visible={picker === "subject"}
        onClose={() => setPicker(null)}
        items={[{ key: "", label: "None" }, ...subjects.subjects.map((s) => ({ key: s.id, label: s.name }))]}
        selectedKey={subjectId ?? ""}
        onSelect={(k) => {
          setSubjectId(k || null);
          setPicker(null);
        }}
      />
      <DatePicker
        visible={picker === "date"}
        currentIso={testDate}
        onClose={() => setPicker(null)}
        onChange={(iso) => {
          setTestDate(iso);
          setPicker(null);
        }}
      />
    </SafeAreaView>
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
        style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "center", paddingHorizontal: 24 }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ backgroundColor: "#fff", borderRadius: 18, padding: 16, maxHeight: "70%" }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#0f172a", marginBottom: 12 }}>{title}</Text>
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
                {selectedKey === it.key ? <Check size={16} color="#2563EB" /> : <View style={{ width: 16 }} />}
                <Text style={{ marginLeft: 8, color: "#0f172a", fontSize: 15 }}>{it.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DatePicker({
  visible,
  currentIso,
  onClose,
  onChange,
}: {
  visible: boolean;
  currentIso: string;
  onClose: () => void;
  onChange: (iso: string) => void;
}) {
  // Last 30 days + today + next 30 days, IST dates.
  const today = new Date();
  const days: string[] = [];
  for (let i = -30; i <= 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    days.push(d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
  }
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "center", paddingHorizontal: 24 }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ backgroundColor: "#fff", borderRadius: 18, padding: 16, maxHeight: "70%" }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#0f172a", marginBottom: 12 }}>Test date</Text>
          <ScrollView>
            {days.map((iso) => {
              const sel = iso === currentIso;
              return (
                <Pressable
                  key={iso}
                  onPress={() => onChange(iso)}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 8,
                    borderRadius: 10,
                    backgroundColor: sel ? "#eff6ff" : "transparent",
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  {sel ? <Check size={16} color="#2563EB" /> : <View style={{ width: 16 }} />}
                  <Text style={{ marginLeft: 8, color: "#0f172a", fontSize: 15 }}>{fmtDateShort(iso)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
