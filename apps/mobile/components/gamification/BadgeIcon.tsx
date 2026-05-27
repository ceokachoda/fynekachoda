import { memo } from "react";
import { View } from "react-native";
import { SvgUri } from "react-native-svg";
import { Award } from "lucide-react-native";

// Renders a badge's signed-SVG icon. Earned = full colour; locked = dimmed silhouette.
// Falls back to a neutral Award glyph if the signed URL is missing (offline / sign fail).
export const BadgeIcon = memo(function BadgeIcon({
  uri,
  size = 64,
  locked = false,
}: {
  uri: string | null;
  size?: number;
  locked?: boolean;
}) {
  const inner = uri ? (
    <SvgUri uri={uri} width={size} height={size} />
  ) : (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#e2e8f0" }}
      className="items-center justify-center"
    >
      <Award size={size * 0.5} color="#94a3b8" />
    </View>
  );
  if (locked) {
    return (
      <View style={{ width: size, height: size, opacity: 0.28 }} className="items-center justify-center">
        {inner}
      </View>
    );
  }
  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      {inner}
    </View>
  );
});
