import { memo } from "react";
import { Text, View } from "react-native";
import { Award } from "lucide-react-native";
import type { RecentBadge } from "@/features/dashboard/types";

// Per-code accent colour (mirrors the placeholder badge art). Falls back to violet.
const BADGE_COLOR: Record<string, string> = {
  first_quiz: "#16a34a",
  streak_7: "#f97316",
  streak_30: "#dc2626",
  streak_90: "#eab308",
  perfect_week_attendance: "#0d9488",
  topper_of_week: "#f59e0b",
  runner_up_week: "#64748b",
  quiz_100: "#7c3aed",
  mastery_80_subject: "#2563eb",
  early_bird: "#06b6d4",
  comeback: "#6366f1",
};

// Last 3 earned badges (from student_dashboard.recent_badges). Lightweight coloured
// chips — no network on the home screen (the full art lives in Profile → Badges).
export const RecentBadgesStrip = memo(function RecentBadgesStrip({
  badges,
}: {
  badges: RecentBadge[];
}) {
  if (!badges || badges.length === 0) {
    return (
      <View className="bg-white rounded-2xl p-5 border border-slate-100 flex-row items-center">
        <View className="w-11 h-11 rounded-2xl bg-violet-50 items-center justify-center mr-3">
          <Award size={20} color="#7c3aed" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-bold text-slate-900">Earn your first badge soon!</Text>
          <Text className="text-[11px] text-slate-500 mt-0.5 leading-4">
            Take a quiz, keep your streak, or top the leaderboard to start collecting.
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View className="flex-row" style={{ gap: 10 }}>
      {badges.slice(0, 3).map((b) => {
        const color = BADGE_COLOR[b.code] ?? "#7c3aed";
        return (
          <View
            key={b.code}
            className="flex-1 bg-white rounded-2xl p-3 border border-slate-100 items-center"
          >
            <View
              className="w-11 h-11 rounded-2xl items-center justify-center mb-1.5"
              style={{ backgroundColor: `${color}1a` }}
            >
              <Award size={20} color={color} />
            </View>
            <Text numberOfLines={2} className="text-[11px] font-bold text-slate-700 text-center">
              {b.name}
            </Text>
          </View>
        );
      })}
    </View>
  );
});
