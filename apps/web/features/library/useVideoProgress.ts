"use client";

import { useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/SessionProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export interface VideoProgressRow {
  student_id: string;
  content_id: string;
  position_sec: number;
  watched_pct: number;
  last_watched_at: string;
}

// Leading-edge throttle (10s). Writes the first call immediately, then suppresses
// further writes for 10s. Matches mobile useVideoProgress timings.
const THROTTLE_MS = 10_000;

export function useVideoProgress(contentId: string | undefined) {
  const { appUser } = useSession();
  const studentId = appUser?.id;
  const lastSent = useRef<number>(0);
  const inFlight = useRef<boolean>(false);

  const initial = useQuery<VideoProgressRow | null>({
    queryKey: ["video-progress", contentId, studentId],
    enabled: !!contentId && !!studentId,
    staleTime: 30_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("video_progress")
        .select(
          "student_id, content_id, position_sec, watched_pct, last_watched_at",
        )
        .eq("content_id", contentId!)
        .eq("student_id", studentId!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as VideoProgressRow | null) ?? null;
    },
  });

  const update = useCallback(
    async (positionSec: number, durationSec: number) => {
      if (!contentId || !studentId) return;
      const now = Date.now();
      if (now - lastSent.current < THROTTLE_MS) return;
      if (inFlight.current) return;
      inFlight.current = true;
      lastSent.current = now;
      try {
        const pct =
          durationSec > 0
            ? Math.min(100, Math.round((positionSec / durationSec) * 100 * 100) / 100)
            : 0;
        const supabase = createSupabaseBrowserClient();
        await supabase.from("video_progress").upsert(
          {
            student_id: studentId,
            content_id: contentId,
            position_sec: Math.max(0, Math.floor(positionSec)),
            watched_pct: pct,
            last_watched_at: new Date().toISOString(),
          },
          { onConflict: "student_id,content_id" },
        );
      } catch {
        // non-critical
      } finally {
        inFlight.current = false;
      }
    },
    [contentId, studentId],
  );

  return {
    initial: initial.data ?? null,
    isLoading: initial.isLoading,
    update,
  };
}
