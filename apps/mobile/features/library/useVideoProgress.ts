import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/features/auth/useSession";
import { withTimeout } from "@/features/auth/network-errors";

export interface VideoProgressRow {
  student_id: string;
  content_id: string;
  position_sec: number;
  watched_pct: number;
  last_watched_at: string;
}

interface State {
  initial: VideoProgressRow | null;
  isLoading: boolean;
  update: (positionSec: number, durationSec: number) => Promise<void>;
}

// Phase 5 §7.1 — initial fetch surfaces the "Resume from X:XX?" sheet;
// `update` is called every ~15s while playing. Throttled client-side to
// avoid hammering the table.
export function useVideoProgress(contentId: string | undefined): State {
  const { appUser } = useSession();
  const [initial, setInitial] = useState<VideoProgressRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastSent = useRef<number>(0);
  const inFlightRef = useRef<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!contentId || !appUser?.id) {
        setInitial(null);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const res = await withTimeout(
          supabase
            .from("video_progress")
            .select(
              "student_id, content_id, position_sec, watched_pct, last_watched_at",
            )
            .eq("content_id", contentId)
            .eq("student_id", appUser.id)
            .maybeSingle(),
        );
        if (!cancelled) {
          setInitial((res.data as unknown as VideoProgressRow) ?? null);
        }
      } catch {
        if (!cancelled) setInitial(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [contentId, appUser?.id]);

  const update = useCallback(
    async (positionSec: number, durationSec: number) => {
      if (!contentId || !appUser?.id) return;
      const now = Date.now();
      if (now - lastSent.current < 10_000) return;
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      lastSent.current = now;
      try {
        const pct = durationSec > 0
          ? Math.min(100, Math.round((positionSec / durationSec) * 100 * 100) / 100)
          : 0;
        await withTimeout(
          supabase
            .from("video_progress")
            .upsert(
              {
                student_id: appUser.id,
                content_id: contentId,
                position_sec: Math.max(0, Math.floor(positionSec)),
                watched_pct: pct,
                last_watched_at: new Date().toISOString(),
              },
              { onConflict: "student_id,content_id" },
            ),
        );
      } catch {
        // soft-fail — progress UI is non-critical
      } finally {
        inFlightRef.current = false;
      }
    },
    [contentId, appUser?.id],
  );

  return { initial, isLoading, update };
}
