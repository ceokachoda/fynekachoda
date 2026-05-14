import type { SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";

export interface AuditMeta {
  actor_user_id?: string | null;
  actor_role?: string | null;
  action: string;
  entity_table: string;
  entity_id?: string | null;
  before_data?: unknown;
  after_data?: unknown;
  ip_address?: string | null;
  user_agent?: string | null;
}

// Best-effort audit log insert. Failures are logged but do not abort the
// parent mutation — orphaned mutations are easier to reconcile than
// fail-after-mutation rollbacks. Phase 12 may introduce a stored procedure
// to make audit + mutation transactional.
export async function writeAudit(
  admin: SupabaseClient,
  meta: AuditMeta,
): Promise<void> {
  const { error } = await admin.from("audit_log").insert({
    actor_user_id: meta.actor_user_id ?? null,
    actor_role: meta.actor_role ?? null,
    action: meta.action,
    entity_table: meta.entity_table,
    entity_id: meta.entity_id ?? null,
    before_data: meta.before_data ?? null,
    after_data: meta.after_data ?? null,
    ip_address: meta.ip_address ?? null,
    user_agent: meta.user_agent ?? null,
  });
  if (error) {
    console.error(
      `audit_log insert failed for action=${meta.action}:`,
      error.message,
    );
  }
}

export function clientIp(req: Request): string | null {
  // Supabase Edge proxy puts the original client IP in x-forwarded-for.
  const xff = req.headers.get("x-forwarded-for");
  if (!xff) return null;
  // The first hop is the actual client; subsequent hops are proxies.
  const first = xff.split(",")[0]?.trim();
  return first && first.length > 0 ? first : null;
}
