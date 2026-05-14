import { Linking, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { signOut } from "@/features/auth/auth";

const ADMIN_URL = "https://admin-kohl-sigma.vercel.app";

export default function AdminRedirectScreen() {
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-1 items-center justify-center px-8">
        <View className="w-full rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm">
          <Text className="text-center text-2xl font-extrabold text-slate-900">
            Admin account
          </Text>
          <Text className="mt-3 text-center text-sm text-slate-600">
            Admin operations happen on the web panel. Use a browser to sign in
            at the admin URL below.
          </Text>
          <TouchableOpacity
            onPress={() => Linking.openURL(ADMIN_URL)}
            activeOpacity={0.85}
            className="mt-6 h-11 items-center justify-center rounded-xl bg-[#2563EB]"
          >
            <Text className="text-base font-semibold text-white">
              Open admin panel
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSignOut}
            activeOpacity={0.7}
            className="mt-3 h-10 items-center justify-center"
          >
            <Text className="text-sm text-slate-500">Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
