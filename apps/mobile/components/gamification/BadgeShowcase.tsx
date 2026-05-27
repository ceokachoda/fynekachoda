import { memo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Lock } from "lucide-react-native";
import { BadgeIcon } from "./BadgeIcon";
import {
  type BadgeCollectionItem,
  useBadgesCollection,
} from "@/features/gamification/useBadgesCollection";
import { Skeleton } from "@/components/ui/skeleton";

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });
}

// Grid of all 11 badges: earned = full colour, locked = dimmed silhouette + lock.
// Tapping a badge shows its name + earned-date (earned) or how-to-earn copy (locked).
export const BadgeShowcase = memo(function BadgeShowcase() {
  const { items, earnedCount, isLoading, error } = useBadgesCollection();
  const [sel, setSel] = useState<BadgeCollectionItem | null>(null);

  if (isLoading && items.length === 0) {
    return (
      <View className="flex-row flex-wrap">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={{ width: "33.33%" }} className="items-center mb-4">
            <Skeleton width={72} height={72} borderRadius={36} />
          </View>
        ))}
      </View>
    );
  }
  if (error) {
    return (
      <View className="bg-red-50 border border-red-100 rounded-2xl p-4">
        <Text className="text-sm text-red-700">{error}</Text>
      </View>
    );
  }

  return (
    <View>
      <Text className="text-xs text-slate-500 mb-4">
        {earnedCount} of {items.length} earned
      </Text>
      <View className="flex-row flex-wrap">
        {items.map((b) => (
          <TouchableOpacity
            key={b.code}
            onPress={() => setSel(b)}
            activeOpacity={0.7}
            style={{ width: "33.33%" }}
            className="items-center mb-4"
            accessibilityLabel={`${b.name}, ${b.earned ? "earned" : "locked"}`}
          >
            <View>
              <BadgeIcon uri={b.iconUrl} size={72} locked={!b.earned} />
              {!b.earned ? (
                <View className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-slate-200 items-center justify-center border-2 border-white">
                  <Lock size={12} color="#64748b" />
                </View>
              ) : null}
            </View>
            <Text
              numberOfLines={2}
              className={`text-[11px] font-bold text-center mt-1.5 px-1 ${b.earned ? "text-slate-800" : "text-slate-400"}`}
            >
              {b.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {sel ? (
        <View className="bg-white rounded-2xl p-4 border border-slate-100 mt-2">
          <Text className="text-sm font-extrabold text-slate-900">{sel.name}</Text>
          {sel.earned ? (
            <Text className="text-xs font-semibold text-emerald-600 mt-1">✓ Earned {fmtDate(sel.earned_at)}</Text>
          ) : (
            <Text className="text-xs text-slate-500 mt-1 leading-4">
              <Text className="font-semibold text-slate-600">How to earn: </Text>
              {sel.description}
            </Text>
          )}
        </View>
      ) : (
        <Text className="text-xs text-slate-400 text-center mt-1">Tap a badge to see how to earn it.</Text>
      )}
    </View>
  );
});
