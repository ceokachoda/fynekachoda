// Phase 5 — client-side mirror of the edge fn formatter.
// Server is authoritative — `yt-playback-sign` issues the watermark text in
// the payload. This file just exists for the PDF reader, which doesn't have
// a server-issued watermark token and falls back to formatting locally from
// `app_users.full_name` + `app_users.phone`.

export function formatWatermark(
  fullName: string | null | undefined,
  phone: string | null | undefined,
): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0] || "Student";
  const digits = (phone ?? "").replace(/\D/g, "");
  const last4 = digits.length >= 4 ? digits.slice(-4) : "0000";
  return `${first} • ••${last4}`;
}
