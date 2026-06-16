import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { CheckCircle2, ChevronRight, ListChecks, Search } from "lucide-react-native";
import { useStudentQuizDiscovery } from "@/features/quiz/useQuizDiscovery";
import { LoadingScreen } from "@/components/LoadingScreen";
import { StudentHeader } from "@/components/StudentHeader";

export default function PracticeScreen() {
  const router = useRouter();
  const { list, isLoading, error, reload } = useStudentQuizDiscovery();
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Re-fetch every time the tab regains focus so newly published / promoted
  // quizzes appear without an app restart (the hook itself only fetches once).
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  // Manual pull-to-refresh owns its own spinner so the on-focus reload doesn't
  // flip the pull spinner mid-scroll.
  const onPullRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((quiz) => quiz.title.toLowerCase().includes(q));
  }, [list, searchQuery]);

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <StudentHeader />
      <View className="px-5 pt-1 pb-2">
        <Text className="text-2xl font-extrabold text-blue-900">Quizzes</Text>
        <Text className="text-xs text-slate-500 mt-0.5">
          Practice quizzes for your batch
        </Text>
      </View>

      <View className="px-5 mb-3">
        <View className="flex-row items-center bg-white h-11 px-4 rounded-2xl border border-slate-200">
          <Search size={18} color="#94a3b8" />
          <TextInput
            placeholder="Search quizzes…"
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 ml-3 text-base text-slate-800"
            placeholderTextColor="#94a3b8"
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>
      </View>

      {isLoading && list.length === 0 ? (
        <LoadingScreen background="bg-transparent" />
      ) : error ? (
        <View className="flex-1 px-5 pt-6">
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
          data={filtered}
          keyExtractor={(q) => q.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onPullRefresh}
              tintColor="#2563EB"
            />
          }
          ListEmptyComponent={
            <View className="p-8 items-center">
              <ListChecks color="#94a3b8" size={32} />
              <Text className="text-slate-500 mt-2 text-center">
                {searchQuery.trim()
                  ? "No quizzes match your search."
                  : "No quizzes available yet."}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const attempted = item.attempt_count > 0;
            const pct =
              item.best_score !== null && item.best_max_score
                ? Math.round((item.best_score / item.best_max_score) * 100)
                : null;
            return (
              <Pressable
                onPress={() => router.push(`/quiz/${item.id}` as never)}
                className="flex-row items-center bg-white rounded-2xl p-4 border border-slate-200"
              >
                <View
                  className={
                    "w-10 h-10 rounded-xl items-center justify-center mr-3 " +
                    (attempted ? "bg-emerald-100" : "bg-blue-100")
                  }
                >
                  {attempted ? (
                    <CheckCircle2 size={20} color="#059669" />
                  ) : (
                    <ListChecks size={20} color="#2563EB" />
                  )}
                </View>
                <View className="flex-1">
                  <Text
                    className="text-sm font-bold text-slate-900"
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                  <Text className="text-[11px] text-slate-500 mt-1">
                    QUIZ · {item.duration_min} min ·{" "}
                    {attempted
                      ? `attempted ${item.attempt_count}x${
                          pct !== null ? `, best ${pct}%` : ""
                        }`
                      : "not attempted"}
                  </Text>
                </View>
                <ChevronRight size={18} color="#94a3b8" />
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
