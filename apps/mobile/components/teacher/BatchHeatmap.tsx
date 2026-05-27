import { memo } from "react";
import { ScrollView, Text, View } from "react-native";
import type { AttendanceDay } from "@/features/dashboard/useTeacherBatchOverview";

function colorFor(pct: number): string {
  if (pct < 60) return "#ef4444";
  if (pct < 80) return "#f59e0b";
  return "#10b981";
}

export const BatchHeatmap = memo(function BatchHeatmap({ days }: { days: AttendanceDay[] }) {
  if (days.length === 0) {
    return (
      <View className="bg-white rounded-2xl p-5 border border-slate-100">
        <Text className="text-sm text-slate-500">No attendance recorded in the last 30 days.</Text>
      </View>
    );
  }
  return (
    <View>
      <Text className="text-xs text-slate-500 mb-3">
        Present/late share per class day (last 30 days).
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row" style={{ gap: 8 }}>
          {days.map((d) => (
            <View key={d.date} className="items-center">
              <View
                className="w-10 h-16 rounded-lg items-center justify-center"
                style={{ backgroundColor: colorFor(d.pct) }}
              >
                <Text className="text-white text-xs font-extrabold">{d.pct}%</Text>
              </View>
              <Text className="text-[10px] text-slate-400 mt-1">
                {Number(d.date.slice(8, 10))}/{Number(d.date.slice(5, 7))}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <View className="flex-row items-center mt-4" style={{ gap: 14 }}>
        {[
          { c: "#10b981", l: "≥80%" },
          { c: "#f59e0b", l: "60–79%" },
          { c: "#ef4444", l: "<60%" },
        ].map((x) => (
          <View key={x.l} className="flex-row items-center">
            <View className="w-3 h-3 rounded mr-1.5" style={{ backgroundColor: x.c }} />
            <Text className="text-[11px] text-slate-500">{x.l}</Text>
          </View>
        ))}
      </View>
    </View>
  );
});
