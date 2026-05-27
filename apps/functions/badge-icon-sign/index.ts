import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import { AuthError, loadCaller } from "../_shared/auth.ts";

// Phase 10 CP7 — short-lived signed URLs for badge icons (private badge-assets bucket).
//
// The badge catalogue is public-read, so ANY authenticated user gets a { code: url }
// map for all badges, valid 24h (cacheable client-side). The storage deny-all baseline
// blocks direct client signing (D-171 pattern), so this runs as service role. Icons are
// NEVER served from a public URL.

const SIGN_TTL_SECONDS = 86_400;

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const origin = req.headers.get("Origin");

  if (req.method !== "POST") {
    return jsonError(405, "method not allowed", origin);
  }

  try {
    // Any active, authenticated user may fetch icon URLs (catalogue is public-read).
    await loadCaller(req);

    const admin = getServiceRoleClient();
    const { data: badges, error: badgesErr } = await admin
      .from("badges")
      .select("code, icon_path")
      .order("sort_order");
    if (badgesErr) {
      return jsonError(500, "badge lookup failed", origin, badgesErr.message);
    }

    const paths = (badges ?? []).map((b) => b.icon_path as string);
    const { data: signed, error: signErr } = await admin.storage
      .from("badge-assets")
      .createSignedUrls(paths, SIGN_TTL_SECONDS);
    if (signErr) {
      return jsonError(500, "sign failed", origin, signErr.message);
    }

    const icons: Record<string, string | null> = {};
    (badges ?? []).forEach((b, i) => {
      icons[b.code as string] = signed?.[i]?.signedUrl ?? null;
    });

    return json(200, { icons, expires_in: SIGN_TTL_SECONDS }, origin);
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("badge-icon-sign error:", err);
    return jsonError(500, "internal error", origin);
  }
});
