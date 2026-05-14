import { env } from "./env";

export function track(_event: string, _props?: Record<string, unknown>): void {
  if (!env.posthogKey) return;
  // PostHog not installed in Phase 1 per user decision.
  // To enable later: pnpm --filter @fynestudy/mobile add posthog-react-native,
  // initialize PostHog(env.posthogKey, { host: env.posthogHost }), and capture events here.
}

export function identify(_userId: string, _props?: Record<string, unknown>): void {
  if (!env.posthogKey) return;
  // PostHog.identify(userId, props)
}
