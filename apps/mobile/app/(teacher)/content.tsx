import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronDown, FileText, PlayCircle, StickyNote } from "lucide-react-native";
import * as DocumentPicker from "expo-document-picker";
import { supabase } from "@/lib/supabase";
import { useTeacherCurriculum } from "@/features/library/useTeacherCurriculum";
import { LoadingScreen } from "@/components/LoadingScreen";

type Kind = "video" | "pdf" | "note";
type Scope = "batch" | "suggest";

interface PresignResp {
  upload_url: string;
  path: string;
  token: string;
  expires_at: string;
  bucket: string;
  course_id: string;
}

const KIND_LABELS: Record<Kind, string> = {
  video: "Video",
  pdf: "PDF",
  note: "Note",
};

function PickerRow({
  label,
  value,
  onPress,
  disabled = false,
}: {
  label: string;
  value: string | null;
  onPress: () => void;
  disabled?: boolean;
}) {
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

function CheckRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row gap-2">
      {options.map((o) => (
        <Pressable
          key={o.value}
          onPress={() => onChange(o.value)}
          className={
            "flex-1 flex-row items-center justify-center gap-1 py-3 rounded-xl border " +
            (value === o.value
              ? "bg-blue-50 border-blue-500"
              : "bg-white border-slate-200")
          }
        >
          {o.icon}
          <Text
            className={
              "text-sm font-bold " +
              (value === o.value ? "text-blue-700" : "text-slate-700")
            }
          >
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function TeacherContentUpload() {
  const { courses, isLoading: curriculumLoading, error: curriculumErr } =
    useTeacherCurriculum();

  const [kind, setKind] = useState<Kind>("video");
  const [courseId, setCourseId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>("batch");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ytUrl, setYtUrl] = useState("");
  const [pickedFile, setPickedFile] = useState<
    { uri: string; name: string; size: number; mimeType: string | null } | null
  >(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [picker, setPicker] = useState<
    "course" | "subject" | "chapter" | "topic" | "batch" | null
  >(null);

  useEffect(() => {
    if (courses.length === 1 && !courseId) {
      setCourseId(courses[0]!.course_id);
    }
  }, [courses, courseId]);

  const selectedCourse = useMemo(
    () => courses.find((c) => c.course_id === courseId) ?? null,
    [courses, courseId],
  );
  const selectedSubject = selectedCourse?.subjects.find((s) => s.id === subjectId) ?? null;
  const selectedChapter = selectedSubject?.chapters.find((c) => c.id === chapterId) ?? null;
  const selectedTopic = selectedChapter?.topics.find((t) => t.id === topicId) ?? null;
  const selectedBatch = selectedCourse?.batches.find((b) => b.batch_id === batchId) ?? null;

  const onPickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled) return;
      const f = res.assets[0]!;
      if (!f) return;
      if ((f.size ?? 0) > 50 * 1024 * 1024) {
        Alert.alert("File too large", "Max 50 MB per file.");
        return;
      }
      setPickedFile({
        uri: f.uri,
        name: f.name,
        size: f.size ?? 0,
        mimeType: f.mimeType ?? "application/pdf",
      });
    } catch (e) {
      Alert.alert("Pick failed", (e as Error).message);
    }
  };

  const reset = () => {
    setTitle("");
    setDescription("");
    setYtUrl("");
    setPickedFile(null);
    setUploadPct(0);
  };

  const onSubmit = async () => {
    if (!topicId || !title.trim()) {
      Alert.alert("Missing fields", "Pick a topic and add a title.");
      return;
    }
    if (scope === "batch" && !batchId) {
      Alert.alert("Missing batch", "Pick a batch or switch scope to Suggest.");
      return;
    }
    setSubmitting(true);
    setUploadPct(0);
    try {
      const effectiveBatch = scope === "batch" ? batchId : undefined;
      if (kind === "video") {
        if (!ytUrl.trim()) {
          Alert.alert("Missing URL", "Paste the YouTube URL of the lesson.");
          setSubmitting(false);
          return;
        }
        const { data, error } = await supabase.functions.invoke(
          "content-create-video",
          {
            body: {
              yt_url_or_id: ytUrl.trim(),
              topic_id: topicId,
              title: title.trim(),
              description: description.trim() || undefined,
              batch_id: effectiveBatch,
            },
          },
        );
        if (error) {
          Alert.alert(
            "Upload failed",
            (error as Error).message ?? "Server rejected the request",
          );
          return;
        }
        Alert.alert(
          "Added",
          (data as { yt_verified?: boolean })?.yt_verified === false
            ? "Linked. (YT verification is currently disabled — admin will review.)"
            : "Video linked successfully.",
        );
        reset();
        return;
      }

      // PDF / Note flow
      if (!pickedFile) {
        Alert.alert("Pick a file", "Choose a PDF to upload.");
        return;
      }
      const presign = await supabase.functions.invoke<PresignResp>(
        "content-presign-upload",
        {
          body: {
            kind,
            topic_id: topicId,
            title: title.trim(),
            batch_id: effectiveBatch,
            content_size_bytes: pickedFile.size,
            mime_type: pickedFile.mimeType ?? "application/pdf",
          },
        },
      );
      if (presign.error || !presign.data) {
        Alert.alert(
          "Upload failed",
          (presign.error as Error | null)?.message ?? "presign rejected",
        );
        return;
      }
      const fileBlob = await (await fetch(pickedFile.uri)).blob();
      // Supabase signed-upload-url is PUT-style; supports XHR with progress.
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadPct(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`upload http ${xhr.status}: ${xhr.responseText}`));
        };
        xhr.onerror = () => reject(new Error("upload network error"));
        xhr.open("PUT", presign.data!.upload_url, true);
        xhr.setRequestHeader(
          "Content-Type",
          pickedFile.mimeType ?? "application/pdf",
        );
        xhr.send(fileBlob);
      });

      const fin = await supabase.functions.invoke("content-finalize", {
        body: {
          kind,
          topic_id: topicId,
          title: title.trim(),
          description: description.trim() || undefined,
          batch_id: effectiveBatch,
          file_path: presign.data.path,
          file_size_bytes: pickedFile.size,
          mime_type: pickedFile.mimeType ?? "application/pdf",
        },
      });
      if (fin.error) {
        Alert.alert(
          "Upload failed",
          (fin.error as Error).message ?? "finalize rejected",
        );
        return;
      }
      Alert.alert("Uploaded", "Content added to library.");
      reset();
    } catch (e) {
      Alert.alert("Failed", (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (curriculumLoading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <LoadingScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        <Text className="text-2xl font-extrabold text-blue-900 mb-1">
          Upload Content
        </Text>
        <Text className="text-sm text-slate-500 mb-5">
          Add a YouTube video link or a PDF for your students.
        </Text>

        {curriculumErr ? (
          <Text className="text-red-600 mb-3">{curriculumErr}</Text>
        ) : null}

        <Text className="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-2">
          Kind
        </Text>
        <CheckRow<Kind>
          value={kind}
          onChange={setKind}
          options={[
            { value: "video", label: "Video", icon: <PlayCircle size={16} color="#374151" /> },
            { value: "pdf", label: "PDF", icon: <FileText size={16} color="#374151" /> },
            { value: "note", label: "Note", icon: <StickyNote size={16} color="#374151" /> },
          ]}
        />

        <View className="h-4" />

        <View className="gap-3">
          {courses.length > 1 ? (
            <PickerRow
              label="Course"
              value={selectedCourse
                ? `${selectedCourse.course_code} · ${selectedCourse.course_name}`
                : null}
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
        </View>

        <View className="h-4" />
        <Text className="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-2">
          Scope
        </Text>
        <CheckRow<Scope>
          value={scope}
          onChange={setScope}
          options={[
            { value: "batch", label: "My Batch" },
            { value: "suggest", label: "Suggest course-wide" },
          ]}
        />
        {scope === "batch" ? (
          <View className="mt-3">
            <PickerRow
              label="Batch"
              value={selectedBatch?.batch_name ?? null}
              onPress={() => setPicker("batch")}
              disabled={!selectedCourse}
            />
          </View>
        ) : (
          <Text className="text-xs text-slate-500 mt-2">
            Admin reviews course-wide suggestions before students see them.
          </Text>
        )}

        <View className="h-4" />
        <Text className="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-2">
          Title
        </Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Intro to Projectile Motion"
          placeholderTextColor="#94a3b8"
          className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-base text-slate-900"
        />

        <View className="h-3" />
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Description (optional)"
          placeholderTextColor="#94a3b8"
          multiline
          numberOfLines={3}
          className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-base text-slate-900"
          style={{ minHeight: 80, textAlignVertical: "top" }}
        />

        {kind === "video" ? (
          <View>
            <View className="h-4" />
            <Text className="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-2">
              YouTube URL
            </Text>
            <TextInput
              value={ytUrl}
              onChangeText={setYtUrl}
              placeholder="https://youtu.be/…  (must be Unlisted on institute channel)"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
              className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-base text-slate-900"
            />
          </View>
        ) : (
          <View>
            <View className="h-4" />
            <Text className="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-2">
              File
            </Text>
            <Pressable
              onPress={onPickFile}
              className="bg-white border border-dashed border-slate-300 rounded-xl px-4 py-5 items-center"
            >
              <FileText size={24} color="#94a3b8" />
              <Text className="mt-2 text-sm font-semibold text-slate-700">
                {pickedFile ? pickedFile.name : "Pick a PDF (max 50 MB)"}
              </Text>
              {pickedFile ? (
                <Text className="text-xs text-slate-500 mt-1">
                  {(pickedFile.size / (1024 * 1024)).toFixed(1)} MB
                </Text>
              ) : null}
            </Pressable>
          </View>
        )}

        {submitting && uploadPct > 0 && uploadPct < 100 ? (
          <View className="mt-4">
            <View className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <View
                style={{ width: `${uploadPct}%` }}
                className="h-full bg-blue-500"
              />
            </View>
            <Text className="text-xs text-slate-500 mt-1">
              Uploading {uploadPct}%…
            </Text>
          </View>
        ) : null}

        <View className="h-6" />
        <Pressable
          onPress={onSubmit}
          disabled={submitting}
          className={
            "py-4 rounded-2xl items-center " +
            (submitting ? "bg-blue-300" : "bg-blue-600")
          }
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold">Upload</Text>
          )}
        </Pressable>
      </ScrollView>

      {/* Pickers — full-screen modal pattern */}
      {picker ? (
        <View className="absolute inset-0 bg-black/40 justify-end">
          <View
            style={{ maxHeight: "75%" }}
            className="bg-white rounded-t-3xl p-5"
          >
            <View className="flex-row items-center mb-3">
              <Text className="text-lg font-bold text-blue-900 flex-1">
                {picker === "course"
                  ? "Pick course"
                  : picker === "subject"
                  ? "Pick subject"
                  : picker === "chapter"
                  ? "Pick chapter"
                  : picker === "topic"
                  ? "Pick topic"
                  : "Pick batch"}
              </Text>
              <Pressable
                onPress={() => setPicker(null)}
                className="px-3 py-1 rounded-lg bg-slate-100"
              >
                <Text className="text-slate-700 font-semibold">Close</Text>
              </Pressable>
            </View>
            <ScrollView>
              {picker === "course" ? (
                courses.map((c) => (
                  <Pressable
                    key={c.course_id}
                    onPress={() => {
                      setCourseId(c.course_id);
                      setSubjectId(null);
                      setChapterId(null);
                      setTopicId(null);
                      setBatchId(null);
                      setPicker(null);
                    }}
                    className="py-3 border-b border-slate-100"
                  >
                    <Text className="text-base text-slate-900 font-semibold">
                      {c.course_code} · {c.course_name}
                    </Text>
                  </Pressable>
                ))
              ) : picker === "subject" ? (
                (selectedCourse?.subjects ?? []).map((s) => (
                  <Pressable
                    key={s.id}
                    onPress={() => {
                      setSubjectId(s.id);
                      setChapterId(null);
                      setTopicId(null);
                      setPicker(null);
                    }}
                    className="py-3 border-b border-slate-100"
                  >
                    <Text className="text-base text-slate-900">{s.name}</Text>
                  </Pressable>
                ))
              ) : picker === "chapter" ? (
                (selectedSubject?.chapters ?? []).map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => {
                      setChapterId(c.id);
                      setTopicId(null);
                      setPicker(null);
                    }}
                    className="py-3 border-b border-slate-100"
                  >
                    <Text className="text-base text-slate-900">{c.name}</Text>
                  </Pressable>
                ))
              ) : picker === "topic" ? (
                (selectedChapter?.topics ?? []).map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={() => {
                      setTopicId(t.id);
                      setPicker(null);
                    }}
                    className="py-3 border-b border-slate-100"
                  >
                    <Text className="text-base text-slate-900">{t.name}</Text>
                  </Pressable>
                ))
              ) : (
                (selectedCourse?.batches ?? []).map((b) => (
                  <Pressable
                    key={b.batch_id}
                    onPress={() => {
                      setBatchId(b.batch_id);
                      setPicker(null);
                    }}
                    className="py-3 border-b border-slate-100"
                  >
                    <Text className="text-base text-slate-900">{b.batch_name}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
