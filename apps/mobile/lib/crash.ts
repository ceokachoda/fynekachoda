import { env } from "./env";

export function initCrash(): void {
  if (!env.sentryDsn) return;
  // Sentry not installed in Phase 1 per user decision.
  // To enable later: pnpm --filter @fynestudy/mobile add @sentry/react-native,
  // import * as Sentry from "@sentry/react-native", and call Sentry.init({ dsn: env.sentryDsn, ... })
  // with PII scrubbing in beforeSend (see CLAUDE.md "No PII in Sentry events").
}

export function reportError(error: unknown, _context?: Record<string, unknown>): void {
  if (!env.sentryDsn) {
    if (__DEV__) {
      console.warn("[crash] error (no Sentry configured):", error);
    }
    return;
  }
  // Sentry.captureException(error, { extra: context });
}
