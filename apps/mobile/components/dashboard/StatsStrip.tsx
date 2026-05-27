import { memo } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import type { DashboardStats } from "@/features/dashboard/types";

function Pill({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      disabled={!onPress}
      onPress={onPress}
      activeOpacity={0.85}
      className="flex-1 bg-white border border-slate-100 rounded-2xl px-3 py-4 items-center shadow-sm shadow-slate-200/40"
    >
      <Text className="text-2xl font-extrabold text-blue-800">{value}</Text>
      <Text className="text-[11px] text-slate-500 mt-1 font-medium">{label}</Text>
    </TouchableOpacity>
  );
}

export const StatsStrip = memo(function StatsStrip({
  stats,
}: {
  stats: DashboardStats;
}) {
  const router = useRouter();
  return (
    <View className="flex-row" style={{ gap: 12 }}>
      <Pill
        label="Attendance"
        value={`${stats.attendance_pct}%`}
        onPress={() => router.push("/attendance")}
      />
      <Pill
        label="Mastery"
        value={`${stats.mastery_pct}%`}
        onPress={() => router.push("/profile?tab=mastery" as never)}
      />
      <Pill
        label="Rank"
        value={stats.rank != null ? `#${stats.rank}` : "—"}
        onPress={() => router.push("/leaderboard" as never)}
      />
    </View>
  );
});
