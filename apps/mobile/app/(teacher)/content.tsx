import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BookOpen } from "lucide-react-native";

export default function TeacherContentScreen() {
  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-1 items-center justify-center px-6">
        <BookOpen size={42} color="#94a3b8" />
        <Text className="mt-4 text-xl font-bold text-slate-900">Library</Text>
        <Text className="mt-2 text-center text-sm text-slate-500">
          Upload PDFs and videos for your batch. Arrives in Phase 9.
        </Text>
      </View>
    </SafeAreaView>
  );
}
