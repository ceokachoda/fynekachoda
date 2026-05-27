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

const AUDIT_COLUMNS =
  "id, actor_user_id, actor_role, action, entity_table, entity_id, before_data, after_data, ip_address, user_agent, occurred_at";

export async function listAuditForEntity(
  entityTable: string,
  entityId: string,
  limit = 100,
): Promise<AuditEntry[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select(AUDIT_COLUMNS)
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

export async function listRecentAudit(limit = 10): Promise<AuditEntry[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select(AUDIT_COLUMNS)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("listRecentAudit failed:", error.message);
    return [];
  }
  return (data ?? []) as AuditEntry[];
}

export interface AuditQuery {
  actorRole?: string;
  action?: string;
  entityTable?: string;
  entityId?: string;
  from?: string; // YYYY-MM-DD (inclusive)
  to?: string; // YYYY-MM-DD (inclusive)
  page?: number;
  pageSize?: number;
}

export interface AuditPage {
  rows: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listAudit(query: AuditQuery): Promise<AuditPage> {
  const supabase = await createSupabaseServerClient();
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(200, Math.max(10, query.pageSize ?? 50));

  let q = supabase
    .from("audit_log")
    .select(AUDIT_COLUMNS, { count: "exact" })
    .order("occurred_at", { ascending: false });

  if (query.actorRole) q = q.eq("actor_role", query.actorRole);
  if (query.action) q = q.ilike("action", `%${query.action}%`);
  if (query.entityTable) q = q.ilike("entity_table", `%${query.entityTable}%`);
  if (query.entityId) q = q.eq("entity_id", query.entityId);
  if (query.from) q = q.gte("occurred_at", `${query.from}T00:00:00Z`);
  if (query.to) q = q.lte("occurred_at", `${query.to}T23:59:59.999Z`);

  const start = (page - 1) * pageSize;
  q = q.range(start, start + pageSize - 1);

  const { data, error, count } = await q;
  if (error) {
    console.error("listAudit failed:", error.message);
    return { rows: [], total: 0, page, pageSize };
  }
  return { rows: (data ?? []) as AuditEntry[], total: count ?? 0, page, pageSize };
}

// audit_log stores only actor_user_id; resolve to display names for the UI.
export async function resolveActorNames(
  ids: Array<string | null>,
): Promise<Record<string, string>> {
  const unique = Array.from(new Set(ids.filter((x): x is string => !!x)));
  if (unique.length === 0) return {};
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("app_users")
    .select("id, full_name")
    .in("id", unique);
  if (error || !data) return {};
  const map: Record<string, string> = {};
  for (const r of data as { id: string; full_name: string }[]) {
    map[r.id] = r.full_name;
  }
  return map;
}
