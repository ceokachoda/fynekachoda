import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// expo-secure-store has no native module on web (or during the SSR pass Expo
// Router runs for web entries). To keep the Supabase client construction
// non-fatal there, dispatch by platform: native uses SecureStore (Keychain /
// Keystore — required by spec D-026 for refresh tokens), web/SSR uses
// localStorage when available and a no-op otherwise.
//
// Web is NOT a production target; this is purely so `expo start` doesn't
// crash while bundling the web entry alongside the native one.

const isWeb = Platform.OS === "web";

function safeLocalStorage(): Storage | null {
  try {
    if (typeof globalThis !== "undefined" && "localStorage" in globalThis) {
      return (globalThis as { localStorage?: Storage }).localStorage ?? null;
    }
  } catch {
    // Privacy mode or hardened browsers throw on access — ignore.
  }
  return null;
}

const webStorage = {
  async getItem(key: string): Promise<string | null> {
    return safeLocalStorage()?.getItem(key) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    safeLocalStorage()?.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    safeLocalStorage()?.removeItem(key);
  },
};

const nativeStorage = {
  async getItem(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    return SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string): Promise<void> {
    return SecureStore.deleteItemAsync(key);
  },
};

export const secureStorage = isWeb ? webStorage : nativeStorage;
