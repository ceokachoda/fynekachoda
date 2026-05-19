import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import "react-native-reanimated";
import "../global.css";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { initCrash } from "@/lib/crash";
import { track } from "@/lib/analytics";
import { supabase } from "@/lib/supabase";
import { usePingBackend } from "@/features/health/usePingBackend";
import { SplashOverlay } from "@/components/SplashOverlay";
import { SessionProvider } from "@/features/auth/SessionProvider";

export const unstable_settings = {
  anchor: "index",
};

const MIN_SPLASH_MS = 1500;

function PasswordRecoveryRouter() {
  // Supabase emits a `PASSWORD_RECOVERY` event when the user opens the
  // password-reset deep link. We catch it here and route to /reset so the
  // user can set a new password against the temporary session Supabase
  // attaches to the recovery URL.
  const router = useRouter();
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        router.replace("/reset");
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);
  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const status = usePingBackend();
  const [minDelayElapsed, setMinDelayElapsed] = useState(false);

  useEffect(() => {
    initCrash();
    track("app_open");
    const t = setTimeout(() => setMinDelayElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  const showSplash = !minDelayElapsed || status === "loading";

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <SessionProvider>
        <PasswordRecoveryRouter />
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
          <Stack.Screen
            name="force-password-change"
            options={{ headerShown: false, gestureEnabled: false }}
          />
          <Stack.Screen name="reset" options={{ headerShown: false }} />
          <Stack.Screen
            name="suspended"
            options={{ headerShown: false, gestureEnabled: false }}
          />
          <Stack.Screen
            name="admin-redirect"
            options={{ headerShown: false, gestureEnabled: false }}
          />
          <Stack.Screen
            name="role-chooser"
            options={{ headerShown: false, gestureEnabled: false }}
          />
          <Stack.Screen name="(student)" options={{ headerShown: false }} />
          <Stack.Screen name="(teacher)" options={{ headerShown: false }} />
          <Stack.Screen
            name="video/[contentId]"
            options={{ headerShown: false, gestureEnabled: true }}
          />
          <Stack.Screen
            name="pdf/[contentId]"
            options={{ headerShown: false, gestureEnabled: true }}
          />
          <Stack.Screen
            name="quiz/[id]"
            options={{ headerShown: false, gestureEnabled: false }}
          />
          <Stack.Screen
            name="quiz-builder/[quizId]"
            options={{ headerShown: false, gestureEnabled: true }}
          />
          <Stack.Screen
            name="modal"
            options={{ presentation: "modal", title: "Modal" }}
          />
        </Stack>
        {showSplash ? <SplashOverlay status={status} /> : null}
        <StatusBar style="auto" />
      </SessionProvider>
    </ThemeProvider>
  );
}
