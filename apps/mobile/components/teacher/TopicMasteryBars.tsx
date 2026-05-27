import { memo } from "react";
import { Text, View } from "react-native";
import type { TopicMastery } from "@/features/dashboard/useTeacherBatchOverview";

function colorFor(pct: number): string {
  if (pct < 50) return "#ef4444";
  if (pct < 75) return "#f59e0b";
  return "#10b981";
}

export const TopicMasteryBars = memo(function TopicMasteryBars({
  topics,
}: {
  topics: TopicMastery[];
}) {
  if (topics.length === 0) {
    return (
      <View className="bg-white rounded-2xl p-5 border border-slate-100">
        <Text className="text-sm text-slate-500">
          No mastery data yet — it appears once students attempt quizzes or exams.
        </Text>
      </View>
    );
  }
  return (
    <View>
      <Text className="text-xs text-slate-500 mb-3">Class average per topic, weakest first.</Text>
      {topics.map((t) => {
        const pct = Math.max(0, Math.min(100, Math.round(t.avg_mastery)));
        const color = colorFor(pct);
        return (
          <View key={t.topic_id} className="bg-white rounded-2xl p-4 border border-slate-100 mb-2">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm font-bold text-slate-900 flex-1 mr-2" numberOfLines={1}>
                {t.topic_name}
              </Text>
              <Text className="text-sm font-extrabold" style={{ color }}>
                {pct}%
              </Text>
            </View>
            <View className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
            </View>
            <Text className="text-[11px] text-slate-400 mt-2">
              {t.student_count} student{t.student_count === 1 ? "" : "s"} with data
            </Text>
          </View>
        );
      })}
    </View>
  );
});
