// Supabase auth-js logs a red `console.error(AuthApiError)` on launch whenever a
// PERSISTED refresh token can no longer be refreshed — e.g. the account was
// removed server-side (our 2026-06-02 prod data reset did exactly this), or the
// session simply aged out past its refresh window. auth-js then clears the token
// itself (non-retryable errors → `_removeSession`) and the app lands cleanly on
// the login screen. The message is therefore BENIGN and self-healing: nothing is
// broken, the user just needs to sign in again. But shown raw it looks like a
// crash and clutters the logs.
//
// We swallow ONLY that exact class of startup auth noise; every other
// console.error passes through untouched. Installed once, as early as the
// supabase client module loads, so it's in place before auth-js's first
// `_recoverAndRefresh` runs.

const BENIGN =
  /(invalid refresh token|refresh token not found|refresh_token_not_found|auth session missing|session[_ ]not[_ ]found)/i;

function isBenign(arg: unknown): boolean {
  if (typeof arg === "string") return BENIGN.test(arg);
  if (arg && typeof arg === "object") {
    const e = arg as { message?: unknown; code?: unknown };
    if (typeof e.message === "string" && BENIGN.test(e.message)) return true;
    if (typeof e.code === "string" && BENIGN.test(e.code)) return true;
  }
  return false;
}

declare global {
  // eslint-disable-next-line no-var
  var __fyneAuthLogFilter: boolean | undefined;
}

if (!globalThis.__fyneAuthLogFilter) {
  globalThis.__fyneAuthLogFilter = true;
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    // auth-js logs `console.error(error)` (error first) or
    // `console.error('label', error)` — check the first two slots only.
    if (isBenign(args[0]) || isBenign(args[1])) return;
    original(...args);
  };
}

export {};
