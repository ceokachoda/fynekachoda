"use client";

// Phase 4 (Web) — signed playback for a live / recording SESSION.
// Calls yt-playback-sign with { session_id, kind }. This is intentionally
// separate from features/library/usePlaybackSign which keys on content_id.
//
// 409 is a NORMAL state (class not live yet, recording still processing) and
// is surfaced via `status`, not as an `error`.

import { useCallback, useEffect, useState } from "react";
import { invokeEdgeFn } from "@/lib/edge-fn";

export interface SignedPlayback {
  video_id: string;
  watermark: string;
  kind: "live" | "recording";
  exp: number;
}

interface SignBody extends SignedPlayback {
  envelope: string;
  error?: string;
}

export interface PlaybackSignState {
  signed: SignedPlayback | null;
  status: number | null;
  error: string | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

export function useLivePlaybackSign(
  sessionId: string | undefined,
  kind: "live" | "recording",
  enabled = true,
): PlaybackSignState {
  const [signed, setSigned] = useState<SignedPlayback | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!sessionId || !enabled) return;
    setIsLoading(true);
    setError(null);
    const res = await invokeEdgeFn<SignBody>("yt-playback-sign", {
      session_id: sessionId,
      kind,
    });
    setStatus(res.status);
    if (res.status === 200 && res.body?.video_id) {
      setSigned({
        video_id: res.body.video_id,
        watermark: res.body.watermark,
        kind: res.body.kind,
        exp: res.body.exp,
      });
    } else {
      setSigned(null);
      if (res.status !== 409) {
        setError(res.body?.error ?? res.error ?? "Couldn't authorize playback.");
      }
    }
    setIsLoading(false);
  }, [sessionId, kind, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { signed, status, error, isLoading, refetch: load };
}
