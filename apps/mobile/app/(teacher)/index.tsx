import { useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  BookOpenCheck,
  CalendarClock,
  ChevronRight,
  QrCode,
  Sparkles,
  Upload,
  Users,
} from "lucide-react-native";
import { useSession } from "@/features/auth/useSession";
import {
  useAssignedBatches,
  type AssignedBatch,
} from "@/features/org/useAssignedBatches";

export default function TeacherHomeScreen() {
  const router = useRouter();
  const { appUser } = useSession();
  const { data, error, isLoading, refresh } = useAssignedBatches();

  const firstName = (appUser?.full_name ?? "teacher").split(/\s+/)[0];
  const batches = data ?? [];

  const renderItem = useCallback(
    ({ item }: { item: AssignedBatch }) => (
      <BatchCard
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
      <FlatList
        data={batches}
        keyExtractor={(b) => b.batch_id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor="#2563EB" />
        }
        ListHeaderComponent={
          <View>
            <View className="px-6 pt-2 pb-4">
              <Text className="text-sm font-medium text-slate-500">Welcome back</Text>
              <Text className="text-2xl font-extrabold text-slate-900">
                Hi, {firstName}
              </Text>
              <Text className="mt-1 text-sm text-slate-500">
                {appUser?.email ?? ""}
              </Text>
            </View>

            <View className="px-6 mb-6">
              <Text className="text-lg font-bold text-slate-900 mb-3 px-1">
                Quick actions
              </Text>
              <View className="flex-row gap-3">
                <QuickActionTile
                  label="Scan"
                  hint="Phase 4"
                  icon={<QrCode size={22} color="#94a3b8" />}
                  tone="bg-blue-50"
                />
                <QuickActionTile
                  label="New exam"
                  hint="Phase 6"
                  icon={<BookOpenCheck size={22} color="#94a3b8" />}
                  tone="bg-amber-50"
                />
                <QuickActionTile
                  label="Upload"
                  hint="Phase 5"
                  icon={<Upload size={22} color="#94a3b8" />}
                  tone="bg-emerald-50"
                />
              </View>
            </View>

            <View className="px-6 mb-2 flex-row items-end justify-between">
              <Text className="text-lg font-bold text-slate-900">My batches</Text>
              <Text className="text-xs font-medium text-slate-500">
                {isLoading && !data
                  ? "Loading…"
                  : `${batches.length} assigned`}
              </Text>
            </View>

            {isLoading && !data && (
              <View className="px-6 py-10 items-center">
                <ActivityIndicator size="small" color="#2563EB" />
              </View>
            )}

            {!isLoading && error && (
              <View className="mx-6 mb-4 rounded-2xl bg-red-50 border border-red-100 p-4">
                <Text className="text-sm font-medium text-red-700">{error}</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          !isLoading && !error ? (
            <View className="mx-6 mt-2 bg-white rounded-3xl border border-slate-100 p-6 items-center shadow-sm shadow-slate-200/50">
              <Sparkles size={32} color="#94a3b8" />
              <Text className="mt-3 text-base font-bold text-slate-900 text-center">
                No batches assigned yet
              </Text>
              <Text className="mt-1 text-sm text-slate-500 text-center leading-5">
                Ask your institute admin to add you to a batch. Once you’re
                assigned, your students and schedule will appear here.
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function QuickActionTile({
  label,
  hint,
  icon,
  tone,
}: {
  label: string;
  hint: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() =>
        Alert.alert(`${label} — coming soon`, `This action arrives in ${hint}.`)
      }
      className="flex-1 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm shadow-slate-200/50 items-start"
    >
      <View className={`w-10 h-10 rounded-xl ${tone} items-center justify-center mb-3`}>
        {icon}
      </View>
      <Text className="text-sm font-bold text-slate-700">{label}</Text>
      <Text className="text-[11px] font-medium text-slate-400 mt-0.5">{hint}</Text>
    </TouchableOpacity>
  );
}

function BatchCard({ batch, onPress }: { batch: AssignedBatch; onPress: () => void }) {
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
