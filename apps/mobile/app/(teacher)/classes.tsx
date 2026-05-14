import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Video } from "lucide-react-native";

export default function TeacherClassesScreen() {
  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-1 items-center justify-center px-6">
        <Video size={42} color="#94a3b8" />
        <Text className="mt-4 text-xl font-bold text-slate-900">Classes</Text>
        <Text className="mt-2 text-center text-sm text-slate-500">
          Schedule, start, and end live sessions. Arrives in Phase 6.
        </Text>
      </View>
    </SafeAreaView>
  );
}
