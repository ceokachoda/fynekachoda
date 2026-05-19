import { Pressable, ScrollView, Text, View } from "react-native";

export type QuestionStatus =
  | "current"
  | "answered"
  | "flagged_unanswered"
  | "flagged_answered"
  | "unanswered";

interface Props {
  total: number;
  currentIndex: number;
  statuses: QuestionStatus[];
  onJump: (index: number) => void;
}

function colorFor(status: QuestionStatus): { bg: string; fg: string; border: string } {
  switch (status) {
    case "current":
      return { bg: "#2563EB", fg: "#ffffff", border: "#2563EB" };
    case "answered":
      return { bg: "#bbf7d0", fg: "#065f46", border: "#34d399" };
    case "flagged_answered":
      return { bg: "#fecaca", fg: "#7f1d1d", border: "#f87171" };
    case "flagged_unanswered":
      return { bg: "#fef9c3", fg: "#92400e", border: "#facc15" };
    default:
      return { bg: "#ffffff", fg: "#475569", border: "#cbd5e1" };
  }
}

export function NavigationGrid({ total, currentIndex, statuses, onJump }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}
    >
      {Array.from({ length: total }, (_, i) => {
        const status = i === currentIndex ? "current" : statuses[i] ?? "unanswered";
        const c = colorFor(status);
        return (
          <Pressable
            key={i}
            onPress={() => onJump(i)}
            accessibilityLabel={`Go to question ${i + 1}`}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              borderWidth: 1.5,
              borderColor: c.border,
              backgroundColor: c.bg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: c.fg, fontWeight: "700", fontSize: 13 }}>{i + 1}</Text>
          </Pressable>
        );
      })}
      <View style={{ width: 4 }} />
    </ScrollView>
  );
}
