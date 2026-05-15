// Shared crypto + formatting helpers for TOTP recovery codes. Used by
// mfa-codes-issue and mfa-codes-consume edge functions, and (indirectly via
// hashing parity) by scripts/smoke-test-mfa-recovery.ts when it verifies
// idempotent consume behaviour.
//
// Codes are 10 chars from a 31-char ambiguity-stripped alphabet (no 0/1/i/l/o)
// rendered as XXXXX-XXXXX for readability. ~50 bits of entropy per code.
// Stored only as SHA-256 hex hashes; plaintext is shown to the user once.

const ALPHA = "abcdefghjkmnpqrstuvwxyz23456789";
const CODE_LENGTH = 10;
const BATCH_SIZE = 10;

export function generateRecoveryCode(): string {
  const buf = new Uint32Array(CODE_LENGTH);
  crypto.getRandomValues(buf);
  let raw = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    raw += ALPHA[buf[i]! % ALPHA.length]!;
  }
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

export function generateRecoveryBatch(count: number = BATCH_SIZE): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(generateRecoveryCode());
  return out;
}

// Strip whitespace and hyphens, lowercase, so "ABCDE-FGHJK", "abcde fghjk",
// and "abcdefghjk" all hash identically.
export function normalizeRecoveryCode(input: string): string {
  return input.replace(/[\s\-_]/g, "").toLowerCase();
}

export async function hashRecoveryCode(plaintext: string): Promise<string> {
  const data = new TextEncoder().encode(normalizeRecoveryCode(plaintext));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
