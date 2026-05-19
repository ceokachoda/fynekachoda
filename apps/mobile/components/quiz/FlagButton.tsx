import { Pressable, Text, View } from "react-native";
import { Flag } from "lucide-react-native";

interface Props {
  flagged: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function FlagButton({ flagged, onToggle, disabled }: Props) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: flagged, disabled }}
      onPress={disabled ? undefined : onToggle}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: flagged ? "#fef9c3" : "#f1f5f9",
        borderWidth: 1,
        borderColor: flagged ? "#facc15" : "#e2e8f0",
      }}
    >
      <Flag size={14} color={flagged ? "#92400e" : "#475569"} fill={flagged ? "#facc15" : "transparent"} />
      <Text
        style={{
          color: flagged ? "#92400e" : "#475569",
          marginLeft: 6,
          fontWeight: "600",
          fontSize: 13,
        }}
      >
        {flagged ? "Flagged" : "Flag"}
      </Text>
    </Pressable>
  );
}
