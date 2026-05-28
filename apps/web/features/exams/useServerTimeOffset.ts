"use client";

// D-183 defense-in-depth: the client computes `offset = serverNow - Date.now()`
// from exam-start's `server_now` once on entry, and re-syncs from the public
// `server-time` edge fn every 60 seconds + on window focus. The countdown
// renders `remaining = deadline - (Date.now() + offset)`. If the offset hook
// errors, the last good offset is kept — never falls back to `Date.now()`
// alone, because that would let device-clock skew bypass the deadline.

import { useEffect, useRef, useState } from "react";
import { invokeEdgeFnPublic } from "@/lib/edge-fn";

const RESYNC_MS = 60_000;

interface State {
  offsetMs: number;
  ready: boolean;
}

export function useServerTimeOffset(initialServerNowIso: string | null): State {
  const [offsetMs, setOffsetMs] = useState<number>(0);
  const [ready, setReady] = useState<boolean>(false);
  const initialAppliedRef = useRef(false);

  // Seed from the exam-start payload as soon as it lands.
  useEffect(() => {
    if (!initialServerNowIso || initialAppliedRef.current) return;
    const server = new Date(initialServerNowIso).getTime();
    if (Number.isFinite(server)) {
      setOffsetMs(server - Date.now());
      setReady(true);
      initialAppliedRef.current = true;
    }
  }, [initialServerNowIso]);

  // 60-second resync + on-focus resync.
  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      try {
        const { body } = await invokeEdgeFnPublic<{ now: string; epoch_ms: number }>(
          "server-time",
          {},
        );
        if (cancelled || !body || typeof body.epoch_ms !== "number") return;
        setOffsetMs(body.epoch_ms - Date.now());
        setReady(true);
      } catch {
        // Silent — keep last known offset.
      }
    };
    const t = setInterval(() => void sync(), RESYNC_MS);
    const onFocus = () => {
      void sync();
    };
    window.addEventListener("focus", onFocus);
    // Kick once immediately in case exam-start hasn't seeded yet (e.g., when
    // resuming an in-flight attempt and the cached payload is stale).
    void sync();
    return () => {
      cancelled = true;
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return { offsetMs, ready };
}

// Pure helper extracted for unit testing — given a wall clock + offset +
// deadline, returns the remaining milliseconds clamped at 0.
export function computeRemainingMs(
  deadlineMs: number,
  deviceNowMs: number,
  offsetMs: number,
): number {
  return Math.max(0, deadlineMs - (deviceNowMs + offsetMs));
}

// Format remaining milliseconds → "MM:SS" string (zero-padded). Caps at
// 99:59 to avoid the pill blowing out the header on long durations.
export function formatRemainingMmSs(remainingMs: number): string {
  const totalSec = Math.floor(Math.max(0, remainingMs) / 1000);
  const m = Math.min(99, Math.floor(totalSec / 60));
  const s = totalSec % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(m)}:${pad(s)}`;
}
