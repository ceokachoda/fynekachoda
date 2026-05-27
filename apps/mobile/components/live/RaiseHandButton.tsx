// Phase 9 — student raise-hand toggle.

import { ActivityIndicator, Pressable, Text } from "react-native";
import { Hand } from "lucide-react-native";

export function RaiseHandButton({
  raised,
  busy,
  disabled,
  onRaise,
  onLower,
}: {
  raised: boolean;
  busy?: boolean;
  disabled?: boolean;
  onRaise: () => void;
  onLower: () => void;
}) {
  return (
    <Pressable
      onPress={raised ? onLower : onRaise}
      disabled={disabled || busy}
      className={`flex-row items-center px-4 py-2.5 rounded-xl ${
        raised ? "bg-amber-500" : "bg-blue-800"
      } ${disabled ? "opacity-50" : ""}`}
      accessibilityLabel={raised ? "Lower hand" : "Raise hand"}
    >
      {busy ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Hand size={16} color="#fff" style={{ marginRight: 6 }} />
      )}
      <Text className="text-white font-bold text-sm">
        {raised ? "Lower hand" : "Raise hand"}
      </Text>
    </Pressable>
  );
}
