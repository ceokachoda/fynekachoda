// Phase 5 — fetches a signed playback envelope from `yt-playback-sign`.
// The wrapped player consumes the envelope; the YT video id never lives in
// component props or DOM beyond the iframe URL.

import { supabase } from "@/lib/supabase";

export interface PlaybackSignResponse {
  envelope: string;
  video_id: string;
  watermark: string;
  kind: "lesson" | "live" | "recording";
  exp: number;
}

export async function fetchPlaybackSign(
  contentId: string,
): Promise<PlaybackSignResponse> {
  const { data, error } = await supabase.functions.invoke("yt-playback-sign", {
    body: { content_id: contentId },
  });
  if (error) {
    const msg = (error as Error & { message?: string }).message ??
      "Could not load video";
    throw new Error(msg);
  }
  const r = data as PlaybackSignResponse;
  if (!r?.video_id || !r?.envelope || !r?.watermark) {
    throw new Error("malformed playback response");
  }
  return r;
}
