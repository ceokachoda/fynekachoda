import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import { AuthError, loadCaller } from "../_shared/auth.ts";
import { clientIp, writeAudit } from "../_shared/audit.ts";
import { generateRecoveryBatch, hashRecoveryCode } from "../_shared/recovery-codes.ts";

// Issue a fresh batch of 10 recovery codes for the caller. Replaces any
// existing batch — old codes become invalid the moment new ones are issued.
// Called by the admin /2fa/enroll flow immediately after TOTP verification
// succeeds. Plaintext is returned ONCE in the response and never stored.

const BATCH_SIZE = 10;

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const origin = req.headers.get("Origin");

  if (req.method !== "POST") return jsonError(405, "method not allowed", origin);

  try {
    const caller = await loadCaller(req);
    const admin = getServiceRoleClient();

    const { error: delErr } = await admin
      .from("mfa_recovery_codes")
      .delete()
      .eq("user_id", caller.app_user_id);
    if (delErr) {
      return jsonError(500, "clear existing codes failed", origin, delErr.message);
    }

    const codes = generateRecoveryBatch(BATCH_SIZE);
    const rows = await Promise.all(
      codes.map(async (c) => ({
        user_id: caller.app_user_id,
        code_hash: await hashRecoveryCode(c),
      })),
    );
    const { error: insErr } = await admin.from("mfa_recovery_codes").insert(rows);
    if (insErr) {
      return jsonError(500, "insert codes failed", origin, insErr.message);
    }

    await writeAudit(admin, {
      actor_user_id: caller.app_user_id,
      actor_role: caller.roles[0] ?? null,
      action: "mfa_codes_issued",
      entity_table: "mfa_recovery_codes",
      entity_id: caller.app_user_id,
      before_data: null,
      after_data: { count: codes.length },
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent"),
    });

    return json(200, { codes, count: codes.length }, origin);
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("mfa-codes-issue error:", err);
    return jsonError(500, "internal error", origin);
  }
});
