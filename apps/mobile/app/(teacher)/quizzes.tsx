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
import { ChevronRight, FilePlus2, ListChecks } from "lucide-react-native";
import { useTeacherQuizzes } from "@/features/quiz/useTeacherQuizzes";

export default function TeacherQuizzesScreen() {
  const router = useRouter();
  const { rows, isLoading, error, reload } = useTeacherQuizzes();

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <View className="px-5 pt-3 pb-2 flex-row items-center justify-between">
        <Text className="text-2xl font-extrabold text-blue-900">Quizzes</Text>
        <Pressable
          accessibilityLabel="New Quiz"
          onPress={() => router.push("/quiz-builder/new" as never)}
          className="bg-blue-600 rounded-full flex-row items-center px-4 py-2"
        >
          <FilePlus2 size={16} color="#ffffff" />
          <Text className="text-white font-semibold ml-2">New</Text>
        </Pressable>
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
              <ListChecks color="#94a3b8" size={32} />
              <Text className="text-slate-500 mt-2 text-center">
                No quizzes yet. Tap "New" to create your first one.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/quiz-builder/${item.id}` as never)}
              className="flex-row items-center bg-white rounded-2xl p-4 border border-slate-200"
            >
              <View className="w-10 h-10 bg-blue-100 rounded-xl items-center justify-center mr-3">
                <ListChecks size={20} color="#2563EB" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-slate-900" numberOfLines={1}>
                  {item.title || "(untitled)"}
                </Text>
                <Text className="text-xs text-slate-500 mt-1">
                  {item.question_count} question{item.question_count === 1 ? "" : "s"} · {item.duration_min} min · {item.is_published ? "Published" : "Draft"}
                </Text>
              </View>
              <ChevronRight size={18} color="#94a3b8" />
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
