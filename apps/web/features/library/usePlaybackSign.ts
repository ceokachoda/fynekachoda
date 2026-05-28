"use client";

import { useQuery } from "@tanstack/react-query";
import { invokeEdgeFn } from "@/lib/edge-fn";

export interface PlaybackSignResponse {
  envelope: string;
  video_id: string;
  watermark: string;
  kind: "lesson" | "live" | "recording";
  exp: number;
}

// Lesson signed envelopes TTL = 4h. We refetch at staleTime: 3h to be safe.
export function useYtPlayback(contentId: string | undefined) {
  return useQuery<PlaybackSignResponse>({
    queryKey: ["yt-playback-sign", contentId],
    enabled: !!contentId,
    staleTime: 3 * 60 * 60 * 1000,
    queryFn: async () => {
      const res = await invokeEdgeFn<PlaybackSignResponse>("yt-playback-sign", {
        content_id: contentId,
      });
      if (res.status === 409) {
        throw new Error("video not yet available");
      }
      if (res.status !== 200 || !res.body) {
        throw new Error(`yt-playback-sign failed: ${res.status}`);
      }
      if (!res.body.video_id || !res.body.envelope) {
        throw new Error("yt-playback-sign malformed");
      }
      return res.body;
    },
  });
}

export interface PdfSignResponse {
  signed_url: string;
  expires_at: string;
  file_path: string;
}

// PDF signed URL TTL = 1h. Refetch a few minutes early.
export function usePdfSign(contentId: string | undefined) {
  return useQuery<PdfSignResponse>({
    queryKey: ["content-pdf-sign", contentId],
    enabled: !!contentId,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const res = await invokeEdgeFn<PdfSignResponse>("content-pdf-sign", {
        content_id: contentId,
      });
      if (res.status !== 200 || !res.body) {
        throw new Error(`content-pdf-sign failed: ${res.status}`);
      }
      if (!res.body.signed_url) {
        throw new Error("content-pdf-sign returned no signed_url");
      }
      return res.body;
    },
  });
}
