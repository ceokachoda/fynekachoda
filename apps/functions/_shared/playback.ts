// Phase 5 — HMAC-SHA256 signing for wrapped YT playback payloads (D-042,
// D-045). Mirror of `_shared/hmac.ts` (QR) but with a richer payload shape
// and base64url-encoded JSON envelope (no QR-code size pressure here, so the
// envelope readability beats canonical-string compactness).

export interface PlaybackPayload {
  v: 1;
  kind: "lesson" | "live" | "recording";
  video_id: string;
  watermark: string;
  content_id: string | null;
  session_id: string | null;
  uid: string;
  exp: number;
}

export interface SignedPlaybackEnvelope {
  payload: PlaybackPayload;
  sig: string;
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("hex string has odd length");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = parseInt(hex.substr(i * 2, 2), 16);
    if (Number.isNaN(byte)) throw new Error("invalid hex");
    out[i] = byte;
  }
  return out;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(s: string): Uint8Array {
  const pad = (4 - (s.length % 4)) % 4;
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importHmacKey(secretHex: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    hexToBytes(secretHex),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export function canonicalPlaybackString(payload: PlaybackPayload): string {
  return [
    payload.v,
    payload.kind,
    payload.video_id,
    payload.watermark,
    payload.content_id ?? "",
    payload.session_id ?? "",
    payload.uid,
    payload.exp,
  ].join("|");
}

export async function signPlayback(
  payload: PlaybackPayload,
  secretHex: string,
): Promise<string> {
  const key = await importHmacKey(secretHex);
  const data = new TextEncoder().encode(canonicalPlaybackString(payload));
  const sig = await crypto.subtle.sign("HMAC", key, data);
  return bytesToBase64Url(new Uint8Array(sig));
}

export async function verifyPlayback(
  payload: PlaybackPayload,
  sig: string,
  secretsHex: readonly string[],
): Promise<number> {
  const data = new TextEncoder().encode(canonicalPlaybackString(payload));
  let sigBytes: Uint8Array;
  try {
    sigBytes = base64UrlToBytes(sig);
  } catch {
    return -1;
  }
  let matched = -1;
  for (let i = 0; i < secretsHex.length; i++) {
    const key = await importHmacKey(secretsHex[i]!);
    const ok = await crypto.subtle.verify("HMAC", key, sigBytes, data);
    if (ok && matched === -1) matched = i;
  }
  return matched;
}

export function encodePlaybackEnvelope(env: SignedPlaybackEnvelope): string {
  const json = JSON.stringify(env);
  return bytesToBase64Url(new TextEncoder().encode(json));
}

export function decodePlaybackEnvelope(
  encoded: string,
): SignedPlaybackEnvelope {
  const json = new TextDecoder().decode(base64UrlToBytes(encoded));
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("decoded envelope is not an object");
  }
  const p = parsed.payload;
  if (
    !p ||
    typeof p !== "object" ||
    p.v !== 1 ||
    typeof p.video_id !== "string" ||
    typeof p.watermark !== "string" ||
    typeof p.uid !== "string" ||
    typeof p.exp !== "number" ||
    typeof parsed.sig !== "string"
  ) {
    throw new Error("decoded envelope failed shape check");
  }
  return parsed as SignedPlaybackEnvelope;
}
