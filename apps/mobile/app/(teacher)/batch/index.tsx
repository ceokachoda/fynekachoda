import { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  CalendarClock,
  ChevronRight,
  Sparkles,
  Users,
} from "lucide-react-native";
import {
  useAssignedBatches,
  type AssignedBatch,
} from "@/features/org/useAssignedBatches";

export default function TeacherBatchListScreen() {
  const router = useRouter();
  const { data, error, isLoading, refresh } = useAssignedBatches();
  const batches = data ?? [];

  const renderItem = useCallback(
    ({ item }: { item: AssignedBatch }) => (
      <BatchRow
        batch={item}
        onPress={() =>
          router.push({
            pathname: "/(teacher)/batch/[id]",
            params: { id: item.batch_id },
          })
        }
      />
    ),
    [router],
  );

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <View className="px-6 pt-2 pb-4">
        <Text className="text-2xl font-extrabold text-slate-900">My batches</Text>
        <Text className="mt-1 text-sm text-slate-500">
          Tap a batch to see its roster. Attendance and exams arrive in later
          phases.
        </Text>
      </View>

      <FlatList
        data={batches}
        keyExtractor={(b) => b.batch_id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor="#2563EB" />
        }
        ListEmptyComponent={
          isLoading && !data ? (
            <View className="px-6 py-10 items-center">
              <ActivityIndicator size="small" color="#2563EB" />
            </View>
          ) : error ? (
            <View className="mx-6 mt-2 rounded-2xl bg-red-50 border border-red-100 p-4">
              <Text className="text-sm font-medium text-red-700">{error}</Text>
            </View>
          ) : (
            <View className="mx-6 mt-2 bg-white rounded-3xl border border-slate-100 p-6 items-center shadow-sm shadow-slate-200/50">
              <Sparkles size={32} color="#94a3b8" />
              <Text className="mt-3 text-base font-bold text-slate-900 text-center">
                No batches assigned yet
              </Text>
              <Text className="mt-1 text-sm text-slate-500 text-center leading-5">
                Ask your institute admin to add you to a batch.
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

function BatchRow({ batch, onPress }: { batch: AssignedBatch; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="mx-6 mt-3 bg-white rounded-3xl border border-slate-100 p-5 shadow-sm shadow-slate-200/50"
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
            {batch.course_code}
          </Text>
          <Text
            className="mt-1 text-lg font-extrabold text-slate-900"
            numberOfLines={1}
          >
            {batch.batch_name}
          </Text>
          <Text className="text-xs font-medium text-slate-500 mt-0.5">
            {batch.course_name}
          </Text>
        </View>
        <ChevronRight size={20} color="#cbd5e1" />
      </View>

      <View className="mt-4 flex-row items-center">
        <View className="flex-row items-center mr-5">
          <Users size={14} color="#475569" />
          <Text className="ml-1.5 text-xs font-semibold text-slate-700">
            {batch.student_count}{" "}
            <Text className="font-medium text-slate-500">
              student{batch.student_count === 1 ? "" : "s"}
            </Text>
          </Text>
        </View>
        <View className="flex-row items-center">
          <CalendarClock size={14} color="#475569" />
          <Text className="ml-1.5 text-xs font-semibold text-slate-700">
            {batch.next_session?.label ?? (
              <Text className="font-medium text-slate-400">No schedule set</Text>
            )}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
