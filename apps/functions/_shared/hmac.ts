// Phase 4 CP3 — pure crypto helpers for QR attendance tokens.
//
// D-030: rotating QR, 30-second HMAC-SHA256-signed token.
// D-031: replay-impossible — server enforces (session_id, student_id) unique.
// D-104: HMAC secrets rotated quarterly with 24h grace; `verifyQrPayload`
//        accepts a list of secrets so V1 + V2 can coexist during the grace.
//
// Canonical signing string: `v|sid|uid|exp|jti` — pipe-delimited, no JSON in
// the signed payload itself, so a teacher's scanner can deterministically
// rebuild the string before HMAC-checking. `v` is a small int; bumping it
// invalidates old tokens and lets us evolve the layout without ambiguity.
//
// Everything in this file is **pure** Web Crypto + standard string ops —
// runs identically under Deno (edge fn) and Node (unit tests via tsx).
// No `Deno.env`, no `crypto.randomBytes`, no Node-only imports.

export interface QrPayload {
  v: 1;
  sid: string;
  uid: string;
  exp: number;
  jti: string;
}

export interface SignedQrToken {
  payload: QrPayload;
  sig: string;
}

const JTI_ALPHA = "abcdefghjkmnpqrstuvwxyz23456789";
const JTI_LENGTH = 12;

export function generateJti(): string {
  const buf = new Uint32Array(JTI_LENGTH);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < JTI_LENGTH; i++) {
    out += JTI_ALPHA[buf[i]! % JTI_ALPHA.length]!;
  }
  return out;
}

export function canonicalString(payload: QrPayload): string {
  return `${payload.v}|${payload.sid}|${payload.uid}|${payload.exp}|${payload.jti}`;
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("hex string has odd length");
  }
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

export async function signQrPayload(
  payload: QrPayload,
  secretHex: string,
): Promise<string> {
  const key = await importHmacKey(secretHex);
  const data = new TextEncoder().encode(canonicalString(payload));
  const sig = await crypto.subtle.sign("HMAC", key, data);
  return bytesToBase64Url(new Uint8Array(sig));
}

// Returns the index of the secret that produced a matching signature, or -1
// if none matched. Constant-time across the secret list (no early exit on
// mismatch — important during V1/V2 rotation).
export async function verifyQrPayload(
  payload: QrPayload,
  sig: string,
  secretsHex: readonly string[],
): Promise<number> {
  const data = new TextEncoder().encode(canonicalString(payload));
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

// Encode a signed token for QR display: compact base64url(JSON). Total length
// is around 200 chars, well within QR code capacity. Safer than embedding raw
// JSON because a QR scanner won't accidentally parse pipes/commas.
export function encodeQrToken(token: SignedQrToken): string {
  const json = JSON.stringify(token);
  const bytes = new TextEncoder().encode(json);
  return bytesToBase64Url(bytes);
}

export function decodeQrToken(encoded: string): SignedQrToken {
  const bytes = base64UrlToBytes(encoded);
  const json = new TextDecoder().decode(bytes);
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("decoded token is not an object");
  }
  const p = parsed.payload;
  if (
    !p ||
    typeof p !== "object" ||
    p.v !== 1 ||
    typeof p.sid !== "string" ||
    typeof p.uid !== "string" ||
    typeof p.exp !== "number" ||
    typeof p.jti !== "string" ||
    typeof parsed.sig !== "string"
  ) {
    throw new Error("decoded token failed shape check");
  }
  return parsed as SignedQrToken;
}
