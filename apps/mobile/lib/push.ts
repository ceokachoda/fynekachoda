// Mobile push-notification plumbing (Expo).
//
// - registerForPush(): asks permission, gets the Expo push token, registers it
//   server-side via the `push-register` edge fn, and remembers it so logout can
//   deregister it. Safe to call repeatedly (idempotent upsert server-side).
// - unregisterForPush(): called right before sign-out while the JWT is valid.
// - notificationRouteFor(): maps a notification's `data` payload to an in-app
//   route (kept in sync with the semantic `type` values the backend sends).
//
// Foreground display + the Android channel are configured at module load so a
// push that arrives while the app is open still shows a heads-up banner.

import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { secureStorage } from "./secure-store";
import { invokeEdgeFn } from "./edge-fn";

const TOKEN_KEY = "fyne_expo_push_token";
const ANDROID_CHANNEL = "default";

// Show banners/sounds even when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
    name: "Default",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#2563EB",
  });
}

function projectId(): string | undefined {
  // app.json -> extra.eas.projectId, surfaced via expo-constants.
  const eas = Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined;
  return eas?.projectId;
}

// Acquire (or refresh) the Expo push token and register it server-side.
// Returns the token on success, or null if unavailable / permission denied.
export async function registerForPush(): Promise<string | null> {
  try {
    // Push tokens are only issued on physical devices.
    if (!Device.isDevice) return null;

    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== "granted") return null;

    const pid = projectId();
    const tokenResp = await Notifications.getExpoPushTokenAsync(
      pid ? { projectId: pid } : undefined,
    );
    const token = tokenResp.data;
    if (!token) return null;

    const res = await invokeEdgeFn("push-register", {
      kind: "expo",
      token,
      platform: Platform.OS,
      device_name: Device.deviceName ?? null,
    });
    if (res.status === 200) {
      await secureStorage.setItem(TOKEN_KEY, token);
      return token;
    }
    return null;
  } catch {
    // Push is best-effort; never let it surface to the user or block the app.
    return null;
  }
}

// Deregister the current device for the logged-in user (call before sign-out).
export async function unregisterForPush(): Promise<void> {
  try {
    const token = await secureStorage.getItem(TOKEN_KEY);
    if (!token) return;
    await invokeEdgeFn("push-unregister", { kind: "expo", token });
    await secureStorage.removeItem(TOKEN_KEY);
  } catch {
    // best-effort
  }
}

// Map a notification `data` payload to an in-app route. Keep the `type` values
// in sync with the backend (_shared/notify.ts callers).
export function notificationRouteFor(
  data: Record<string, unknown> | undefined | null,
): string | null {
  if (!data || typeof data !== "object") return null;
  const type = data.type;
  const id = typeof data.id === "string" ? data.id : undefined;
  const sessionId = typeof data.session_id === "string" ? data.session_id : undefined;

  switch (type) {
    case "live_started":
      return sessionId ? `/live/${sessionId}` : "/(student)/classes";
    case "class_scheduled":
    case "class_reminder":
      return "/(student)/classes";
    case "new_content":
      if (!id) return "/(student)/library";
      return data.kind === "video" ? `/video/${id}` : `/pdf/${id}`;
    case "new_quiz":
    case "new_exam":
      return "/(student)/practice";
    case "exam_results":
      return id ? `/exam-results/${id}` : "/(student)/practice";
    default:
      return null;
  }
}
