// Phase 6 — teacher quiz builder.
//
// Top-level Stack route so the long form doesn't fight the bottom tab bar.
// Supports New (id="new") and Edit (uuid) modes. Writes go through PostgREST
// with RLS (teacher can write own quizzes per `quizzes_teacher_*` policies)
// and quiz-image-presign for any prompt/option images.

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
  ChevronUp,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/features/auth/network-errors";
import { useSession } from "@/features/auth/useSession";
import { useTeacherCurriculum } from "@/features/library/useTeacherCurriculum";
import { useQuizBuilder } from "@/features/quiz/useTeacherQuizBuilder";
import { useQuestionBank } from "@/features/quiz/useQuestionBank";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PickerSheet } from "@/components/ui/PickerSheet";

type Picker = "course" | "subject" | "chapter" | "topic" | "batch" | null;

interface NewQuestionDraft {
  prompt_md: string;
  difficulty: "easy" | "medium" | "hard" | null;
  options: { text_md: string; is_correct: boolean }[];
  explanation_md: string;
  related_content_id: string | null;
}

const EMPTY_DRAFT: NewQuestionDraft = {
  prompt_md: "",
  difficulty: null,
  options: [
    { text_md: "", is_correct: false },
    { text_md: "", is_correct: false },
    { text_md: "", is_correct: false },
    { text_md: "", is_correct: false },
  ],
  explanation_md: "",
  related_content_id: null,
};

export default function QuizBuilderScreen() {
  const router = useRouter();
  const { quizId } = useLocalSearchParams<{ quizId?: string }>();
  const id = quizId ?? "new";
  const { appUser } = useSession();

  const builder = useQuizBuilder(id as string);
  const curriculum = useTeacherCurriculum();

  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [duration, setDuration] = useState("20");
  const [marksCorrect, setMarksCorrect] = useState("4");
  const [marksWrong, setMarksWrong] = useState("-1");
  const [marksSkip, setMarksSkip] = useState("0");
  const [randomizeQ, setRandomizeQ] = useState(true);
  const [randomizeO, setRandomizeO] = useState(true);
  const [isPublished, setIsPublished] = useState(false);
  const [questionIds, setQuestionIds] = useState<string[]>([]);
  const [promptById, setPromptById] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState<Picker>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showBank, setShowBank] = useState(false);
  const [draft, setDraft] = useState<NewQuestionDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  // Hydrate form from builder load.
  useEffect(() => {
    if (!builder.quiz) return;
    setTitle(builder.quiz.title);
    setCourseId(builder.quiz.scope.course_id);
    setBatchId(builder.quiz.scope.batch_id);
    setDuration(String(builder.quiz.duration_min));
    setMarksCorrect(String(builder.quiz.marks_correct));
    setMarksWrong(String(builder.quiz.marks_wrong));
    setMarksSkip(String(builder.quiz.marks_skip));
    setRandomizeQ(builder.quiz.randomize_questions);
    setRandomizeO(builder.quiz.randomize_options);
    setIsPublished(builder.quiz.is_published);
    // For topic scope we have topic_id but not the subj/chapter chain. Walk
    // the curriculum to back-derive them when curriculum loads.
    if (builder.quiz.scope.topic_id) {
      setTopicId(builder.quiz.scope.topic_id);
    }
    setQuestionIds(builder.questions.map((q) => q.question_id));
    setPromptById((m) => {
      const n = { ...m };
      for (const q of builder.questions) n[q.question_id] = q.question.prompt_md;
      return n;
    });
  }, [builder.quiz, builder.questions]);

  useEffect(() => {
    if (!topicId || subjectId || !curriculum.courses.length) return;
    for (const c of curriculum.courses) {
      for (const s of c.subjects) {
        for (const ch of s.chapters) {
          for (const t of ch.topics) {
            if (t.id === topicId) {
              setCourseId(c.course_id);
              setSubjectId(s.id);
              setChapterId(ch.id);
              return;
            }
          }
        }
      }
    }
  }, [topicId, subjectId, curriculum.courses]);

  // When the teacher teaches exactly one course there is nothing to pick, so
  // the Course PickerRow is hidden (only rendered when courses.length > 1).
  // Auto-select that single course or the Subject→Topic→Batch pickers below
  // stay permanently disabled (selectedCourse would be null).
  useEffect(() => {
    if (courseId) return;
    if (curriculum.courses.length === 1) {
      setCourseId(curriculum.courses[0]!.course_id);
    }
  }, [courseId, curriculum.courses]);

  const selectedCourse = useMemo(
    () => curriculum.courses.find((c) => c.course_id === courseId) ?? null,
    [curriculum.courses, courseId],
  );
  const selectedSubject = selectedCourse?.subjects.find((s) => s.id === subjectId) ?? null;
  const selectedChapter = selectedSubject?.chapters.find((c) => c.id === chapterId) ?? null;
  const selectedTopic = selectedChapter?.topics.find((t) => t.id === topicId) ?? null;
  const selectedBatch = selectedCourse?.batches.find((b) => b.batch_id === batchId) ?? null;

  const canSave =
    title.trim().length > 0 &&
    topicId !== null &&
    courseId !== null &&
    Number.parseInt(duration, 10) >= 1 &&
    Number.parseInt(duration, 10) <= 240;

  const save = async (publish: boolean) => {
    if (!appUser?.id) return;
    if (!canSave) {
      Alert.alert("Missing fields", "Add title + topic + duration.");
      return;
    }
    if (publish && questionIds.length === 0) {
      Alert.alert("No questions", "Add at least one question before publishing.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        topic_id: topicId,
        chapter_id: chapterId,
        batch_id: batchId,
        course_id: courseId,
        duration_min: Number.parseInt(duration, 10),
        marks_correct: Number.parseFloat(marksCorrect),
        marks_wrong: Number.parseFloat(marksWrong),
        marks_skip: Number.parseFloat(marksSkip),
        randomize_questions: randomizeQ,
        randomize_options: randomizeO,
        is_published: publish,
        created_by: appUser.id,
      };
      let savedId = id;
      if (id === "new") {
        const ins = await withTimeout(
          supabase.from("quizzes").insert(payload).select("id").single(),
        );
        if (ins.error || !ins.data) {
          Alert.alert("Save failed", ins.error?.message ?? "insert");
          return;
        }
        savedId = ins.data.id;
      } else {
        const upd = await withTimeout(
          supabase.from("quizzes").update(payload).eq("id", id),
        );
        if (upd.error) {
          Alert.alert("Save failed", upd.error.message);
          return;
        }
      }

      // Replace quiz_questions: delete then re-insert.
      await withTimeout(
        supabase.from("quiz_questions").delete().eq("quiz_id", savedId),
      );
      if (questionIds.length > 0) {
        const rows = questionIds.map((qid, i) => ({
          quiz_id: savedId,
          question_id: qid,
          sort_order: i,
        }));
        const insQQ = await withTimeout(
          supabase.from("quiz_questions").insert(rows),
        );
        if (insQQ.error) {
          Alert.alert(
            "Save partial",
            "Quiz saved but questions failed: " + insQQ.error.message,
          );
          return;
        }
      }
      Alert.alert("Saved", publish ? "Quiz published." : "Draft saved.");
      router.back();
    } catch (e) {
      Alert.alert("Save failed", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const saveNewQuestion = async () => {
    if (!appUser?.id || !topicId) {
      Alert.alert("Pick a topic first", "");
      return;
    }
    if (draft.prompt_md.trim().length === 0) {
      Alert.alert("Empty prompt", "Add the question prompt.");
      return;
    }
    if (!draft.options.some((o) => o.is_correct)) {
      Alert.alert("Mark correct", "Tick at least one correct option.");
      return;
    }
    if (draft.options.filter((o) => o.text_md.trim().length > 0).length < 2) {
      Alert.alert("Need 2 options", "Fill in at least two options.");
      return;
    }
    setSaving(true);
    try {
      const qRes = await withTimeout(
        supabase
          .from("questions")
          .insert({
            topic_id: topicId,
            prompt_md: draft.prompt_md.trim(),
            difficulty: draft.difficulty,
            created_by: appUser.id,
          })
          .select("id")
          .single(),
      );
      if (qRes.error || !qRes.data) {
        Alert.alert("Save failed", qRes.error?.message ?? "question insert");
        return;
      }
      const questionId = qRes.data.id;
      const optRows = draft.options
        .filter((o) => o.text_md.trim().length > 0)
        .map((o, i) => ({
          question_id: questionId,
          text_md: o.text_md.trim(),
          is_correct: o.is_correct,
          sort_order: i,
        }));
      const oRes = await withTimeout(
        supabase.from("question_options").insert(optRows),
      );
      if (oRes.error) {
        Alert.alert("Save failed", "Options: " + oRes.error.message);
        return;
      }
      if (draft.explanation_md.trim().length > 0) {
        await withTimeout(
          supabase.from("question_solutions").insert({
            question_id: questionId,
            explanation_md: draft.explanation_md.trim(),
            related_content_id: draft.related_content_id,
          }),
        );
      }
      setQuestionIds((prev) => [...prev, questionId]);
      setPromptById((m) => ({ ...m, [questionId]: draft.prompt_md.trim() }));
      setDraft(EMPTY_DRAFT);
      setShowEditor(false);
    } catch (e) {
      Alert.alert("Save failed", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const moveQuestion = (i: number, dir: -1 | 1) => {
    setQuestionIds((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[i]!;
      next[i] = next[j]!;
      next[j] = tmp;
      return next;
    });
  };

  if (builder.isLoading && !builder.quiz) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <LoadingScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-3 pb-2">
        <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center rounded-full bg-white border border-slate-200">
          <ChevronLeft size={20} color="#0f172a" />
        </Pressable>
        <Text className="text-lg font-bold text-blue-900 ml-3 flex-1">
          {id === "new" ? "New Quiz" : "Edit Quiz"}
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 140 }}>
        <Label>Title</Label>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Vectors — Quick 15"
          placeholderTextColor="#94a3b8"
          className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-base text-slate-900"
        />

        <Spacer />
        <Label>Scope</Label>
        <View className="gap-3">
          {curriculum.courses.length > 1 ? (
            <PickerRow
              label="Course"
              value={selectedCourse ? `${selectedCourse.course_code} · ${selectedCourse.course_name}` : null}
              onPress={() => setPicker("course")}
            />
          ) : null}
          <PickerRow
            label="Subject"
            value={selectedSubject?.name ?? null}
            onPress={() => setPicker("subject")}
            disabled={!selectedCourse}
          />
          <PickerRow
            label="Chapter"
            value={selectedChapter?.name ?? null}
            onPress={() => setPicker("chapter")}
            disabled={!selectedSubject}
          />
          <PickerRow
            label="Topic"
            value={selectedTopic?.name ?? null}
            onPress={() => setPicker("topic")}
            disabled={!selectedChapter}
          />
          <PickerRow
            label="Batch (optional — empty = course-wide)"
            value={selectedBatch?.batch_name ?? (batchId === null ? "Course-wide" : null)}
            onPress={() => setPicker("batch")}
            disabled={!selectedCourse}
          />
        </View>

        <Spacer />
        <Label>Timing & Marking</Label>
        <View className="flex-row gap-3">
          <NumField label="Duration (min)" value={duration} onChangeText={setDuration} />
          <NumField label="Correct" value={marksCorrect} onChangeText={setMarksCorrect} />
        </View>
        <View className="flex-row gap-3 mt-3">
          <NumField label="Wrong" value={marksWrong} onChangeText={setMarksWrong} />
          <NumField label="Skip" value={marksSkip} onChangeText={setMarksSkip} />
        </View>

        <Spacer />
        <Label>Randomization</Label>
        <RowSwitch
          label="Randomize question order"
          value={randomizeQ}
          onValueChange={setRandomizeQ}
        />
        <RowSwitch
          label="Randomize option order"
          value={randomizeO}
          onValueChange={setRandomizeO}
        />

        <Spacer />
        <Label>{`Questions (${questionIds.length})`}</Label>
        <View className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {questionIds.length === 0 ? (
            <View className="p-4 items-center">
              <Text className="text-slate-500">No questions yet.</Text>
            </View>
          ) : (
            questionIds.map((qid, i) => (
              <View
                key={qid}
                className={
                  "flex-row items-center px-4 py-3 " +
                  (i < questionIds.length - 1 ? "border-b border-slate-100" : "")
                }
              >
                <Text className="font-semibold text-slate-700 w-8">{i + 1}.</Text>
                <Text className="flex-1 text-slate-900" numberOfLines={1}>
                  {promptById[qid] ?? `Question ${qid.slice(0, 6)}…`}
                </Text>
                <Pressable
                  accessibilityLabel="Move question up"
                  disabled={i === 0}
                  onPress={() => moveQuestion(i, -1)}
                  hitSlop={6}
                  className="px-1"
                  style={{ opacity: i === 0 ? 0.3 : 1 }}
                >
                  <ChevronUp size={18} color="#475569" />
                </Pressable>
                <Pressable
                  accessibilityLabel="Move question down"
                  disabled={i === questionIds.length - 1}
                  onPress={() => moveQuestion(i, 1)}
                  hitSlop={6}
                  className="px-1"
                  style={{ opacity: i === questionIds.length - 1 ? 0.3 : 1 }}
                >
                  <ChevronDown size={18} color="#475569" />
                </Pressable>
                <Pressable
                  accessibilityLabel="Remove question"
                  onPress={() =>
                    setQuestionIds((prev) => prev.filter((x) => x !== qid))
                  }
                  hitSlop={6}
                  className="px-1 ml-1"
                >
                  <Trash2 size={16} color="#dc2626" />
                </Pressable>
              </View>
            ))
          )}
        </View>
        <View className="flex-row gap-3 mt-3">
          <Pressable
            onPress={() => {
              if (!topicId) {
                Alert.alert("Pick a topic first", "");
                return;
              }
              setDraft(EMPTY_DRAFT);
              setShowEditor(true);
            }}
            className="flex-1 flex-row items-center justify-center bg-blue-600 rounded-xl py-3"
          >
            <Plus size={16} color="#fff" />
            <Text className="text-white font-semibold ml-2">New question</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (!topicId) {
                Alert.alert("Pick a topic first", "");
                return;
              }
              setShowBank(true);
            }}
            className="flex-1 flex-row items-center justify-center bg-white border border-slate-300 rounded-xl py-3"
          >
            <Search size={16} color="#0f172a" />
            <Text className="text-slate-900 font-semibold ml-2">From bank</Text>
          </Pressable>
        </View>

        <Spacer />
        <View className="flex-row gap-3">
          <Pressable
            onPress={() => void save(false)}
            disabled={saving || !canSave}
            className="flex-1 bg-slate-100 border border-slate-300 rounded-2xl py-4 items-center"
            style={{ opacity: !canSave || saving ? 0.5 : 1 }}
          >
            <Text className="text-slate-800 font-bold">Save Draft</Text>
          </Pressable>
          <Pressable
            onPress={() => void save(true)}
            disabled={saving || !canSave}
            className="flex-1 bg-emerald-600 rounded-2xl py-4 items-center"
            style={{ opacity: !canSave || saving ? 0.5 : 1 }}
          >
            <Text className="text-white font-bold">{saving ? "Saving…" : "Publish"}</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Curriculum picker (shared bottom sheet) */}
      <PickerSheet
        visible={picker !== null}
        title={
          picker === "course"
            ? "Choose course"
            : picker === "subject"
            ? "Choose subject"
            : picker === "chapter"
            ? "Choose chapter"
            : picker === "topic"
            ? "Choose topic"
            : "Choose batch"
        }
        options={
          picker === "course"
            ? curriculum.courses.map((c) => ({
                key: c.course_id,
                label: c.course_name,
                sublabel: c.course_code,
              }))
            : picker === "subject"
            ? (selectedCourse?.subjects.map((s) => ({ key: s.id, label: s.name })) ?? [])
            : picker === "chapter"
            ? (selectedSubject?.chapters.map((c) => ({ key: c.id, label: c.name })) ?? [])
            : picker === "topic"
            ? (selectedChapter?.topics.map((t) => ({ key: t.id, label: t.name })) ?? [])
            : picker === "batch"
            ? [
                { key: "__null__", label: "Course-wide (no batch)" },
                ...(selectedCourse?.batches.map((b) => ({ key: b.batch_id, label: b.batch_name })) ?? []),
              ]
            : []
        }
        selectedKey={
          picker === "course"
            ? courseId
            : picker === "subject"
            ? subjectId
            : picker === "chapter"
            ? chapterId
            : picker === "topic"
            ? topicId
            : picker === "batch"
            ? batchId ?? "__null__"
            : null
        }
        onSelect={(key) => {
          if (picker === "course") {
            setCourseId(key);
            setSubjectId(null);
            setChapterId(null);
            setTopicId(null);
            setBatchId(null);
          } else if (picker === "subject") {
            setSubjectId(key);
            setChapterId(null);
            setTopicId(null);
          } else if (picker === "chapter") {
            setChapterId(key);
            setTopicId(null);
          } else if (picker === "topic") {
            setTopicId(key);
          } else if (picker === "batch") {
            setBatchId(key === "__null__" ? null : key);
          }
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />

      {/* Question editor modal */}
      <Modal visible={showEditor} animationType="slide" onRequestClose={() => setShowEditor(false)}>
        <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
          <View className="flex-row items-center px-5 pt-3 pb-2">
            <Pressable onPress={() => setShowEditor(false)} className="w-9 h-9 items-center justify-center rounded-full bg-white border border-slate-200">
              <X size={20} color="#0f172a" />
            </Pressable>
            <Text className="text-lg font-bold text-blue-900 ml-3 flex-1">New Question</Text>
            <Pressable
              onPress={() => void saveNewQuestion()}
              disabled={saving}
              className="bg-blue-600 rounded-xl px-4 py-2"
            >
              <Text className="text-white font-semibold">
                {saving ? "Saving…" : "Save"}
              </Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            <Label>Prompt (Markdown + $LaTeX$)</Label>
            <TextInput
              value={draft.prompt_md}
              onChangeText={(v) => setDraft((d) => ({ ...d, prompt_md: v }))}
              placeholder={"e.g. A sphere of mass 2 kg is thrown at angle 30°…\nUse $\\theta$ for math."}
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={4}
              className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-base text-slate-900"
              style={{ minHeight: 100, textAlignVertical: "top" }}
            />
            <Spacer />
            <Label>Difficulty</Label>
            <View className="flex-row gap-2">
              {(["easy", "medium", "hard"] as const).map((d) => (
                <Pressable
                  key={d}
                  onPress={() => setDraft((p) => ({ ...p, difficulty: d }))}
                  className={
                    "flex-1 items-center py-3 rounded-xl border " +
                    (draft.difficulty === d
                      ? "bg-blue-50 border-blue-500"
                      : "bg-white border-slate-200")
                  }
                >
                  <Text className={"font-bold " + (draft.difficulty === d ? "text-blue-700" : "text-slate-700")}>
                    {d.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Spacer />
            <Label>Options (tick correct)</Label>
            {draft.options.map((o, i) => (
              <View key={i} className="flex-row items-center mb-3">
                <Pressable
                  onPress={() =>
                    // Single-answer MCQ: selecting one option clears the rest.
                    // Grading (`quiz-submit`) credits exactly one correct option,
                    // so the editor must not allow ticking multiple.
                    setDraft((p) => ({
                      ...p,
                      options: p.options.map((x, j) => ({ ...x, is_correct: j === i })),
                    }))
                  }
                  className={
                    "w-9 h-9 rounded-lg border items-center justify-center mr-2 " +
                    (o.is_correct ? "bg-emerald-600 border-emerald-600" : "bg-white border-slate-300")
                  }
                >
                  {o.is_correct ? <Check size={18} color="#fff" /> : <Text className="text-slate-500 font-bold">{String.fromCharCode(65 + i)}</Text>}
                </Pressable>
                <TextInput
                  value={o.text_md}
                  onChangeText={(v) =>
                    setDraft((p) => ({
                      ...p,
                      options: p.options.map((x, j) => (j === i ? { ...x, text_md: v } : x)),
                    }))
                  }
                  placeholder={`Option ${String.fromCharCode(65 + i)}`}
                  placeholderTextColor="#94a3b8"
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-base text-slate-900"
                />
              </View>
            ))}
            <Spacer />
            <Label>Explanation</Label>
            <TextInput
              value={draft.explanation_md}
              onChangeText={(v) => setDraft((d) => ({ ...d, explanation_md: v }))}
              placeholder="Why this is correct…"
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={3}
              className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-base text-slate-900"
              style={{ minHeight: 80, textAlignVertical: "top" }}
            />
            <Spacer />
            <RelatedContentPicker
              topicId={topicId}
              value={draft.related_content_id}
              onChange={(id) => setDraft((d) => ({ ...d, related_content_id: id }))}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Bank modal */}
      <QuestionBankModal
        visible={showBank}
        topicId={topicId}
        onClose={() => setShowBank(false)}
        onPicked={(items) => {
          setQuestionIds((prev) => {
            const next = [...prev];
            for (const it of items) if (!next.includes(it.id)) next.push(it.id);
            return next;
          });
          setPromptById((m) => {
            const n = { ...m };
            for (const it of items) n[it.id] = it.prompt_md;
            return n;
          });
          setShowBank(false);
        }}
      />
    </SafeAreaView>
  );
}

// -------- helpers --------
function Label({ children }: { children: string }) {
  return (
    <Text className="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-2">
      {children}
    </Text>
  );
}
function Spacer() {
  return <View style={{ height: 16 }} />;
}
function NumField({ label, value, onChangeText }: { label: string; value: string; onChangeText: (v: string) => void }) {
  return (
    <View className="flex-1">
      <Text className="text-[11px] text-slate-500 mb-1">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="numbers-and-punctuation"
        className="bg-white border border-slate-200 rounded-xl px-3 py-3 text-base text-slate-900"
      />
    </View>
  );
}
function RowSwitch({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <View className="flex-row items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3 mb-2">
      <Text className="flex-1 text-slate-800">{label}</Text>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}
function PickerRow({ label, value, onPress, disabled }: { label: string; value: string | null; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={
        "flex-row items-center bg-white px-4 py-3 rounded-xl border border-slate-200 " +
        (disabled ? "opacity-60" : "")
      }
    >
      <View className="flex-1">
        <Text className="text-[11px] text-slate-500 mb-1">{label}</Text>
        <Text className="text-base text-slate-900 font-semibold">
          {value ?? "Tap to choose"}
        </Text>
      </View>
      <ChevronDown size={18} color="#94a3b8" />
    </Pressable>
  );
}

function RelatedContentPicker({
  topicId,
  value,
  onChange,
}: {
  topicId: string | null;
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [items, setItems] = useState<{ id: string; title: string; kind: string }[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!topicId) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const res = await withTimeout(
        supabase
          .from("content_items")
          .select("id, title, kind")
          .eq("topic_id", topicId)
          .eq("is_published", true)
          .order("created_at", { ascending: false })
          .limit(50),
      );
      if (cancelled) return;
      if (!res.error) {
        setItems((res.data ?? []) as any);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [topicId]);

  return (
    <View>
      <Label>Related content (optional)</Label>
      {loading ? (
        <ActivityIndicator />
      ) : items.length === 0 ? (
        <Text className="text-slate-500">No published items in this topic.</Text>
      ) : (
        <View className="bg-white border border-slate-200 rounded-xl">
          <Pressable
            onPress={() => onChange(null)}
            className={"px-4 py-3 border-b border-slate-100 " + (value === null ? "bg-blue-50" : "")}
          >
            <Text className={value === null ? "text-blue-700 font-bold" : "text-slate-800"}>(none)</Text>
          </Pressable>
          {items.map((it, i) => (
            <Pressable
              key={it.id}
              onPress={() => onChange(it.id)}
              className={
                "px-4 py-3 " +
                (i < items.length - 1 ? "border-b border-slate-100 " : "") +
                (value === it.id ? "bg-blue-50" : "")
              }
            >
              <Text className={value === it.id ? "text-blue-700 font-bold" : "text-slate-800"}>
                [{it.kind}] {it.title}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function QuestionBankModal({
  visible,
  topicId,
  onClose,
  onPicked,
}: {
  visible: boolean;
  topicId: string | null;
  onClose: () => void;
  onPicked: (items: { id: string; prompt_md: string }[]) => void;
}) {
  const bank = useQuestionBank({ topic_id: topicId ?? undefined });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (visible) {
      setSelected(new Set());
      setQuery("");
      if (topicId) void bank.reload({ topic_id: topicId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, topicId]);

  // Topic-scoped list is small (≤200), so filter the loaded rows locally for
  // instant results instead of round-tripping the `search` server filter.
  const q = query.trim().toLowerCase();
  const filtered =
    q.length === 0
      ? bank.rows
      : bank.rows.filter((r) => r.prompt_md.toLowerCase().includes(q));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
        <View className="flex-row items-center px-5 pt-3 pb-2">
          <Pressable onPress={onClose} className="w-9 h-9 items-center justify-center rounded-full bg-white border border-slate-200">
            <X size={20} color="#0f172a" />
          </Pressable>
          <Text className="text-lg font-bold text-blue-900 ml-3 flex-1">Pick from Question Bank</Text>
          <Pressable
            disabled={selected.size === 0}
            onPress={() =>
              onPicked(
                Array.from(selected).map((sid) => ({
                  id: sid,
                  prompt_md: bank.rows.find((r) => r.id === sid)?.prompt_md ?? "",
                })),
              )
            }
            className={"rounded-xl px-4 py-2 " + (selected.size === 0 ? "bg-slate-200" : "bg-blue-600")}
          >
            <Text className={selected.size === 0 ? "text-slate-500" : "text-white font-semibold"}>
              Add ({selected.size})
            </Text>
          </Pressable>
        </View>
        <View className="px-5 pb-3">
          <View className="flex-row items-center bg-white border border-slate-200 rounded-xl px-3">
            <Search size={16} color="#94a3b8" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search questions…"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
              className="flex-1 px-2 py-3 text-base text-slate-900"
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery("")} hitSlop={8} accessibilityLabel="Clear search">
                <X size={16} color="#94a3b8" />
              </Pressable>
            ) : null}
          </View>
        </View>
        {bank.isLoading ? (
          <View className="flex-1 items-center justify-center"><ActivityIndicator color="#2563EB" /></View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(r) => r.id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            ListEmptyComponent={
              <Text className="text-center text-slate-500 mt-8">
                {q.length > 0 ? "No questions match your search." : "No questions in this topic."}
              </Text>
            }
            renderItem={({ item }) => {
              const isPicked = selected.has(item.id);
              return (
                <Pressable
                  onPress={() =>
                    setSelected((prev) => {
                      const n = new Set(prev);
                      if (n.has(item.id)) n.delete(item.id);
                      else n.add(item.id);
                      return n;
                    })
                  }
                  className={"bg-white rounded-xl p-3 border " + (isPicked ? "border-blue-500" : "border-slate-200")}
                >
                  <View className="flex-row items-center">
                    <View className={"w-7 h-7 rounded-md mr-3 items-center justify-center " + (isPicked ? "bg-blue-600" : "bg-slate-100")}>
                      {isPicked ? <Check size={16} color="#fff" /> : null}
                    </View>
                    <View className="flex-1">
                      <Text className="text-slate-900" numberOfLines={2}>{item.prompt_md}</Text>
                      <Text className="text-[11px] text-slate-500 mt-1">
                        {item.option_count} options{item.difficulty ? ` · ${item.difficulty}` : ""}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
