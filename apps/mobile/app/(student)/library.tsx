import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileText,
  PlayCircle,
  Search,
  StickyNote,
} from "lucide-react-native";
import { useLibraryTree } from "@/features/library/useLibraryTree";

type LibraryView = "subjects" | "chapters" | "topics" | "items";

export default function LibraryScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const { data: tree, isLoading, error, refresh } = useLibraryTree(searchQuery);
  const [view, setView] = useState<LibraryView>("subjects");
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);

  const currentSubject = useMemo(
    () => tree.subjects.find((s) => s.id === subjectId) ?? null,
    [tree, subjectId],
  );
  const currentChapter = useMemo(
    () => currentSubject?.chapters.find((c) => c.id === chapterId) ?? null,
    [currentSubject, chapterId],
  );
  const currentTopic = useMemo(
    () => currentChapter?.topics.find((t) => t.id === topicId) ?? null,
    [currentChapter, topicId],
  );

  const goBack = () => {
    if (view === "items") {
      setTopicId(null);
      setView("topics");
    } else if (view === "topics") {
      setChapterId(null);
      setView("chapters");
    } else if (view === "chapters") {
      setSubjectId(null);
      setView("subjects");
    }
  };

  // Re-fetch the catalog every time the Library tab regains focus, so that
  // newly published / promoted teacher content appears without an app
  // restart. The hook itself only fetches once on mount.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <View className="px-5 pt-3 pb-2 flex-row items-center">
        {view !== "subjects" ? (
          <Pressable
            accessibilityLabel="Back"
            onPress={goBack}
            className="w-9 h-9 items-center justify-center rounded-full bg-white border border-slate-200 mr-3"
          >
            <ChevronLeft size={20} color="#1e293b" />
          </Pressable>
        ) : null}
        <Text className="text-2xl font-extrabold text-blue-900 flex-1">
          {view === "subjects"
            ? "Library"
            : view === "chapters"
            ? currentSubject?.name ?? "Subject"
            : view === "topics"
            ? currentChapter?.name ?? "Chapter"
            : currentTopic?.name ?? "Topic"}
        </Text>
      </View>

      {view === "subjects" ? (
        <View className="px-5 mb-3">
          <View className="flex-row items-center bg-white h-11 px-4 rounded-2xl border border-slate-200">
            <Search size={18} color="#94a3b8" />
            <TextInput
              placeholder="Search library…"
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="flex-1 ml-3 text-base text-slate-800"
              placeholderTextColor="#94a3b8"
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>
        </View>
      ) : null}

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : error ? (
        <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingTop: 24 }}>
          <Text className="text-red-600 mb-3">{error}</Text>
          <Pressable
            onPress={() => void refresh()}
            className="bg-blue-600 px-4 py-2 rounded-xl self-start"
          >
            <Text className="text-white font-semibold">Retry</Text>
          </Pressable>
        </ScrollView>
      ) : view === "subjects" ? (
        <FlatList
          key="subjects"
          data={tree.subjects}
          keyExtractor={(s) => s.id}
          numColumns={2}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 100 }}
          columnWrapperStyle={{ gap: 12 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={
            <View className="p-8 items-center">
              <BookOpen color="#94a3b8" size={32} />
              <Text className="text-slate-500 mt-2 text-center">
                No subjects in your course yet.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                setSubjectId(item.id);
                setView("chapters");
              }}
              className="flex-1 bg-white rounded-2xl p-4 border border-slate-200"
            >
              <View className="w-10 h-10 bg-blue-100 rounded-xl items-center justify-center mb-3">
                <BookOpen size={20} color="#2563EB" />
              </View>
              <Text className="text-base font-bold text-blue-900" numberOfLines={2}>
                {item.name}
              </Text>
              <Text className="text-xs text-slate-500 mt-1">
                {item.item_count} item{item.item_count === 1 ? "" : "s"}
              </Text>
            </Pressable>
          )}
        />
      ) : view === "chapters" ? (
        <FlatList
          key="chapters"
          data={currentSubject?.chapters ?? []}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <Text className="text-center text-slate-500 mt-8">
              No chapters yet.
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                setChapterId(item.id);
                setView("topics");
              }}
              className="flex-row items-center bg-white rounded-2xl p-4 border border-slate-200"
            >
              <View className="flex-1">
                <Text className="text-base font-bold text-slate-900">
                  {item.name}
                </Text>
                <Text className="text-xs text-slate-500 mt-1">
                  {item.item_count} item{item.item_count === 1 ? "" : "s"}
                </Text>
              </View>
              <ChevronRight size={18} color="#94a3b8" />
            </Pressable>
          )}
        />
      ) : view === "topics" ? (
        <FlatList
          key="topics"
          data={currentChapter?.topics ?? []}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <Text className="text-center text-slate-500 mt-8">No topics.</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                setTopicId(item.id);
                setView("items");
              }}
              disabled={item.item_count === 0}
              className={
                "flex-row items-center bg-white rounded-2xl p-4 border border-slate-200 " +
                (item.item_count === 0 ? "opacity-60" : "")
              }
            >
              <View className="flex-1">
                <Text className="text-base font-bold text-slate-900">
                  {item.name}
                </Text>
                <Text className="text-xs text-slate-500 mt-1">
                  {item.item_count === 0
                    ? "No content yet"
                    : `${item.item_count} item${item.item_count === 1 ? "" : "s"}`}
                </Text>
              </View>
              {item.item_count > 0 ? (
                <ChevronRight size={18} color="#94a3b8" />
              ) : null}
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          key="items"
          data={currentTopic?.items ?? []}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <Text className="text-center text-slate-500 mt-8">
              No content in this topic.
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                if (item.kind === "video") {
                  router.push(`/video/${item.id}` as never);
                } else {
                  router.push(`/pdf/${item.id}` as never);
                }
              }}
              className="flex-row items-center bg-white rounded-2xl p-4 border border-slate-200"
            >
              <View
                className={
                  "w-10 h-10 rounded-xl items-center justify-center mr-3 " +
                  (item.kind === "video"
                    ? "bg-red-100"
                    : item.kind === "pdf"
                    ? "bg-emerald-100"
                    : "bg-amber-100")
                }
              >
                {item.kind === "video" ? (
                  <PlayCircle size={20} color="#ef4444" />
                ) : item.kind === "pdf" ? (
                  <FileText size={20} color="#059669" />
                ) : (
                  <StickyNote size={20} color="#d97706" />
                )}
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-slate-900" numberOfLines={2}>
                  {item.title}
                </Text>
                <Text className="text-[11px] text-slate-500 mt-1">
                  {item.kind.toUpperCase()}
                  {item.duration_sec
                    ? ` • ${Math.round((item.duration_sec ?? 0) / 60)} min`
                    : ""}
                  {item.batch_id === null ? " • course-wide" : ""}
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
