import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { signOut } from "@/features/auth/auth";
import { useSession } from "@/features/auth/useSession";
import { LoadingDots } from "@/components/LoadingDots";

// Neutral trapdoor for "signed in, but we couldn't load your profile" — a weak
// connection or, rarely, a misconfigured account. Replaces the old
// admin-redirect "Admin account" card, which a student on flaky wifi could hit.
export default function AccountIssueScreen() {
  const router = useRouter();
  const { refresh } = useSession();
  const [retrying, setRetrying] = useState(false);

  async function handleRetry() {
    if (retrying) return;
    setRetrying(true);
    await refresh();
    setRetrying(false);
    router.replace("/");
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-1 items-center justify-center px-8">
        <View className="w-full rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm">
          <Text className="text-center text-2xl font-extrabold text-slate-900">
            We couldn&apos;t load your account
          </Text>
          <Text className="mt-3 text-center text-sm text-slate-600">
            This is usually a weak connection. Check your internet and try again.
          </Text>
          <TouchableOpacity
            onPress={handleRetry}
            disabled={retrying}
            activeOpacity={0.85}
            className="mt-6 h-12 items-center justify-center rounded-xl bg-[#2563EB]"
          >
            {retrying ? (
              <LoadingDots color="#FFFFFF" size={8} />
            ) : (
              <Text className="text-base font-semibold text-white">
                Try again
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSignOut}
            activeOpacity={0.7}
            className="mt-3 h-11 items-center justify-center"
          >
            <Text className="text-sm text-slate-500">Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
