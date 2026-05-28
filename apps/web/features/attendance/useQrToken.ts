"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { invokeEdgeFn } from "@/lib/edge-fn";

// Server-anchored rotating QR. Token expires 30s after issue (server side);
// refresh client every 25s so the displayed token is never within 5s of expiry.

export type QrTokenState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "token"; payload_b64: string; exp: number; secondsLeft: number }
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
const COUNTDOWN_TICK_MS = 1_000;

interface SignResponse {
  payload_b64?: string;
  exp?: number;
  error?: string;
}

export function useQrToken(sessionId: string | null): {
  state: QrTokenState;
  refresh: () => void;
} {
  const [state, setState] = useState<QrTokenState>({ kind: "idle" });
  const stopped = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tokenRef = useRef<{ payload_b64: string; exp: number } | null>(null);

  const fetchOnce = useCallback(async () => {
    if (!sessionId || stopped.current) return;
    setState((prev) =>
      prev.kind === "token" || prev.kind === "error"
        ? prev
        : { kind: "loading" },
    );
    const res = await invokeEdgeFn<SignResponse>("attendance-qr-sign", {
      session_id: sessionId,
    });
    if (stopped.current) return;

    if (res.status === 409) {
      stopped.current = true;
      setState({
        kind: "error",
        code: "already_marked",
        message: "You're already marked for this class.",
      });
      return;
    }
    if (res.status === 429) {
      if (tokenRef.current) return;
      setState({
        kind: "error",
        code: "rate_limited",
        message: "Refreshing too fast. Try again in a few seconds.",
      });
      return;
    }
    if (res.status === 400) {
      stopped.current = true;
      setState({
        kind: "error",
        code: "window_closed",
        message: res.body?.error ?? "Scan window is closed.",
      });
      return;
    }
    if (res.status === 403) {
      stopped.current = true;
      setState({
        kind: "error",
        code: "forbidden",
        message: "This class isn't in your batch.",
      });
      return;
    }
    if (res.status === 404) {
      stopped.current = true;
      setState({
        kind: "error",
        code: "not_found",
        message: "Class not found.",
      });
      return;
    }
    if (res.status === 0 || !res.body) {
      if (!tokenRef.current) {
        setState({
          kind: "error",
          code: "network",
          message: "You're offline. Reconnect to continue.",
        });
      }
      return;
    }
    if (res.status !== 200) {
      setState({
        kind: "error",
        code: "unknown",
        message: res.body?.error ?? "Couldn't get a QR code.",
      });
      return;
    }
    if (!res.body.payload_b64 || typeof res.body.exp !== "number") {
      setState({
        kind: "error",
        code: "unknown",
        message: "Server returned an unexpected response.",
      });
      return;
    }
    tokenRef.current = {
      payload_b64: res.body.payload_b64,
      exp: res.body.exp,
    };
    const secondsLeft = Math.max(
      0,
      res.body.exp - Math.floor(Date.now() / 1000),
    );
    setState({
      kind: "token",
      payload_b64: res.body.payload_b64,
      exp: res.body.exp,
      secondsLeft,
    });
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
    tickRef.current = setInterval(() => {
      const tok = tokenRef.current;
      if (!tok) return;
      const secondsLeft = Math.max(0, tok.exp - Math.floor(Date.now() / 1000));
      setState((prev) =>
        prev.kind === "token" ? { ...prev, secondsLeft } : prev,
      );
    }, COUNTDOWN_TICK_MS);
    return () => {
      stopped.current = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
      intervalRef.current = null;
      tickRef.current = null;
      tokenRef.current = null;
    };
  }, [sessionId, fetchOnce]);

  return { state, refresh };
}
