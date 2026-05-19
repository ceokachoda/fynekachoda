// Phase 4 CP3 — Deno-only wrapper that reads named secrets from Supabase
// Vault via the `public.get_qr_secret(name text)` SECURITY DEFINER RPC.
//
// The RPC has EXECUTE locked to `service_role` only (migration
// 20260515160529_qr_secret_accessor.sql), so this module MUST be called with
// the service-role client returned by `getServiceRoleClient()`. Anon/auth
// callers receive a 403 if they try to invoke the RPC.
//
// Memoization: the secret is cached for the lifetime of the edge-fn instance
// (Supabase recycles instances every few minutes — that's effectively the
// cache TTL). On rotation we deploy a new edge-fn revision; the new instance
// picks up the new value. No manual invalidation needed.

import { getServiceRoleClient } from "./supabase.ts";

const cache = new Map<string, string | null>();

export class VaultError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export async function getVaultSecret(name: string): Promise<string | null> {
  if (cache.has(name)) return cache.get(name)!;
  const admin = getServiceRoleClient();
  // Try the generic accessor first (Phase 5+); fall back to the legacy
  // qr-specific one which has identical body but was deployed earlier.
  let { data, error } = await admin.rpc("get_vault_secret", { name });
  if (error) {
    const fallback = await admin.rpc("get_qr_secret", { name });
    if (fallback.error) {
      throw new VaultError(
        `vault lookup '${name}' failed: ${fallback.error.message}`,
      );
    }
    data = fallback.data;
  }
  const value = (data as string | null) ?? null;
  cache.set(name, value);
  return value;
}

// Returns [v1, v2?] in rotation order — v1 is required, v2 is optional. Use
// `signQrPayload(payload, v1)` for new signatures and `verifyQrPayload(..,
// [v1, v2].filter(Boolean))` to accept tokens signed under either secret
// during the 24h grace window (D-104).
export async function getQrSecrets(): Promise<string[]> {
  const v1 = await getVaultSecret("QR_TOKEN_SECRET_V1");
  if (!v1) {
    throw new VaultError(
      "QR_TOKEN_SECRET_V1 is not present in vault — sign/verify will fail",
    );
  }
  const v2 = await getVaultSecret("QR_TOKEN_SECRET_V2");
  return v2 ? [v1, v2] : [v1];
}

// Phase 5 — same V1/V2 rotation pattern as QR secrets, but for
// `yt-playback-sign` HMAC. V1 is required; V2 optional during rotation.
export async function getPlaybackSecrets(): Promise<string[]> {
  const v1 = await getVaultSecret("PLAYBACK_SIGN_SECRET_V1");
  if (!v1) {
    throw new VaultError(
      "PLAYBACK_SIGN_SECRET_V1 is not present in vault — playback sign will fail",
    );
  }
  const v2 = await getVaultSecret("PLAYBACK_SIGN_SECRET_V2");
  return v2 ? [v1, v2] : [v1];
}

// Test hook: edge-fn unit smoke can call this between tests to force a fresh
// vault read. Not used in production code paths.
export function _resetVaultCacheForTests(): void {
  cache.clear();
}
