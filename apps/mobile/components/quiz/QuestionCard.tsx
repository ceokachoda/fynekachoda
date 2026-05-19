import { Image, Text, View } from "react-native";
import { MathText } from "./MathText";

interface Props {
  index: number;
  total: number;
  prompt_md: string;
  prompt_image_url?: string | null;
  difficulty?: "easy" | "medium" | "hard" | null;
}

const DIFFICULTY_COLOR: Record<string, { bg: string; fg: string }> = {
  easy: { bg: "#dcfce7", fg: "#065f46" },
  medium: { bg: "#fef9c3", fg: "#92400e" },
  hard: { bg: "#fee2e2", fg: "#991b1b" },
};

export function QuestionCard({
  index,
  total,
  prompt_md,
  prompt_image_url,
  difficulty,
}: Props) {
  const d = difficulty ? DIFFICULTY_COLOR[difficulty] : null;
  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <Text style={{ color: "#475569", fontWeight: "600" }}>
          Q{index + 1} / {total}
        </Text>
        {d ? (
          <View
            style={{
              backgroundColor: d.bg,
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 999,
            }}
          >
            <Text style={{ color: d.fg, fontSize: 11, fontWeight: "700" }}>
              {(difficulty ?? "").toUpperCase()}
            </Text>
          </View>
        ) : null}
      </View>
      <View>
        <MathText markdown={prompt_md} fontSize={16} color="#0f172a" />
        {prompt_image_url ? (
          <Image
            source={{ uri: prompt_image_url }}
            style={{
              width: "100%",
              height: 220,
              borderRadius: 12,
              marginTop: 10,
              resizeMode: "contain",
              backgroundColor: "#f8fafc",
            }}
          />
        ) : null}
      </View>
    </View>
  );
}
