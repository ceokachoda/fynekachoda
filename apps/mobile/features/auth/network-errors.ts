// Recognise fetch-couldn't-reach-the-network failures so the UI can show a
// retry-friendly message instead of a raw stack trace. Pure-module on purpose
// so jest can test it without touching react-native or supabase-js.

export class TimeoutError extends Error {
  constructor(message = "Request timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}

export function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof TimeoutError) return true;
  if (err instanceof TypeError) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /network request failed|failed to fetch|network error|timed? ?out|aborted/i
    .test(msg);
}

export const NETWORK_ERROR_MESSAGE =
  "Couldn't reach the server. Check your internet connection and try again.";

// Mobile networks drop packets silently — RN's fetch and supabase-js have no
// built-in timeout, so a dropped response leaves the UI awaiting forever.
// 15s is well past the p99 of every call we make.
export const DEFAULT_TIMEOUT_MS = 15_000;

// Races a promise against a timeout. If the timeout fires first, throws a
// TimeoutError. NOTE: the underlying promise is NOT cancelled (supabase-js
// doesn't expose AbortController). The server side may still complete — that
// is acceptable because every auth mutation we issue is idempotent on retry.
export function withTimeout<T>(
  p: Promise<T>,
  ms: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError()), ms);
  });
  return Promise.race([p, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
