import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Users } from "lucide-react-native";

export default function TeacherBatchScreen() {
  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-1 items-center justify-center px-6">
        <Users size={42} color="#94a3b8" />
        <Text className="mt-4 text-xl font-bold text-slate-900">
          My batches
        </Text>
        <Text className="mt-2 text-center text-sm text-slate-500">
          Roster, mastery, and per-student insight. Arrives in Phase 3 (basic
          roster) and grows through Phase 7.
        </Text>
      </View>
    </SafeAreaView>
  );
}
