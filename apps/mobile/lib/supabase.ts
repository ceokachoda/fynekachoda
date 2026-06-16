import "react-native-url-polyfill/auto";
import "./auth-log-filter";
import { AppState, Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";
import { env } from "./env";
import { secureStorage } from "./secure-store";

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Supabase's recommended React Native pattern: run the token auto-refresh timer
// only while the app is foregrounded. A backgrounded app whose refresh timer
// fires can have the OS suspend the request mid-flight, which then races the
// next foreground refresh into a "refresh_token_not_found" — a spurious logout
// on reopen. Pausing on background and resuming on foreground (which also kicks
// an immediate refresh when the token is stale) makes app-resume reliable.
// Native only — `expo start`'s web bundle has no real AppState lifecycle.
// Guarded so Fast Refresh in dev can't stack duplicate listeners.
declare global {
  // eslint-disable-next-line no-var
  var __fyneAuthAppState: boolean | undefined;
}
if (Platform.OS !== "web" && !globalThis.__fyneAuthAppState) {
  globalThis.__fyneAuthAppState = true;
  void supabase.auth.startAutoRefresh();
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
}
