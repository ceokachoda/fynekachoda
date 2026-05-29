// Minimal logging shim.
//
// Sentry + PostHog stay DEFERRED for the web app, mirroring the mobile decision
// (Phase 5 §G3). Routing caught exceptions through this one module means wiring
// Sentry later is a single-file change — swap the body of `logError` for
// `Sentry.captureException`. `console.error`/`console.warn` survive the
// production build (next.config.ts `removeConsole` excludes them), so errors
// remain visible in Vercel logs today.
//
// Keep context PII-light — only pass non-sensitive identifiers / state.

type LogContext = Record<string, unknown>;

export function logError(error: unknown, context?: LogContext): void {
  if (context && Object.keys(context).length > 0) {
    console.error("[fyne]", error, context);
  } else {
    console.error("[fyne]", error);
  }
  // FUTURE (Sentry enabled): Sentry.captureException(error, { extra: context });
}

export function logWarn(message: string, context?: LogContext): void {
  if (context && Object.keys(context).length > 0) {
    console.warn("[fyne]", message, context);
  } else {
    console.warn("[fyne]", message);
  }
}

// Analytics event hook. No-op until PostHog is wired (deferred).
export function logEvent(name: string, props?: LogContext): void {
  void name;
  void props;
  // FUTURE (PostHog enabled): posthog.capture(name, props);
}
