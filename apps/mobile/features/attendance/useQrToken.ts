import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  withTimeout,
} from "@/features/auth/network-errors";

export type QrTokenState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "token"; payload_b64: string; exp: number }
  | {
      kind: "error";
      code:
        | "already_marked"
        | "rate_limited"
        | "window_closed"
        | "forbidden"
        | "not_found"
        | "network"
        | "unknown";
      message: string;
    };

const REFRESH_INTERVAL_MS = 25_000;

export function useQrToken(sessionId: string | null): {
  state: QrTokenState;
  refresh: () => void;
} {
  const [state, setState] = useState<QrTokenState>({ kind: "idle" });
  const stopped = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tokenRef = useRef<{ payload_b64: string; exp: number } | null>(null);

  const fetchOnce = useCallback(async () => {
    if (!sessionId || stopped.current) return;
    setState((prev) =>
      prev.kind === "token" || prev.kind === "error"
        ? prev
        : { kind: "loading" },
    );
    try {
      const { data, error } = await withTimeout(
        supabase.functions.invoke("attendance-qr-sign", {
          body: { session_id: sessionId },
        }),
      );
      if (stopped.current) return;
      if (error) {
        const status = (error as { context?: { status?: number } }).context?.status;
        const detail = data as { error?: string } | null;
        if (status === 409) {
          stopped.current = true;
          setState({
            kind: "error",
            code: "already_marked",
            message: "You're already marked for this class.",
          });
          return;
        }
        if (status === 429) {
          // Keep the existing token if any; rate-limit retries on next tick.
          if (tokenRef.current) return;
          setState({
            kind: "error",
            code: "rate_limited",
            message: "Refreshing too fast. Try again in a few seconds.",
          });
          return;
        }
        if (status === 400) {
          stopped.current = true;
          setState({
            kind: "error",
            code: "window_closed",
            message: detail?.error ?? "Scan window is closed.",
          });
          return;
        }
        if (status === 403) {
          stopped.current = true;
          setState({
            kind: "error",
            code: "forbidden",
            message: "This class isn't in your batch.",
          });
          return;
        }
        if (status === 404) {
          stopped.current = true;
          setState({
            kind: "error",
            code: "not_found",
            message: "Class not found.",
          });
          return;
        }
        if (isNetworkError(error)) {
          if (!tokenRef.current) {
            setState({
              kind: "error",
              code: "network",
              message: NETWORK_ERROR_MESSAGE,
            });
          }
          return;
        }
        setState({
          kind: "error",
          code: "unknown",
          message: detail?.error ?? "Couldn't get a QR code.",
        });
        return;
      }
      const body = data as { payload_b64?: string; exp?: number } | null;
      if (!body?.payload_b64 || typeof body.exp !== "number") {
        setState({
          kind: "error",
          code: "unknown",
          message: "Server returned an unexpected response.",
        });
        return;
      }
      tokenRef.current = { payload_b64: body.payload_b64, exp: body.exp };
      setState({
        kind: "token",
        payload_b64: body.payload_b64,
        exp: body.exp,
      });
    } catch (err) {
      if (stopped.current) return;
      if (isNetworkError(err)) {
        if (!tokenRef.current) {
          setState({
            kind: "error",
            code: "network",
            message: NETWORK_ERROR_MESSAGE,
          });
        }
        return;
      }
      setState({
        kind: "error",
        code: "unknown",
        message: "Couldn't get a QR code.",
      });
    }
  }, [sessionId]);

  const refresh = useCallback(() => {
    stopped.current = false;
    tokenRef.current = null;
    setState({ kind: "loading" });
    void fetchOnce();
  }, [fetchOnce]);

  useEffect(() => {
    stopped.current = false;
    tokenRef.current = null;
    setState({ kind: "idle" });
    if (!sessionId) return;
    void fetchOnce();
    intervalRef.current = setInterval(() => {
      if (!stopped.current) void fetchOnce();
    }, REFRESH_INTERVAL_MS);
    // The per-second countdown lives in <QrCountdown> (a tiny leaf in QrDisplay)
    // so the QR matrix + card never re-render on the tick — only the seconds
    // text does. This keeps the SVG fully stable between 25s refreshes.
    return () => {
      stopped.current = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      tokenRef.current = null;
    };
  }, [sessionId, fetchOnce]);

  return { state, refresh };
}
