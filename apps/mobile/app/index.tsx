import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter } from "expo-router";
import { useSession } from "@/features/auth/useSession";
import { useRole } from "@/features/auth/useRole";

// Splash / router. Reads the session and routes to:
//   - /login                 — when not signed in (incl. force-fallback on stuck load)
//   - /suspended             — when signed in but app_users.is_active is false
//   - /force-password-change — when must_change_password is true
//   - /(student)             — student role
//   - /(teacher)             — teacher role
//   - /role-chooser          — when both student + teacher (multi-role)
//   - /admin-redirect        — when any admin role (we don't host admin here),
//                              also used as the "no usable role" trapdoor so a
//                              misconfigured account doesn't infinite-bounce.

const LOAD_TIMEOUT_MS = 10_000;

export default function SplashRouter() {
  const router = useRouter();
  const { isLoading, session, appUser } = useSession();
  const role = useRole();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!isLoading) return;
    const t = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [isLoading]);

  useEffect(() => {
    const stillLoading = isLoading && !timedOut;
    if (stillLoading) return;

    if (!session || !appUser) {
      router.replace("/login");
      return;
    }
    if (!appUser.is_active) {
      router.replace("/suspended");
      return;
    }
    if (appUser.must_change_password) {
      router.replace("/force-password-change");
      return;
    }
    if (role.isMultiRole) {
      router.replace("/role-chooser");
      return;
    }
    if (role.isStudent) {
      router.replace("/(student)");
      return;
    }
    if (role.isTeacher) {
      router.replace("/(teacher)");
      return;
    }
    // Admin-only OR no usable role: both lead here. admin-redirect screen
    // tells the user to use the web panel and offers Sign out, breaking the
    // bounce loop that would otherwise happen for a no-role account.
    router.replace("/admin-redirect");
  }, [isLoading, timedOut, session, appUser, role, router]);

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator size="large" color="#2563EB" />
    </View>
  );
}
