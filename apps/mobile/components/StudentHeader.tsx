import { Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Bell } from "lucide-react-native";
import { FyneStudyLogo } from "./FyneStudyLogo";
import { useSession } from "@/features/auth/useSession";

// Shared brand header for the student tabs: identity avatar (left), wordmark
// (center) and the notifications bell (right). Kept in one place so every tab
// looks identical and the bell wiring lives in a single component.
function initials(fullName: string | null | undefined): string {
  return (
    (fullName ?? "?")
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

export function StudentHeader() {
  const router = useRouter();
  const { appUser } = useSession();

  return (
    <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
      <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center">
        <Text className="text-xs font-bold text-blue-800">{initials(appUser?.full_name)}</Text>
      </View>
      <FyneStudyLogo variant="header" />
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Notifications"
        onPress={() => router.push("/notifications")}
        className="w-10 h-10 items-end justify-center"
      >
        <Bell size={24} color="#1e3a8a" />
      </TouchableOpacity>
    </View>
  );
}
