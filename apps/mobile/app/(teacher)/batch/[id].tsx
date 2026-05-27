import { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, GraduationCap } from "lucide-react-native";
import { useTeacherBatchOverview } from "@/features/dashboard/useTeacherBatchOverview";
import { BatchHeatmap } from "@/components/teacher/BatchHeatmap";
import { TopicMasteryBars } from "@/components/teacher/TopicMasteryBars";
import { AtRiskList } from "@/components/teacher/AtRiskList";

type Tab = "attendance" | "mastery" | "risk";

export default function TeacherBatchDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const batchId = params.id ?? "";
  const { data, isLoading, error, reload } = useTeacherBatchOverview(batchId);
  const [tab, setTab] = useState<Tab>("risk");

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const batch = data?.batch;
  const riskCount = data?.at_risk.length ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <View className="flex-row items-center px-4 pt-2 pb-2">
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          className="w-10 h-10 items-center justify-center rounded-full"
          activeOpacity={0.7}
        >
          <ChevronLeft size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text className="ml-2 text-base font-bold text-slate-900">Batch analytics</Text>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => void reload()} tintColor="#2563EB" />}
      >
        <View className="bg-white mx-6 mt-2 mb-4 p-5 rounded-3xl border border-slate-100 shadow-sm shadow-slate-200/50">
          {isLoading && !data ? (
            <View className="py-6 items-center">
              <ActivityIndicator size="small" color="#2563EB" />
            </View>
          ) : error ? (
            <Text className="text-sm font-medium text-red-700">{error}</Text>
          ) : batch ? (
            <>
              <Text className="text-[11px] font-bold uppercase tracking-wider text-blue-600">{batch.course_code}</Text>
              <Text className="mt-1 text-xl font-extrabold text-slate-900">{batch.name}</Text>
              <Text className="text-sm font-medium text-slate-500 mt-0.5">{batch.course_name}</Text>
              <View className="mt-4 flex-row items-center">
                <View className="w-10 h-10 bg-blue-50 rounded-2xl items-center justify-center mr-3">
                  <GraduationCap size={20} color="#2563EB" />
                </View>
                <View>
                  <Text className="text-xs font-semibold uppercase text-slate-500 tracking-wide">Roster</Text>
                  <Text className="text-base font-bold text-slate-900">
                    {batch.student_count} student{batch.student_count === 1 ? "" : "s"}
                  </Text>
                </View>
              </View>
            </>
          ) : null}
        </View>

        {data ? (
          <>
            <View className="px-6 mb-4">
              <View className="bg-slate-200/70 p-1.5 rounded-2xl flex-row">
                {([
                  ["risk", `Risk${riskCount ? ` (${riskCount})` : ""}`],
                  ["mastery", "Mastery"],
                  ["attendance", "Attendance"],
                ] as const).map(([t, label]) => {
                  const active = tab === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      onPress={() => setTab(t)}
                      className="flex-1 py-2.5 rounded-xl items-center justify-center"
                      style={active ? { backgroundColor: "#FFFFFF" } : undefined}
                    >
                      <Text className="font-bold text-xs" style={{ color: active ? "#1D4ED8" : "#64748B" }}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View className="px-6">
              {tab === "attendance" ? (
                <BatchHeatmap days={data.attendance} />
              ) : tab === "mastery" ? (
                <TopicMasteryBars topics={data.topic_mastery} />
              ) : (
                <AtRiskList students={data.at_risk} />
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
