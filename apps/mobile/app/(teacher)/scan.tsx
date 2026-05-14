import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { QrCode } from "lucide-react-native";

export default function TeacherScanScreen() {
  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-1 items-center justify-center px-6">
        <QrCode size={42} color="#94a3b8" />
        <Text className="mt-4 text-xl font-bold text-slate-900">
          Attendance QR scan
        </Text>
        <Text className="mt-2 text-center text-sm text-slate-500">
          Lands in Phase 4 — the rotating-HMAC QR scanner that marks students
          present in real time.
        </Text>
      </View>
    </SafeAreaView>
  );
}
