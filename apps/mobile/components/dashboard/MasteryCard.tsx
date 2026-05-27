import { memo } from "react";
import { Text, View } from "react-native";
import type { MasteryRow } from "@/features/dashboard/useMastery";

export const MasteryCard = memo(function MasteryCard({ row }: { row: MasteryRow }) {
  const pct = Math.max(0, Math.min(100, Math.round(row.mastery_pct)));
  const barColor = pct < 50 ? "#ef4444" : pct < 75 ? "#f59e0b" : "#10b981";
  const contributing = Math.min(5, row.attempt_count);
  const last = row.last_attempt_at
    ? new Date(row.last_attempt_at).toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
      })
    : "—";
  return (
    <View className="bg-white rounded-2xl p-4 border border-slate-100 mb-2">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-sm font-bold text-slate-900 flex-1 mr-2" numberOfLines={1}>
          {row.topic_name}
        </Text>
        <Text className="text-sm font-extrabold" style={{ color: barColor }}>
          {pct}%
        </Text>
      </View>
      <View className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      </View>
      <Text className="text-[11px] text-slate-400 mt-2">
        Avg of last {contributing} attempt{contributing === 1 ? "" : "s"} · practiced {last}
      </Text>
    </View>
  );
});
