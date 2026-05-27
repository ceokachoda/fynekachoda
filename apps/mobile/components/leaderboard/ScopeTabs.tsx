import { Text, TouchableOpacity, View } from "react-native";
import type { LeaderboardScope } from "@/features/leaderboard/useLeaderboard";

export function ScopeTabs({
  scope,
  onChange,
}: {
  scope: LeaderboardScope;
  onChange: (s: LeaderboardScope) => void;
}) {
  return (
    <View className="bg-slate-200/70 p-1.5 rounded-2xl flex-row">
      {(["weekly", "alltime"] as const).map((s) => {
        const active = scope === s;
        return (
          <TouchableOpacity
            key={s}
            onPress={() => onChange(s)}
            className="flex-1 py-2.5 rounded-xl items-center justify-center"
            style={active ? { backgroundColor: "#FFFFFF" } : undefined}
          >
            <Text className="font-bold text-sm" style={{ color: active ? "#1D4ED8" : "#64748B" }}>
              {s === "weekly" ? "Weekly" : "All-Time"}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
