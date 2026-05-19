import { Text, View } from "react-native";
import { ShieldAlert } from "lucide-react-native";

interface Props {
  count: number;
}

// Renders a warning banner inside the locked-down exam attempt screen
// whenever the AppState listener has counted at least one
// active→background transition. After 3 it becomes red (per spec §6.1).
export function TabSwitchBanner({ count }: Props) {
  if (count <= 0) return null;
  const severe = count >= 3;
  const bg = severe ? "#fef2f2" : "#fef9c3";
  const border = severe ? "#fca5a5" : "#fde68a";
  const fg = severe ? "#991b1b" : "#92400e";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: border,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 10,
      }}
    >
      <ShieldAlert size={16} color={fg} />
      <Text style={{ color: fg, fontWeight: "700", marginLeft: 8 }}>
        You left the app. Switches: {count}
        {severe
          ? " · Further switches may be reviewed by your teacher."
          : ""}
      </Text>
    </View>
  );
}
