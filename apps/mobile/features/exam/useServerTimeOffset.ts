// Server-time offset (server - device). Seeded from `exam-start`'s
// `server_now`; re-synced every 60s from the public `server-time` fn so
// long-running exams don't drift past the deadline.

import { useEffect, useRef, useState } from "react";
import { invokeEdgeFnPublic } from "@/lib/edge-fn";

const RESYNC_MS = 60_000;

export function useServerTimeOffset(initialServerNowIso: string | null) {
  const [offsetMs, setOffsetMs] = useState<number>(0);
  const initialAppliedRef = useRef(false);

  useEffect(() => {
    if (!initialServerNowIso || initialAppliedRef.current) return;
    const server = new Date(initialServerNowIso).getTime();
    setOffsetMs(server - Date.now());
    initialAppliedRef.current = true;
  }, [initialServerNowIso]);

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
      } catch {
        // Silent — keep last known offset.
      }
    };
    const t = setInterval(() => void sync(), RESYNC_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  // server_now ≈ Date.now() + offsetMs
  return offsetMs;
}
