import { memo } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { RankBadge } from "./RankBadge";
import type { LeaderRow } from "@/features/leaderboard/useLeaderboard";

// One leaderboard row: rank medal, name + last-2 phone (D-073), composite. The
// caller's own row is highlighted. Tapping opens the public profile card.
export const RankRow = memo(function RankRow({
  row,
  onPress,
}: {
  row: LeaderRow;
  onPress?: (row: LeaderRow) => void;
}) {
  const phone = row.phone_last2 ? `••${row.phone_last2}` : "";
  return (
    <TouchableOpacity
      onPress={onPress ? () => onPress(row) : undefined}
      activeOpacity={0.7}
      accessibilityLabel={`Rank ${row.rank}, ${row.is_me ? "you" : row.full_name}, composite ${row.composite.toFixed(2)}`}
      className={`flex-row items-center px-4 py-3 rounded-2xl mb-2 border ${
        row.is_me ? "bg-blue-50 border-blue-200" : "bg-white border-slate-100"
      }`}
    >
      <View className="w-9 items-center justify-center">
        <RankBadge rank={row.rank} />
      </View>
      <View className="flex-1 ml-3">
        <Text
          className={`text-sm font-bold ${row.is_me ? "text-blue-800" : "text-slate-900"}`}
          numberOfLines={1}
        >
          {row.is_me ? "You" : row.full_name}
        </Text>
        {phone ? <Text className="text-[11px] text-slate-400 mt-0.5">{phone}</Text> : null}
      </View>
      <Text className="text-sm font-extrabold text-blue-800">{row.composite.toFixed(2)}</Text>
    </TouchableOpacity>
  );
});
