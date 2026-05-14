import "react-native-url-polyfill/auto";
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
