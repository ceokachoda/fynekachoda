import Link from "next/link";
import { listAudit, resolveActorNames } from "@/lib/audit";
import { AuditFilters } from "./audit-filters";
import { AuditTable } from "./audit-table";
import { PageHeader } from "@/components/page-header";
import { DataTableLayout } from "@/components/data-table-layout";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { ShieldAlert } from "lucide-react";

export const metadata = {
  title: "Audit log · FyneStudy Admin",
};

export const dynamic = "force-dynamic";

const ROLE_OPTIONS = ["owner_admin", "staff_admin", "teacher", "student"];

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const page = Number.parseInt(sp.page ?? "1", 10) || 1;

  const actorRole = sp.actor_role || undefined;
  const action = sp.action || undefined;
  const entityTable = sp.entity || undefined;
  const from = sp.from || undefined;
  const to = sp.to || undefined;

  const { rows, total, pageSize } = await listAudit({
    actorRole,
    action,
    entityTable,
    from,
    to,
    page,
  });
  const names = await resolveActorNames(rows.map((r) => r.actor_user_id));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function pageHref(p: number): string {
    const params = new URLSearchParams();
    if (actorRole) params.set("actor_role", actorRole);
    if (action) params.set("action", action);
    if (entityTable) params.set("entity", entityTable);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/audit?${qs}` : "/audit";
  }

  const hasFilters = !!(actorRole || action || entityTable || from || to);

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Audit log" 
        breadcrumbs={[{ label: "Overview", href: "/" }, { label: "Audit log" }]}
      />

      <DataTableLayout
        filters={
          <AuditFilters
            initial={{
              actorRole: actorRole ?? "",
              action: action ?? "",
              entity: entityTable ?? "",
              from: from ?? "",
              to: to ?? "",
            }}
            roleOptions={ROLE_OPTIONS}
          />
        }
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={ShieldAlert}
            title="No audit events found"
            description={hasFilters ? "No audit events match the current filters." : "No audit events recorded yet."}
          >
            {hasFilters ? (
              <Button variant="outline" asChild>
                <Link href="/audit">Clear filters</Link>
              </Button>
            ) : null}
          </EmptyState>
        ) : (
          <>
            <AuditTable rows={rows} names={names} />

            {totalPages > 1 ? (
              <div className="flex items-center justify-between text-sm px-4 py-3 border-t border-border">
                <span className="text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  {page > 1 ? (
                    <Link
                      href={pageHref(page - 1)}
                      className="rounded-md border border-border px-3 py-1.5 text-foreground hover:bg-muted"
                    >
                      ← Prev
                    </Link>
                  ) : (
                    <span className="rounded-md border border-transparent px-3 py-1.5 text-muted-foreground/50">
                      ← Prev
                    </span>
                  )}
                  {page < totalPages ? (
                    <Link
                      href={pageHref(page + 1)}
                      className="rounded-md border border-border px-3 py-1.5 text-foreground hover:bg-muted"
                    >
                      Next →
                    </Link>
                  ) : (
                    <span className="rounded-md border border-transparent px-3 py-1.5 text-muted-foreground/50">
                      Next →
                    </span>
                  )}
                </div>
              </div>
            ) : null}
          </>
        )}
      </DataTableLayout>
    </div>
  );
}
