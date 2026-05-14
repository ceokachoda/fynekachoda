export function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

export const env = {
  supabaseUrl: required("EXPO_PUBLIC_SUPABASE_URL", process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: required("EXPO_PUBLIC_SUPABASE_ANON_KEY", process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? null,
  posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY ?? null,
  posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
} as const;
