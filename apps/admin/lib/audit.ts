// Audit log facade.
//
// Per CLAUDE.md: every privileged write goes through an edge function, which
// writes its own audit_log row using service-role. So in Phase 2 the
// admin web panel never writes to audit_log directly — it only READS the
// log to render the per-entity Audit tab. That read uses the admin's
// authenticated Supabase client; RLS policy `audit_log_admin_read`
// (defined in migration 20260514223314_audit_log.sql) permits it.
//
// `withAudit` is documented in the Phase 2 spec as a wrapper for direct
// admin mutations, but Phase 2 has no such mutations — everything flows
// through edge fns. When a future phase introduces a server-side mutation
// that bypasses an edge fn (e.g., quick metadata edits), implement it
// here by routing the audit insert through a new `generic-audit-write`
// edge fn rather than service-roling from this process.

import { createSupabaseServerClient } from "./supabase-server";

export interface AuditEntry {
  id: string;
  actor_user_id: string | null;
  actor_role: string | null;
  action: string;
  entity_table: string;
  entity_id: string | null;
  before_data: unknown;
  after_data: unknown;
  ip_address: string | null;
  user_agent: string | null;
  occurred_at: string;
}

export async function listAuditForEntity(
  entityTable: string,
  entityId: string,
  limit = 100,
): Promise<AuditEntry[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select(
      "id, actor_user_id, actor_role, action, entity_table, entity_id, before_data, after_data, ip_address, user_agent, occurred_at",
    )
    .eq("entity_table", entityTable)
    .eq("entity_id", entityId)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error(`listAuditForEntity failed:`, error.message);
    return [];
  }
  return (data ?? []) as AuditEntry[];
}
