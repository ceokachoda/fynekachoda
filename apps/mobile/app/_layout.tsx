import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as ScreenOrientation from "expo-screen-orientation";
import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet } from "react-native";
import "react-native-reanimated";
import "../global.css";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { initCrash } from "@/lib/crash";
import { track } from "@/lib/analytics";
import { supabase } from "@/lib/supabase";
import { SplashOverlay } from "@/components/SplashOverlay";
import {
  SessionProvider,
  useSessionContext,
} from "@/features/auth/SessionProvider";

export const unstable_settings = {
  anchor: "index",
};

// Minimum brand moment so the splash never flickers on a warm start; hard cap so
// it can never get stuck if the profile fetch hangs on a flaky network (the
// router's own 10s timeout then takes over behind the fade).
const MIN_SPLASH_MS = 1200;
const MAX_SPLASH_MS = 4000;

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

function BootGate() {
  // The splash hides as soon as the session has resolved (after a short brand
  // moment) — it is NOT gated on a backend health ping, so slow networks no
  // longer stall cold start. A hard cap guarantees it always lifts.
  const { isLoading } = useSessionContext();
  const [minElapsed, setMinElapsed] = useState(false);
  const [capReached, setCapReached] = useState(false);
  const [hidden, setHidden] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const min = setTimeout(() => setMinElapsed(true), MIN_SPLASH_MS);
    const cap = setTimeout(() => setCapReached(true), MAX_SPLASH_MS);
    return () => {
      clearTimeout(min);
      clearTimeout(cap);
    };
  }, []);

  const ready = capReached || (minElapsed && !isLoading);

  useEffect(() => {
    if (!ready) return;
    Animated.timing(opacity, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setHidden(true);
    });
  }, [ready, opacity]);

  if (hidden) return null;
  return (
    <Animated.View
      pointerEvents={ready ? "none" : "auto"}
      style={[
        StyleSheet.absoluteFill,
        { opacity, zIndex: 999, backgroundColor: "#FFFFFF" },
      ]}
    >
      <SplashOverlay />
    </Animated.View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    initCrash();
    track("app_open");
    // Portrait everywhere by default; only the video watch screens opt into
    // rotation (they unlock on focus and re-lock portrait on leave).
    void ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.PORTRAIT_UP,
    );
  }, []);

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
            name="account-issue"
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
            name="exam/[id]"
            options={{ headerShown: false, gestureEnabled: false }}
          />
          <Stack.Screen
            name="exam-builder/[examId]"
            options={{ headerShown: false, gestureEnabled: true }}
          />
          <Stack.Screen
            name="exam-results/[examId]"
            options={{ headerShown: false, gestureEnabled: true }}
          />
          <Stack.Screen
            name="offline-scores"
            options={{ headerShown: false, gestureEnabled: true }}
          />
          <Stack.Screen
            name="live/[sessionId]"
            options={{ headerShown: false, gestureEnabled: true }}
          />
          <Stack.Screen
            name="recording/[sessionId]"
            options={{ headerShown: false, gestureEnabled: true }}
          />
          <Stack.Screen
            name="live-control/[sessionId]"
            options={{ headerShown: false, gestureEnabled: true }}
          />
          <Stack.Screen
            name="modal"
            options={{ presentation: "modal", title: "Modal" }}
          />
        </Stack>
        <BootGate />
        <StatusBar style="auto" />
      </SessionProvider>
    </ThemeProvider>
  );
}
