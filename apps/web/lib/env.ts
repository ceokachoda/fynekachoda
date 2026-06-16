function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

export const env = {
  supabaseUrl: required(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ),
  supabaseAnonKey: required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
  adminUrl:
    process.env.NEXT_PUBLIC_ADMIN_URL ?? "https://fyne-study-app-admin.vercel.app",
  // Web Push application-server (VAPID) public key. NOT secret — it ships to the
  // browser to create push subscriptions. Defaults to the project key so the
  // PWA works without an extra Vercel env var; override with
  // NEXT_PUBLIC_VAPID_PUBLIC_KEY if the keypair is ever rotated.
  vapidPublicKey:
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
    "BIwg8ABbKvu4Gv-_cea6sRbZX6bJ8xxuNnaMle1EMgJO0bCqZTa915lg_Wd4b94gAUZsDbZMkq-NWUNZdKxm9us",
} as const;
