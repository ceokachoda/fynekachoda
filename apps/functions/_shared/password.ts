// Generates a 14-char temporary password: 10 mixed-case letters + 2 digits + 2 specials.
// Digits exclude 0 and 1 to reduce visual confusion with O / l.
// Uses Web Crypto for cryptographic randomness; biased modulus across a 32-bit
// range is acceptable because the alphabets are small enough that the bias is
// far below any password strength threshold we care about.

const ALPHA = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SPECIALS = "!@#$%&*-_+=";

function pickFrom(src: string): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return src[buf[0]! % src.length]!;
}

function shuffleInPlace(arr: string[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const j = buf[0]! % (i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

export function generateTempPassword(): string {
  const chars: string[] = [];
  for (let i = 0; i < 10; i++) chars.push(pickFrom(ALPHA));
  for (let i = 0; i < 2; i++) chars.push(pickFrom(DIGITS));
  for (let i = 0; i < 2; i++) chars.push(pickFrom(SPECIALS));
  shuffleInPlace(chars);
  return chars.join("");
}
