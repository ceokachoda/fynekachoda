import { View } from "react-native";
import { Award } from "lucide-react-native";

// Per-code accent colour (mirrors the placeholder badge art + RecentBadgesStrip).
export const BADGE_COLOR: Record<string, string> = {
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

// Lightweight coloured-glyph badge tile — no network, no SVG parse. Used
// wherever MANY badges render at once (the Profile grid, the streak modal),
// where 11 <SvgUri> each doing an uncached network fetch + XML parse stalled
// the screen on 2GB devices. The full SVG art (when real assets land) renders
// one-at-a-time in the earned-badge celebration modal via <BadgeIcon>.
export function BadgeGlyph({
  code,
  size = 64,
  locked = false,
}: {
  code: string;
  size?: number;
  locked?: boolean;
}) {
  const color = BADGE_COLOR[code] ?? "#7c3aed";
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: locked ? "#e2e8f0" : `${color}1a`,
        opacity: locked ? 0.55 : 1,
      }}
      className="items-center justify-center"
    >
      <Award size={size * 0.46} color={locked ? "#94a3b8" : color} />
    </View>
  );
}
