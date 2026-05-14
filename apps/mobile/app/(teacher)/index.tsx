import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Hourglass } from "lucide-react-native";
import { useSession } from "@/features/auth/useSession";

export default function TeacherHomeScreen() {
  const { appUser } = useSession();
  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-1 items-center justify-center px-6">
        <Hourglass size={42} color="#94a3b8" />
        <Text className="mt-4 text-xl font-bold text-slate-900">
          Hi, {appUser?.full_name ?? "teacher"}
        </Text>
        <Text className="mt-2 text-center text-sm text-slate-500">
          The teacher dashboard arrives in Phase 5 (attendance roster,
          scheduling, live-class controls).
        </Text>
      </View>
    </SafeAreaView>
  );
}
