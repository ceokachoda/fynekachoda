import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import { AuthError, loadCaller } from "../_shared/auth.ts";
import { clientIp, writeAudit } from "../_shared/audit.ts";
import { hashRecoveryCode } from "../_shared/recovery-codes.ts";
import { ConsumeRecoveryCodeInputSchema } from "../_shared/schemas.ts";

// Consume one recovery code. On success, deletes all TOTP factors on the
// caller's auth.users row — middleware then routes them to /2fa/enroll where
// they re-enroll and receive a fresh batch. Recovery codes are an emergency
// exit, not a daily AAL alternative: Supabase's MFA API has no way to upgrade
// AAL from a non-TOTP secret, so re-enrolment is the only correct path.
//
// Caller is expected to hold an AAL1 session (signed in via password but not
// yet TOTP-verified). loadCaller doesn't enforce AAL; it just verifies the
// JWT. That's fine — consuming a code while already at AAL2 is a no-op-ish
// re-enroll trigger and we don't need to gate against it.

interface AdminUserShape {
  factors?: { id: string; factor_type?: string; status?: string }[];
}

async function deleteUserTotpFactors(authUserId: string): Promise<number> {
  const supaUrl = Deno.env.get("SUPABASE_URL");
  const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supaUrl || !srk) throw new Error("missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");

  const userRes = await fetch(`${supaUrl}/auth/v1/admin/users/${authUserId}`, {
    headers: { Authorization: `Bearer ${srk}`, apikey: srk },
  });
  if (!userRes.ok) {
    throw new Error(`admin/users fetch failed: ${userRes.status}`);
  }
  const body = (await userRes.json()) as AdminUserShape;
  const factors = Array.isArray(body.factors) ? body.factors : [];

  let deleted = 0;
  for (const f of factors) {
    if (f.factor_type !== "totp") continue;
    const delRes = await fetch(
      `${supaUrl}/auth/v1/admin/users/${authUserId}/factors/${f.id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${srk}`, apikey: srk },
      },
    );
    if (delRes.ok) deleted += 1;
  }
  return deleted;
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const origin = req.headers.get("Origin");

  if (req.method !== "POST") return jsonError(405, "method not allowed", origin);

  try {
    const caller = await loadCaller(req);

    const rawBody = await req.json().catch(() => null);
    if (rawBody === null) return jsonError(400, "invalid JSON body", origin);
    const parsed = ConsumeRecoveryCodeInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }

    const codeHash = await hashRecoveryCode(parsed.data.code);

    const admin = getServiceRoleClient();
    const { data: match, error: lookupErr } = await admin
      .from("mfa_recovery_codes")
      .select("id, used_at")
      .eq("user_id", caller.app_user_id)
      .eq("code_hash", codeHash)
      .maybeSingle();
    if (lookupErr) {
      return jsonError(500, "lookup failed", origin, lookupErr.message);
    }
    if (!match) {
      return jsonError(401, "invalid recovery code", origin);
    }
    if (match.used_at) {
      return jsonError(401, "recovery code already used", origin);
    }

    const { error: updErr } = await admin
      .from("mfa_recovery_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("id", match.id);
    if (updErr) {
      return jsonError(500, "consume failed", origin, updErr.message);
    }

    let factorsDeleted = 0;
    try {
      factorsDeleted = await deleteUserTotpFactors(caller.auth_user_id);
    } catch (err) {
      console.error("deleteUserTotpFactors:", err);
      // Don't rollback the consume — the recovery code is one-use even if
      // factor cleanup partially fails. The admin "Reset MFA" path can
      // recover from a stuck factor.
    }

    await writeAudit(admin, {
      actor_user_id: caller.app_user_id,
      actor_role: caller.roles[0] ?? null,
      action: "mfa_codes_consumed",
      entity_table: "mfa_recovery_codes",
      entity_id: match.id,
      before_data: { used_at: null },
      after_data: { used_at: new Date().toISOString(), factors_deleted: factorsDeleted },
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent"),
    });

    return json(
      200,
      {
        consumed: true,
        factors_deleted: factorsDeleted,
      },
      origin,
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("mfa-codes-consume error:", err);
    return jsonError(500, "internal error", origin);
  }
});
