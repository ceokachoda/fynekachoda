// Phase 5 — server-issued watermark formatter (D-045).
//
// Output: `{first_name} • ••{phone_last_4}`. If phone is missing/short we
// fall back to `••0000` so the watermark is always exactly the same shape.
// First name = first whitespace-delimited token of full_name; empty
// full_name falls back to "Student".

export function formatWatermark(
  fullName: string | null | undefined,
  phone: string | null | undefined,
): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0] || "Student";
  const digits = (phone ?? "").replace(/\D/g, "");
  const last4 = digits.length >= 4 ? digits.slice(-4) : "0000";
  return `${first} • ••${last4}`;
}
