import { Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { signOut } from "@/features/auth/auth";

export default function SuspendedScreen() {
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-1 items-center justify-center px-8">
        <View className="w-full rounded-2xl border border-red-200 bg-white px-6 py-8 shadow-sm">
          <Text className="text-center text-2xl font-extrabold text-red-700">
            Account suspended
          </Text>
          <Text className="mt-3 text-center text-sm text-slate-600">
            Your account has been suspended by an admin. Please contact your
            institute to reactivate it.
          </Text>
          <TouchableOpacity
            onPress={handleSignOut}
            activeOpacity={0.85}
            className="mt-6 h-11 items-center justify-center rounded-xl bg-slate-900"
          >
            <Text className="text-base font-semibold text-white">Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
