function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

export const env = {
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? null,
  sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? null,
  posthogKey: process.env.NEXT_PUBLIC_POSTHOG_KEY ?? null,
  posthogHost: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
} as const;

export function requireServiceRoleKey(): string {
  if (!env.supabaseServiceRoleKey) {
    throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY (server-only)");
  }
  return env.supabaseServiceRoleKey;
}
