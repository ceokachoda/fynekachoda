// Watermark text format — server returns watermark text inside the signed
// envelope for live/recording playback; for student-side library video + PDF
// we build the watermark client-side from the appUser identity.
//
// Format: "FirstName • ••LAST4DIGITS" (e.g., "Kaustab • ••0044"). Phone is
// optional — defaults to "0000" if missing.

export function formatWatermark(
  fullName: string | null | undefined,
  phone: string | null | undefined,
): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0] || "Student";
  const digits = (phone ?? "").replace(/\D/g, "");
  const last4 = digits.length >= 4 ? digits.slice(-4) : "0000";
  return `${first} • ••${last4}`;
}
