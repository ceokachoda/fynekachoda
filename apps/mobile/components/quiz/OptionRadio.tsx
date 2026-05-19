import { Image, Pressable, View } from "react-native";
import { Check } from "lucide-react-native";
import { MathText } from "./MathText";

export type OptionStatus = "default" | "selected" | "correct" | "wrong" | "missed";

interface Props {
  letter: string;
  text_md: string;
  image_url?: string | null;
  status: OptionStatus;
  disabled?: boolean;
  onPress?: () => void;
}

const STATUS_STYLES: Record<OptionStatus, { border: string; bg: string; letterBg: string; letterFg: string }> = {
  default:  { border: "#cbd5e1", bg: "#ffffff", letterBg: "#f1f5f9", letterFg: "#475569" },
  selected: { border: "#2563EB", bg: "#eff6ff", letterBg: "#2563EB", letterFg: "#ffffff" },
  correct:  { border: "#059669", bg: "#ecfdf5", letterBg: "#059669", letterFg: "#ffffff" },
  wrong:    { border: "#dc2626", bg: "#fef2f2", letterBg: "#dc2626", letterFg: "#ffffff" },
  missed:   { border: "#059669", bg: "#ffffff", letterBg: "#dcfce7", letterFg: "#065f46" },
};

export function OptionRadio({ letter, text_md, image_url, status, disabled, onPress }: Props) {
  const s = STATUS_STYLES[status];
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: status !== "default", disabled }}
      onPress={disabled ? undefined : onPress}
      style={{
        borderWidth: 1.5,
        borderColor: s.border,
        backgroundColor: s.bg,
        borderRadius: 14,
        padding: 12,
        marginBottom: 10,
        flexDirection: "row",
        alignItems: "flex-start",
        opacity: disabled ? 0.95 : 1,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: s.letterBg,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
          marginTop: 2,
        }}
      >
        {status === "correct" ? (
          <Check size={16} color={s.letterFg} />
        ) : (
          <View
            style={{ alignItems: "center", justifyContent: "center" }}
            accessibilityLabel={`Option ${letter}`}
          >
            {/* Letter rendered as <Text>-like via View+nested */}
            <View style={{ width: 16, alignItems: "center" }}>
              <View
                style={{
                  // Using flex+Text for the letter; React Native Text inside Pressable is fine.
                }}
              >
                <OptLetter letter={letter} fg={s.letterFg} />
              </View>
            </View>
          </View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        {image_url ? (
          <Image
            source={{ uri: image_url }}
            style={{ width: "100%", height: 140, borderRadius: 8, marginBottom: 8, resizeMode: "contain", backgroundColor: "#f8fafc" }}
          />
        ) : null}
        <MathText markdown={text_md} fontSize={15} color="#0f172a" />
      </View>
    </Pressable>
  );
}

import { Text } from "react-native";
function OptLetter({ letter, fg }: { letter: string; fg: string }) {
  return (
    <Text style={{ color: fg, fontWeight: "700", fontSize: 14 }}>{letter}</Text>
  );
}
