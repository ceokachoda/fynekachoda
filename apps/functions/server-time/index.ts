// Phase 7 CP3 — `server-time` edge fn.
//
// Returns the server's wall-clock time. Public (no JWT required) — the
// payload contains no secrets, only `now` + `epoch_ms`. Used by the mobile
// student exam attempt screen to compute its clock offset
// (`server_now - device_now`) once at attempt entry and again every 60s.
// The display countdown then renders `deadline_at - (now + offset)`.
//
// Why public: this is called BEFORE the user has a session in some flows
// (e.g., pre-login warmup), and it's cheap. The downside (anyone can
// fetch the server's clock) is negligible.
//
// Honors CORS (admin + Expo dev). Returns 200 on GET or POST.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";

Deno.serve((req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const origin = req.headers.get("Origin");

  if (req.method !== "GET" && req.method !== "POST") {
    return jsonError(405, "method not allowed", origin);
  }

  const now = new Date();
  return json(
    200,
    {
      now: now.toISOString(),
      epoch_ms: now.getTime(),
    },
    origin,
  );
});
