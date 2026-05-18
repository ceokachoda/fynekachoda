import { View, Text } from "react-native";

interface Props {
  hint?: string;
  tone?: "neutral" | "success" | "error";
}

export function ScannerOverlay({
  hint,
  tone = "neutral",
}: Props): React.ReactElement {
  const borderColor =
    tone === "success" ? "#10b981" : tone === "error" ? "#ef4444" : "#fef3c7";
  return (
    <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
      <View
        style={{
          width: 240,
          height: 240,
          borderRadius: 24,
        }}
        className="overflow-hidden items-center justify-center"
      >
        <Corner position="tl" color={borderColor} />
        <Corner position="tr" color={borderColor} />
        <Corner position="bl" color={borderColor} />
        <Corner position="br" color={borderColor} />
      </View>
      {hint ? (
        <View className="absolute bottom-20 px-4 py-2 bg-black/60 rounded-full">
          <Text className="text-white text-xs font-semibold">{hint}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Corner({
  position,
  color,
}: {
  position: "tl" | "tr" | "bl" | "br";
  color: string;
}) {
  const base = {
    position: "absolute" as const,
    width: 36,
    height: 36,
    borderColor: color,
  };
  const style =
    position === "tl"
      ? { ...base, top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 18 }
      : position === "tr"
        ? { ...base, top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 18 }
        : position === "bl"
          ? { ...base, bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 18 }
          : { ...base, bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 18 };
  return <View style={style} />;
}
