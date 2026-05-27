import { memo } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { PlayCircle } from "lucide-react-native";
import type { ContinueItem } from "@/features/dashboard/types";

// Per spec §4.5 the strip is skipped entirely when there is no in-progress video.
export const ContinueStrip = memo(function ContinueStrip({
  items,
}: {
  items: ContinueItem[];
}) {
  const router = useRouter();
  if (items.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 24 }}
      className="overflow-visible"
    >
      {items.map((c) => {
        const pct = Math.min(100, Math.max(0, Math.round(c.watched_pct)));
        return (
          <TouchableOpacity
            key={c.content_id}
            onPress={() => router.push(`/video/${c.content_id}` as never)}
            activeOpacity={0.85}
            className="bg-white rounded-2xl p-4 mr-3 w-56 border border-slate-100"
          >
            <View className="flex-row items-center mb-3">
              <View className="w-10 h-10 rounded-2xl bg-blue-50 items-center justify-center mr-2">
                <PlayCircle size={20} color="#2563EB" />
              </View>
              <Text className="text-sm font-bold text-slate-900 flex-1" numberOfLines={2}>
                {c.title}
              </Text>
            </View>
            <View className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <View className="h-full bg-blue-600 rounded-full" style={{ width: `${pct}%` }} />
            </View>
            <Text className="text-[11px] text-slate-500 mt-1.5">{pct}% watched</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
});
