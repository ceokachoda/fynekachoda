// Phase 5 — unit smoke for the pure helpers used by content edge fns.
//
// Run with `pnpm exec tsx scripts/test-content-helpers.ts`. Exit 0 on green,
// 1 on the first failed expectation.

import {
  parseIsoDurationToSeconds,
  parseYouTubeId,
} from "../apps/functions/_shared/youtube.ts";
import { formatWatermark } from "../apps/functions/_shared/watermark.ts";
import {
  canonicalPlaybackString,
  decodePlaybackEnvelope,
  encodePlaybackEnvelope,
  type PlaybackPayload,
  signPlayback,
  verifyPlayback,
} from "../apps/functions/_shared/playback.ts";

let failures = 0;
function ok(name: string, pass: boolean, detail?: unknown) {
  if (pass) {
    console.log("  ✓", name);
  } else {
    console.log("  ✗", name, detail !== undefined ? detail : "");
    failures++;
  }
}

async function main() {
  console.log("YouTube URL parser:");
  ok(
    "bare 11-char id",
    parseYouTubeId("dQw4w9WgXcQ") === "dQw4w9WgXcQ",
  );
  ok(
    "watch?v= URL",
    parseYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120") ===
      "dQw4w9WgXcQ",
  );
  ok(
    "youtu.be short URL",
    parseYouTubeId("https://youtu.be/dQw4w9WgXcQ?si=abc") === "dQw4w9WgXcQ",
  );
  ok(
    "embed URL",
    parseYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ") ===
      "dQw4w9WgXcQ",
  );
  ok(
    "shorts URL",
    parseYouTubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ") ===
      "dQw4w9WgXcQ",
  );
  ok(
    "live URL",
    parseYouTubeId("https://www.youtube.com/live/dQw4w9WgXcQ") ===
      "dQw4w9WgXcQ",
  );
  ok(
    "shape-valid 11-char string passes (server verifies via YT API)",
    parseYouTubeId("notayoutube") === "notayoutube",
  );
  ok(
    "too-short id returns null",
    parseYouTubeId("dQw4w9WgXc") === null,
  );
  ok(
    "too-long id returns null",
    parseYouTubeId("dQw4w9WgXcQQ") === null,
  );
  ok(
    "extra-chars URL returns null",
    parseYouTubeId("https://example.com/notayoutubelink") === null,
  );

  console.log("\nISO 8601 duration parser:");
  ok("PT45S", parseIsoDurationToSeconds("PT45S") === 45);
  ok("PT5M", parseIsoDurationToSeconds("PT5M") === 300);
  ok("PT1H2M3S", parseIsoDurationToSeconds("PT1H2M3S") === 3723);
  ok("PT2H", parseIsoDurationToSeconds("PT2H") === 7200);
  ok("PT0S", parseIsoDurationToSeconds("PT0S") === 0);
  ok("garbage returns null", parseIsoDurationToSeconds("xyz") === null);

  console.log("\nWatermark formatter:");
  ok(
    "happy path",
    formatWatermark("Aarav Sharma", "+91 98765 43210") === "Aarav • ••3210",
  );
  ok(
    "missing phone",
    formatWatermark("Priya", null) === "Priya • ••0000",
  );
  ok(
    "short phone",
    formatWatermark("Riya", "12") === "Riya • ••0000",
  );
  ok(
    "missing name",
    formatWatermark("", "9999999999") === "Student • ••9999",
  );

  console.log("\nPlayback HMAC roundtrip:");
  const secret = Array.from({ length: 32 }, () => "ab").join(""); // 32 bytes hex
  const payload: PlaybackPayload = {
    v: 1,
    kind: "lesson",
    video_id: "dQw4w9WgXcQ",
    watermark: "Aarav • ••3210",
    content_id: "00000000-0000-0000-0000-000000000001",
    session_id: null,
    uid: "00000000-0000-0000-0000-000000000002",
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const sig = await signPlayback(payload, secret);
  ok("sig non-empty", typeof sig === "string" && sig.length > 0);
  ok(
    "verify with correct secret matches",
    (await verifyPlayback(payload, sig, [secret])) === 0,
  );
  ok(
    "verify with wrong secret rejects",
    (await verifyPlayback(payload, sig, ["cd".repeat(32)])) === -1,
  );
  ok(
    "verify with secrets list matches at index 1",
    (await verifyPlayback(payload, sig, ["cd".repeat(32), secret])) === 1,
  );
  const env = encodePlaybackEnvelope({ payload, sig });
  const dec = decodePlaybackEnvelope(env);
  ok(
    "envelope roundtrip preserves payload",
    canonicalPlaybackString(dec.payload) === canonicalPlaybackString(payload),
  );

  console.log("");
  if (failures > 0) {
    console.error(`FAILED: ${failures} assertion(s)`);
    process.exit(1);
  } else {
    console.log("All content-helper tests passed.");
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
