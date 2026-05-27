import { memo } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight, Sparkles } from "lucide-react-native";
import type { WeakTopicItem } from "@/features/dashboard/types";

export const WeakTopicsList = memo(function WeakTopicsList({
  items,
}: {
  items: WeakTopicItem[];
}) {
  const router = useRouter();

  if (items.length === 0) {
    return (
      <View className="bg-white rounded-2xl p-5 border border-slate-100 items-center">
        <Sparkles size={24} color="#10b981" />
        <Text className="text-sm font-bold text-slate-900 mt-2 text-center">
          You&apos;re on top of every topic.
        </Text>
        <TouchableOpacity onPress={() => router.push("/library")} className="mt-1">
          <Text className="text-xs text-blue-600 font-semibold">
            Try a harder quiz?
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      {items.map((w) => (
        <TouchableOpacity
          key={w.topic_id}
          onPress={() => router.push((w.quiz_id ? `/quiz/${w.quiz_id}` : "/library") as never)}
          activeOpacity={0.85}
          className="bg-white rounded-2xl p-4 border border-slate-100 mb-2 flex-row items-center"
        >
          <View className="w-12 h-12 rounded-2xl bg-amber-50 items-center justify-center mr-3">
            <Text className="text-amber-700 font-extrabold text-sm">
              {Math.round(w.mastery)}%
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold text-slate-900" numberOfLines={1}>
              {w.topic_name}
            </Text>
            <Text className="text-[11px] text-blue-600 font-semibold mt-1">
              {w.quiz_id ? "Practice this topic" : "Review in library"}
            </Text>
          </View>
          <ChevronRight size={18} color="#94a3b8" />
        </TouchableOpacity>
      ))}
    </View>
  );
});
