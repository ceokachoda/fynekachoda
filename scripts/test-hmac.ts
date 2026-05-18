// scripts/test-hmac.ts
//
// Phase 4 CP3 — unit tests for apps/functions/_shared/hmac.ts.
//
// Runs in Node via tsx. The hmac.ts module is pure Web Crypto + string ops,
// so it works identically here and inside Deno edge functions. No Supabase
// or network calls — these are pure-crypto round-trip tests.
//
//   pnpm test:hmac

import {
  canonicalString,
  decodeQrToken,
  encodeQrToken,
  generateJti,
  signQrPayload,
  verifyQrPayload,
  type QrPayload,
} from "../apps/functions/_shared/hmac.ts";

const SECRET_V1 =
  "a27afc600c076a77fa62e672f4dc9bf43527e75007477ec39795ec8880e00ccc";
const SECRET_V2 =
  "1b3d5f7088aabbccddeeff112233445566778899aabbccddeeff001122334455";
const SECRET_BAD =
  "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";

function pass(msg: string): void {
  console.log(`  PASS  ${msg}`);
}

function fail(msg: string): never {
  console.error(`  FAIL  ${msg}`);
  process.exit(1);
}

function assertEq<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function header(name: string): void {
  console.log(`\n=== ${name} ===`);
}

function samplePayload(overrides: Partial<QrPayload> = {}): QrPayload {
  return {
    v: 1,
    sid: "11111111-1111-1111-1111-111111111111",
    uid: "22222222-2222-2222-2222-222222222222",
    exp: 1715693400,
    jti: "abc123def456",
    ...overrides,
  };
}

async function main(): Promise<void> {
  header("Test 1 — canonical string is deterministic + pipe-delimited");
  const cs = canonicalString(samplePayload());
  assertEq(
    cs,
    "1|11111111-1111-1111-1111-111111111111|22222222-2222-2222-2222-222222222222|1715693400|abc123def456",
    "canonicalString output",
  );
  pass("canonicalString shape locked");

  header("Test 2 — sign/verify round-trip succeeds under V1");
  const sig = await signQrPayload(samplePayload(), SECRET_V1);
  if (sig.length < 20) fail(`sig suspiciously short: ${sig.length}`);
  if (/[+/=]/.test(sig)) fail(`sig contains non-base64url chars: ${sig}`);
  const idx = await verifyQrPayload(samplePayload(), sig, [SECRET_V1]);
  assertEq(idx, 0, "verify returns matched secret index 0");
  pass(`sig=${sig.slice(0, 12)}…  matched at index 0`);

  header("Test 3 — tampered payload (different sid) fails verify");
  const tamperedSid = await verifyQrPayload(
    samplePayload({ sid: "33333333-3333-3333-3333-333333333333" }),
    sig,
    [SECRET_V1],
  );
  assertEq(tamperedSid, -1, "tampered sid index");
  pass("tampered sid rejected");

  header("Test 4 — tampered payload (different exp) fails verify");
  const tamperedExp = await verifyQrPayload(
    samplePayload({ exp: 99999999 }),
    sig,
    [SECRET_V1],
  );
  assertEq(tamperedExp, -1, "tampered exp index");
  pass("tampered exp rejected");

  header("Test 5 — tampered signature (one char flipped) fails verify");
  const tamperedSig =
    sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A");
  const sigBad = await verifyQrPayload(samplePayload(), tamperedSig, [SECRET_V1]);
  assertEq(sigBad, -1, "tampered sig index");
  pass("tampered sig rejected");

  header("Test 6 — wrong secret fails verify");
  const wrongSecret = await verifyQrPayload(samplePayload(), sig, [SECRET_BAD]);
  assertEq(wrongSecret, -1, "wrong-secret index");
  pass("wrong secret rejected");

  header("Test 7 — malformed signature returns -1, does not throw");
  const malformed = await verifyQrPayload(samplePayload(), "!!!not-base64!!!", [
    SECRET_V1,
  ]);
  assertEq(malformed, -1, "malformed sig index");
  pass("malformed sig safely rejected");

  header("Test 8 — V2 grace window: token signed under V2 verifies when [V1,V2]");
  const sigV2 = await signQrPayload(samplePayload(), SECRET_V2);
  const matchedV2 = await verifyQrPayload(samplePayload(), sigV2, [
    SECRET_V1,
    SECRET_V2,
  ]);
  assertEq(matchedV2, 1, "V2 match index");
  pass("V2-signed token matched at index 1");

  header("Test 9 — V2 grace window: token signed under V1 still verifies");
  const matchedV1 = await verifyQrPayload(samplePayload(), sig, [
    SECRET_V1,
    SECRET_V2,
  ]);
  assertEq(matchedV1, 0, "V1 match during rotation index");
  pass("V1-signed token still matched at index 0 during rotation");

  header("Test 10 — encode / decode round-trip preserves payload + sig");
  const token = { payload: samplePayload(), sig };
  const encoded = encodeQrToken(token);
  if (/[+/=]/.test(encoded)) fail(`encoded contains non-base64url chars: ${encoded}`);
  const decoded = decodeQrToken(encoded);
  assertEq(JSON.stringify(decoded.payload), JSON.stringify(token.payload), "decoded payload");
  assertEq(decoded.sig, token.sig, "decoded sig");
  pass(`round-trip succeeded; encoded length=${encoded.length} chars`);

  header("Test 11 — decode rejects garbage");
  let threw = false;
  try {
    decodeQrToken("@@@notbase64@@@");
  } catch {
    threw = true;
  }
  if (!threw) fail("decode of garbage didn't throw");
  pass("garbage-input rejected");

  header("Test 12 — decode rejects wrong-shape JSON");
  // Encode a valid-looking but wrong-shape object.
  const wrong = encodeQrToken({
    // @ts-expect-error intentional bad shape for shape-check coverage
    payload: { v: 1, sid: "x", uid: "y" },
    sig: "zzz",
  });
  let threw2 = false;
  try {
    decodeQrToken(wrong);
  } catch {
    threw2 = true;
  }
  if (!threw2) fail("decode of wrong-shape didn't throw");
  pass("wrong-shape payload rejected");

  header("Test 13 — JTI generator produces distinct tokens of expected length");
  const jtis = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const j = generateJti();
    if (j.length !== 12) fail(`JTI wrong length: ${j} (${j.length})`);
    if (!/^[abcdefghjkmnpqrstuvwxyz23456789]+$/.test(j)) {
      fail(`JTI contains unexpected chars: ${j}`);
    }
    jtis.add(j);
  }
  if (jtis.size < 99) fail(`JTI generator collided ${100 - jtis.size} times in 100 samples`);
  pass(`100 distinct JTIs generated`);

  console.log(`\nALL 13 HMAC TESTS PASSED.`);
}

main().catch((err) => {
  fail(err instanceof Error ? (err.stack ?? err.message) : String(err));
});
