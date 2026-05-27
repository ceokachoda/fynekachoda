// scripts/test-live-helpers.ts
//
// Phase 9 — pure-TS unit tests for the live-class helpers. No Supabase / network.
// Exercises the REAL modules (same code the edge fns + mobile run):
//   - apps/functions/_shared/playback.ts  (HMAC sign/verify + envelope)
//   - apps/functions/_shared/youtube.ts    (ISO-8601 duration + id parser)
//   - apps/mobile/features/live/chat-replay.ts (replay offset math)
//
//   pnpm test:live

import {
  canonicalPlaybackString,
  decodePlaybackEnvelope,
  encodePlaybackEnvelope,
  type PlaybackPayload,
  signPlayback,
  verifyPlayback,
} from "../apps/functions/_shared/playback.ts";
import {
  parseIsoDurationToSeconds,
  parseYouTubeId,
} from "../apps/functions/_shared/youtube.ts";
import {
  computeReplayOffsetSec,
  countBetween,
  messagesUpTo,
  withReplayOffsets,
} from "../apps/mobile/features/live/chat-replay.ts";

const SECRET_V1 = "a27afc600c076a77fa62e672f4dc9bf43527e75007477ec39795ec8880e00ccc";
const SECRET_V2 = "1b3d5f7088aabbccddeeff112233445566778899aabbccddeeff001122334455";
const SECRET_BAD = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";

let passed = 0;
function pass(msg: string): void {
  passed++;
  console.log(`  PASS  ${msg}`);
}
function fail(msg: string): never {
  console.error(`  FAIL  ${msg}`);
  process.exit(1);
}
function assertEq<T>(actual: T, expected: T, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
function header(name: string): void {
  console.log(`\n=== ${name} ===`);
}

function livePayload(overrides: Partial<PlaybackPayload> = {}): PlaybackPayload {
  return {
    v: 1,
    kind: "live",
    video_id: "dQw4w9WgXcQ",
    watermark: "Rahul • ••4321",
    content_id: null,
    session_id: "55555555-5555-5555-5555-555555555555",
    uid: "22222222-2222-2222-2222-222222222222",
    exp: 1715693400,
    ...overrides,
  };
}

async function main(): Promise<void> {
  header("Playback HMAC — canonical string shape locked");
  assertEq(
    canonicalPlaybackString(livePayload()),
    "1|live|dQw4w9WgXcQ|Rahul • ••4321||55555555-5555-5555-5555-555555555555|22222222-2222-2222-2222-222222222222|1715693400",
    "canonicalPlaybackString",
  );
  pass("canonical string deterministic + pipe-delimited (content_id empty)");

  header("Playback HMAC — sign/verify round-trip (live + recording + lesson)");
  for (const kind of ["live", "recording", "lesson"] as const) {
    const p = livePayload({ kind, content_id: kind === "lesson" ? "99999999-9999-9999-9999-999999999999" : null });
    const sig = await signPlayback(p, SECRET_V1);
    if (/[+/=]/.test(sig)) fail(`sig has non-base64url chars: ${sig}`);
    const idx = await verifyPlayback(p, sig, [SECRET_V1]);
    assertEq(idx, 0, `verify ${kind} index`);
  }
  pass("live + recording + lesson payloads sign and verify");

  header("Playback HMAC — tamper detection");
  const base = livePayload();
  const baseSig = await signPlayback(base, SECRET_V1);
  assertEq(await verifyPlayback(livePayload({ video_id: "EVILvideoID0" }), baseSig, [SECRET_V1]), -1, "tampered video_id");
  assertEq(await verifyPlayback(livePayload({ watermark: "Hacker • ••0000" }), baseSig, [SECRET_V1]), -1, "tampered watermark");
  assertEq(await verifyPlayback(livePayload({ exp: 9999999999 }), baseSig, [SECRET_V1]), -1, "tampered exp");
  assertEq(await verifyPlayback(base, baseSig, [SECRET_BAD]), -1, "wrong secret");
  assertEq(await verifyPlayback(base, "!!!not-base64!!!", [SECRET_V1]), -1, "malformed sig safe");
  pass("tampered video_id / watermark / exp, wrong secret, malformed sig all rejected");

  header("Playback HMAC — V2 rotation grace window");
  const sigV2 = await signPlayback(base, SECRET_V2);
  assertEq(await verifyPlayback(base, sigV2, [SECRET_V1, SECRET_V2]), 1, "V2 match index");
  assertEq(await verifyPlayback(base, baseSig, [SECRET_V1, SECRET_V2]), 0, "V1 still matches during rotation");
  pass("V2-signed token matches at index 1; V1 still valid at 0");

  header("Playback HMAC — envelope encode/decode round-trip");
  const env = { payload: base, sig: baseSig };
  const encoded = encodePlaybackEnvelope(env);
  if (/[+/=]/.test(encoded)) fail(`encoded has non-base64url chars`);
  const decoded = decodePlaybackEnvelope(encoded);
  assertEq(JSON.stringify(decoded.payload), JSON.stringify(base), "decoded payload");
  assertEq(decoded.sig, baseSig, "decoded sig");
  pass(`envelope round-trips (len=${encoded.length})`);

  header("YouTube — ISO-8601 duration parser");
  assertEq(parseIsoDurationToSeconds("PT1H2M3S"), 3723, "PT1H2M3S");
  assertEq(parseIsoDurationToSeconds("PT45S"), 45, "PT45S");
  assertEq(parseIsoDurationToSeconds("PT5M"), 300, "PT5M");
  assertEq(parseIsoDurationToSeconds("PT0S"), 0, "PT0S");
  assertEq(parseIsoDurationToSeconds("PT2H"), 7200, "PT2H");
  assertEq(parseIsoDurationToSeconds("garbage"), null, "garbage -> null");
  pass("PT#H#M#S parsed; garbage -> null");

  header("YouTube — id / url parser");
  assertEq(parseYouTubeId("dQw4w9WgXcQ"), "dQw4w9WgXcQ", "bare id");
  assertEq(parseYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10"), "dQw4w9WgXcQ", "watch url");
  assertEq(parseYouTubeId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ", "short url");
  assertEq(parseYouTubeId("https://www.youtube.com/live/dQw4w9WgXcQ"), "dQw4w9WgXcQ", "live url");
  assertEq(parseYouTubeId("not a video"), null, "garbage -> null");
  pass("bare id + watch/short/live urls parsed; garbage -> null");

  header("Chat replay — offset math");
  const started = "2026-05-22T10:00:00.000Z";
  assertEq(computeReplayOffsetSec("2026-05-22T10:01:30.000Z", started), 90, "90s after start");
  assertEq(computeReplayOffsetSec("2026-05-22T10:00:00.000Z", started), 0, "at start -> 0");
  assertEq(computeReplayOffsetSec("2026-05-22T09:59:30.000Z", started), 0, "before start clamps to 0");
  pass("offset = posted - started, clamped >= 0");

  header("Chat replay — withReplayOffsets sorts + messagesUpTo filters");
  const msgs = [
    { id: "c", posted_at: "2026-05-22T10:02:00.000Z" }, // 120
    { id: "a", posted_at: "2026-05-22T10:00:30.000Z" }, // 30
    { id: "b", posted_at: "2026-05-22T10:01:00.000Z" }, // 60
  ];
  const withOff = withReplayOffsets(msgs, started);
  assertEq(withOff.map((m) => m.id), ["a", "b", "c"], "sorted by offset");
  assertEq(withOff.map((m) => m.offsetSec), [30, 60, 120], "offsets attached");
  assertEq(messagesUpTo(withOff, 60).map((m) => m.id), ["a", "b"], "visible up to 60s");
  assertEq(messagesUpTo(withOff, 0).map((m) => m.id), [], "nothing at t=0");
  assertEq(messagesUpTo(withOff, 999).map((m) => m.id), ["a", "b", "c"], "all eventually");
  assertEq(countBetween(withOff, 30, 120), 2, "2 new between 30s and 120s");
  pass("replay reveal order + windowing correct");

  console.log(`\nALL ${passed} LIVE-HELPER TEST GROUPS PASSED.`);
}

main().catch((err) => {
  fail(err instanceof Error ? (err.stack ?? err.message) : String(err));
});
