import { memo } from "react";
import { Text } from "react-native";

// Medal for the podium; plain "#N" otherwise.
export const RankBadge = memo(function RankBadge({ rank }: { rank: number }) {
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  if (medal) return <Text style={{ fontSize: 20 }}>{medal}</Text>;
  return <Text className="text-sm font-bold text-slate-500">#{rank}</Text>;
});
