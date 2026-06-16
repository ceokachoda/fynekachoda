import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { useSessionContext } from "@/features/auth/SessionProvider";
import { notificationRouteFor, registerForPush } from "@/lib/push";

// Headless gate mounted under SessionProvider. Two jobs:
//   1. Register this device's Expo push token once the user is signed in.
//   2. Route notification taps (foreground/background + cold start) to the
//      relevant screen. Taps received before the profile is ready are queued
//      and replayed once `appUser` lands so we never navigate to a gated screen
//      mid-boot.
export function PushGate() {
  const router = useRouter();
  const { session, appUser } = useSessionContext();
  const registeredFor = useRef<string | null>(null);
  const pendingRoute = useRef<string | null>(null);

  // Register the device once per signed-in user.
  useEffect(() => {
    if (!session || !appUser) return;
    if (registeredFor.current === appUser.id) return;
    registeredFor.current = appUser.id;
    void registerForPush();
  }, [session, appUser]);

  // Tap handling.
  useEffect(() => {
    const go = (data: Record<string, unknown> | undefined) => {
      const route = notificationRouteFor(data);
      if (!route) return;
      if (appUser) {
        router.push(route as never);
      } else {
        // Defer until the session/profile is ready.
        pendingRoute.current = route;
      }
    };

    // Cold start: app opened by tapping a notification.
    Notifications.getLastNotificationResponseAsync().then((resp) => {
      if (resp) go(resp.notification.request.content.data as Record<string, unknown>);
    });

    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      go(resp.notification.request.content.data as Record<string, unknown>);
    });
    return () => sub.remove();
    // appUser intentionally in deps so `go` always sees the latest auth state.
  }, [appUser, router]);

  // Replay a queued tap once the user is available.
  useEffect(() => {
    if (appUser && pendingRoute.current) {
      const route = pendingRoute.current;
      pendingRoute.current = null;
      router.push(route as never);
    }
  }, [appUser, router]);

  return null;
}
