import { Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

// One-time role chooser for the (rare) student + teacher multi-role.
// Phase 2: no persistence — shown every cold start. A future polish
// pass stores the last choice and surfaces a role-switcher on Profile.

export default function RoleChooserScreen() {
  const router = useRouter();
  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-1 items-center justify-center px-6">
        <View className="w-full max-w-md">
          <Text className="text-center text-2xl font-extrabold text-slate-900">
            Choose a role
          </Text>
          <Text className="mt-2 text-center text-sm text-slate-600">
            Your account has both student and teacher roles. Which one are you
            using today?
          </Text>

          <View className="mt-8 space-y-3">
            <TouchableOpacity
              onPress={() => router.replace("/(student)")}
              activeOpacity={0.85}
              className="h-14 items-center justify-center rounded-xl bg-[#2563EB]"
            >
              <Text className="text-base font-bold text-white">
                Continue as student
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.replace("/(teacher)")}
              activeOpacity={0.85}
              className="mt-3 h-14 items-center justify-center rounded-xl border border-slate-300 bg-white"
            >
              <Text className="text-base font-bold text-slate-900">
                Continue as teacher
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
