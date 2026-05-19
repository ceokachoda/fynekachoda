// Phase 7 — teacher Exams tab. Lists exams the teacher created OR in their
// assigned batches (RLS scopes), plus quick links to the exam builder and
// the offline-scores entry screen.

import { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ClipboardEdit,
  FileCheck2,
  FilePlus2,
  Lock,
  PenLine,
  Unlock,
} from "lucide-react-native";
import { useTeacherExams } from "@/features/exam/useTeacherExams";

function fmtIstDateTime(iso: string): string {
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

export default function TeacherExamsScreen() {
  const router = useRouter();
  const { rows, isLoading, error, reload } = useTeacherExams();

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <View className="px-5 pt-3 pb-2 flex-row items-center justify-between">
        <Text className="text-2xl font-extrabold text-blue-900">Exams</Text>
        <View className="flex-row">
          <Pressable
            accessibilityLabel="Offline scores"
            onPress={() => router.push("/offline-scores" as never)}
            className="bg-white border border-slate-200 rounded-full flex-row items-center px-3 py-2 mr-2"
          >
            <PenLine size={14} color="#0f172a" />
            <Text className="text-slate-800 font-semibold ml-1.5">Offline</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="New Exam"
            onPress={() => router.push("/exam-builder/new" as never)}
            className="bg-blue-600 rounded-full flex-row items-center px-4 py-2"
          >
            <FilePlus2 size={16} color="#ffffff" />
            <Text className="text-white font-semibold ml-2">New</Text>
          </Pressable>
        </View>
      </View>

      {isLoading && rows.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : error ? (
        <View className="m-6">
          <Text className="text-red-600 mb-3">{error}</Text>
          <Pressable
            onPress={() => void reload()}
            className="bg-blue-600 px-4 py-2 rounded-xl self-start"
          >
            <Text className="text-white font-semibold">Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 80 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <View className="p-8 items-center">
              <ClipboardEdit color="#94a3b8" size={32} />
              <Text className="text-slate-500 mt-2 text-center">
                No exams yet. Tap "New" to create your first graded test.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const released = !!item.results_released_at;
            const now = new Date();
            const start = new Date(item.starts_at);
            const end = new Date(
              start.getTime() + item.duration_min * 60_000,
            );
            const status = !item.is_published
              ? "Draft"
              : now < start
              ? "Scheduled"
              : now < end
              ? "Live now"
              : released
              ? "Released"
              : "Closed";
            const statusColor =
              status === "Draft"
                ? "#94a3b8"
                : status === "Scheduled"
                ? "#2563EB"
                : status === "Live now"
                ? "#dc2626"
                : status === "Released"
                ? "#059669"
                : "#475569";
            return (
              <Pressable
                onPress={() => router.push(`/exam-builder/${item.id}` as never)}
                className="bg-white rounded-2xl p-4 border border-slate-200"
              >
                <View className="flex-row items-start">
                  <View className="w-10 h-10 bg-blue-100 rounded-xl items-center justify-center mr-3">
                    <FileCheck2 size={20} color="#2563EB" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-bold text-slate-900" numberOfLines={1}>
                      {item.title || "(untitled)"}
                    </Text>
                    <Text className="text-xs text-slate-500 mt-1">
                      {item.batch_name} · {fmtIstDateTime(item.starts_at)} · {item.duration_min} min
                    </Text>
                    <Text className="text-xs mt-1 font-semibold" style={{ color: statusColor }}>
                      {status} · {item.question_count} Qs · {item.attempt_count} attempt{item.attempt_count === 1 ? "" : "s"}
                    </Text>
                  </View>
                </View>
                <View className="flex-row mt-3 gap-2">
                  <Pressable
                    onPress={() => router.push(`/exam-results/${item.id}` as never)}
                    className="flex-1 bg-slate-100 border border-slate-200 rounded-xl py-2 items-center flex-row justify-center"
                  >
                    {released ? (
                      <Unlock size={14} color="#0f172a" />
                    ) : (
                      <Lock size={14} color="#0f172a" />
                    )}
                    <Text className="ml-2 text-slate-800 font-semibold">
                      {released ? "Results · Released" : "Results · Locked"}
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
