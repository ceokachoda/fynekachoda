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
import { useFocusEffect, useRouter } from "expo-router";
import {
  BookOpenCheck,
  CalendarClock,
  ChevronRight,
  QrCode,
  Radio,
  Sparkles,
  Upload,
  Users,
} from "lucide-react-native";
import { useSession } from "@/features/auth/useSession";
import { useAssignedBatches, type AssignedBatch } from "@/features/org/useAssignedBatches";
import { useTeacherDashboard } from "@/features/dashboard/useTeacherDashboard";
import { PendingList } from "@/components/teacher/PendingList";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function minsPhrase(sec: number): string {
  const m = Math.max(0, Math.round(sec / 60));
  if (m < 1) return "starting now";
  if (m < 60) return `in ${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `in ${h}h ${rem}m` : `in ${h}h`;
}

export default function TeacherHomeScreen() {
  const router = useRouter();
  const { appUser } = useSession();
  const { data, error, isLoading, refresh } = useAssignedBatches();
  const dash = useTeacherDashboard();

  const firstName = (appUser?.full_name ?? "teacher").split(/\s+/)[0];
  const batches = data ?? [];

  // Depend on the STABLE reload fn, never the whole `dash` object (a fresh
  // literal every render). Using `dash` as a dep changes the focus-effect
  // callback every render → useFocusEffect re-runs → reload → re-render → loop
  // (the up/down flicker). Same gotcha as the student Classes screen.
  const reloadDash = dash.reload;
  const onRefresh = useCallback(() => {
    void refresh();
    void reloadDash();
  }, [refresh, reloadDash]);

  useFocusEffect(useCallback(() => { void reloadDash(); }, [reloadDash]));

  const renderItem = useCallback(
    ({ item }: { item: AssignedBatch }) => (
      <BatchCard
        batch={item}
        onPress={() => router.push({ pathname: "/(teacher)/batch/[id]", params: { id: item.batch_id } })}
      />
    ),
    [router],
  );

  const next = dash.data?.next;

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <FlatList
        data={batches}
        keyExtractor={(b) => b.batch_id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor="#2563EB" />}
        ListHeaderComponent={
          <View>
            <View className="px-6 pt-2 pb-4">
              <Text className="text-sm font-medium text-slate-500">Welcome back</Text>
              <Text className="text-2xl font-extrabold text-slate-900">Hi, {firstName}</Text>
              <Text className="mt-1 text-sm text-slate-500">
                {new Date().toLocaleDateString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  weekday: "long",
                  day: "2-digit",
                  month: "short",
                })}
              </Text>
            </View>

            {next ? (
              <View className="px-6 mb-6">
                <View className="bg-blue-600 rounded-[28px] p-5 shadow-sm shadow-blue-300/40">
                  <Text className="text-white/70 text-[11px] font-bold uppercase tracking-wider">Next</Text>
                  <Text className="text-white text-lg font-extrabold mt-1" numberOfLines={1}>
                    {next.subject} · {next.batch}
                  </Text>
                  <Text className="text-white/80 text-sm mt-1">
                    {next.status === "live" ? "Live now" : `${fmtTime(next.start)} · ${minsPhrase(next.starts_in_sec)}`}
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push("/(teacher)/scan" as never)}
                    className="bg-white rounded-xl py-3 items-center mt-4 flex-row justify-center"
                    activeOpacity={0.9}
                  >
                    <QrCode size={18} color="#1d4ed8" style={{ marginRight: 8 }} />
                    <Text className="text-blue-700 font-bold text-base">Take Attendance</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            <View className="px-6 mb-6">
              <Text className="text-lg font-bold text-slate-900 mb-3">Pending</Text>
              {dash.isLoading && !dash.data ? (
                <View className="bg-white rounded-2xl p-4 border border-slate-100">
                  <ActivityIndicator size="small" color="#2563EB" />
                </View>
              ) : dash.data ? (
                <PendingList pending={dash.data.pending} />
              ) : null}
            </View>

            {dash.data && dash.data.today.length > 0 ? (
              <View className="px-6 mb-6">
                <Text className="text-lg font-bold text-slate-900 mb-3">Today&apos;s classes</Text>
                {dash.data.today.map((t) => (
                  <TouchableOpacity
                    key={t.session_id}
                    onPress={() => router.push("/(teacher)/scan" as never)}
                    activeOpacity={0.85}
                    className="bg-white rounded-2xl p-4 border border-slate-100 mb-2 flex-row items-center"
                  >
                    <View className="w-14">
                      <Text className="text-sm font-bold text-slate-900">{fmtTime(t.start)}</Text>
                      <Text className="text-[11px] text-slate-400">{fmtTime(t.end)}</Text>
                    </View>
                    <View className="flex-1 ml-2">
                      <Text className="text-sm font-semibold text-slate-800" numberOfLines={1}>
                        {t.subject}
                      </Text>
                      <Text className="text-[11px] text-slate-500">{t.batch}</Text>
                    </View>
                    {t.status === "live" ? (
                      <View className="bg-red-100 px-2 py-1 rounded-md flex-row items-center">
                        <View className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1.5" />
                        <Text className="text-red-600 text-[11px] font-bold">Live</Text>
                      </View>
                    ) : (
                      <Radio size={16} color="#cbd5e1" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <View className="px-6 mb-6">
              <Text className="text-lg font-bold text-slate-900 mb-3 px-1">Quick actions</Text>
              <View className="flex-row" style={{ gap: 12 }}>
                <QuickActionTile
                  label="Scan QR"
                  icon={<QrCode size={22} color="#2563EB" />}
                  tone="bg-blue-50"
                  onPress={() => router.push("/(teacher)/scan" as never)}
                />
                <QuickActionTile
                  label="New exam"
                  icon={<BookOpenCheck size={22} color="#d97706" />}
                  tone="bg-amber-50"
                  onPress={() => router.push("/(teacher)/exams" as never)}
                />
                <QuickActionTile
                  label="Upload"
                  icon={<Upload size={22} color="#059669" />}
                  tone="bg-emerald-50"
                  onPress={() => router.push("/(teacher)/content" as never)}
                />
              </View>
            </View>

            <View className="px-6 mb-2 flex-row items-end justify-between">
              <Text className="text-lg font-bold text-slate-900">My batches</Text>
              <Text className="text-xs font-medium text-slate-500">
                {isLoading && !data ? "Loading…" : `${batches.length} assigned`}
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
              <Text className="mt-3 text-base font-bold text-slate-900 text-center">No batches assigned yet</Text>
              <Text className="mt-1 text-sm text-slate-500 text-center leading-5">
                Ask your institute admin to add you to a batch. Once you&apos;re assigned, your students and
                schedule will appear here.
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
  icon,
  tone,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  tone: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      className="flex-1 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm shadow-slate-200/50 items-start"
    >
      <View className={`w-10 h-10 rounded-xl ${tone} items-center justify-center mb-3`}>{icon}</View>
      <Text className="text-sm font-bold text-slate-700">{label}</Text>
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
          <Text className="text-[11px] font-bold uppercase tracking-wider text-blue-600">{batch.course_code}</Text>
          <Text className="mt-1 text-lg font-extrabold text-slate-900" numberOfLines={1}>
            {batch.batch_name}
          </Text>
          <Text className="text-xs font-medium text-slate-500 mt-0.5">{batch.course_name}</Text>
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
            {batch.next_session?.label ?? <Text className="font-medium text-slate-400">No schedule set</Text>}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
