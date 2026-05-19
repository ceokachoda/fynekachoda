// Phase 5 — YouTube helpers used by content-create-video.
//
// 1) URL/ID parsing accepts:
//      - bare video id `dQw4w9WgXcQ` (11-char, [A-Za-z0-9_-])
//      - watch URL  https://www.youtube.com/watch?v=ID&...
//      - short URL  https://youtu.be/ID
//      - embed URL  https://www.youtube.com/embed/ID
//      - shorts URL https://www.youtube.com/shorts/ID
//      - live URL   https://www.youtube.com/live/ID
//
// 2) Data API v3 `videos.list` is called server-side (API key in Vault) to
//    verify the video exists, is on the institute channel, and is Unlisted.

const YT_VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const YT_URL_RES: RegExp[] = [
  /[?&]v=([A-Za-z0-9_-]{11})/,
  /youtu\.be\/([A-Za-z0-9_-]{11})/,
  /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
  /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
  /youtube\.com\/live\/([A-Za-z0-9_-]{11})/,
];

export function parseYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (YT_VIDEO_ID_RE.test(trimmed)) return trimmed;
  for (const re of YT_URL_RES) {
    const m = trimmed.match(re);
    if (m && m[1]) return m[1];
  }
  return null;
}

// ISO 8601 duration → seconds. Supports the subset YT actually returns:
// `PT#H#M#S`, with any component optional, e.g. `PT1H2M3S`, `PT45S`, `PT5M`.
export function parseIsoDurationToSeconds(iso: string): number | null {
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  const h = parseInt(m[1] ?? "0", 10);
  const min = parseInt(m[2] ?? "0", 10);
  const s = parseInt(m[3] ?? "0", 10);
  return h * 3600 + min * 60 + s;
}

export interface YtVideoMeta {
  id: string;
  title: string;
  channelId: string;
  privacyStatus: "public" | "unlisted" | "private";
  durationSec: number;
}

export class YouTubeApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function fetchYouTubeVideoMeta(
  videoId: string,
  apiKey: string,
): Promise<YtVideoMeta | null> {
  const url =
    `https://www.googleapis.com/youtube/v3/videos?id=${encodeURIComponent(videoId)}&part=snippet,status,contentDetails&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new YouTubeApiError(
      res.status,
      `youtube videos.list failed: ${res.status} ${body.slice(0, 200)}`,
    );
  }
  const json = await res.json();
  const item = (json.items ?? [])[0];
  if (!item) return null;
  const dur = parseIsoDurationToSeconds(
    item.contentDetails?.duration ?? "PT0S",
  );
  return {
    id: item.id,
    title: item.snippet?.title ?? "",
    channelId: item.snippet?.channelId ?? "",
    privacyStatus: (item.status?.privacyStatus ?? "private") as
      | "public"
      | "unlisted"
      | "private",
    durationSec: dur ?? 0,
  };
}
