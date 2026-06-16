import { useEffect, useState } from "react";
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
  const { refresh, session, appUser } = useSession();
  const [retrying, setRetrying] = useState(false);

  // Auto-recover: the user landed here because the first profile load lost a
  // race with a flaky network. Try once on mount — and the moment the profile
  // actually resolves (this retry, or a background token refresh), leave the
  // card so they're never stranded staring at it. If the session itself is gone
  // they belong on /login. While a retry is in flight we stay put.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRetrying(true);
      await refresh();
      if (!cancelled) setRetrying(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    if (retrying) return;
    if (session && appUser) {
      router.replace("/");
    } else if (!session) {
      router.replace("/login");
    }
  }, [retrying, session, appUser, router]);

  async function handleRetry() {
    if (retrying) return;
    setRetrying(true);
    await refresh();
    setRetrying(false);
    // Navigation is handled by the effect above once state settles: → "/" when
    // the profile resolves, → /login if signed out, otherwise stay so the user
    // can try again.
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
