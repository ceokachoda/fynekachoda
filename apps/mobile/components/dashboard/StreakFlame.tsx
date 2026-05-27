import { memo } from "react";
import { Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Flame } from "lucide-react-native";

// Flame tiers per spec/leaderboard-and-gamification.md §4.4.
function tierFor(days: number): { color: string; size: number } {
  if (days <= 0) return { color: "#94a3b8", size: 18 }; // grey ember
  if (days < 7) return { color: "#f97316", size: 20 }; // orange small
  if (days < 30) return { color: "#ea580c", size: 22 }; // orange bigger
  if (days < 90) return { color: "#dc2626", size: 24 }; // red
  return { color: "#eab308", size: 26 }; // golden
}

interface Props {
  currentDays: number;
  bestDays: number;
}

export const StreakFlame = memo(function StreakFlame({ currentDays }: Props) {
  const router = useRouter();
  const t = tierFor(currentDays);
  return (
    <TouchableOpacity
      onPress={() => router.push("/modal?type=streak" as never)}
      className="flex-row items-center bg-white border border-slate-100 rounded-full px-3 py-1.5"
      activeOpacity={0.8}
      accessibilityLabel={`${currentDays}-day streak. Tap for details.`}
    >
      <Flame size={t.size} color={t.color} />
      <Text className="text-sm font-bold text-slate-900 ml-1.5">
        {currentDays}
      </Text>
      <Text className="text-xs text-slate-500 ml-1">
        day{currentDays === 1 ? "" : "s"}
      </Text>
    </TouchableOpacity>
  );
});
