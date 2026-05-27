import Link from "next/link";
import { listAudit, resolveActorNames } from "@/lib/audit";
import { AuditFilters } from "./audit-filters";
import { AuditTable } from "./audit-table";

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
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Audit log</h1>
        <p className="text-sm text-slate-500">
          {total.toLocaleString("en-IN")}{" "}
          {total === 1 ? "event" : "events"} recorded. Every privileged change
          is logged here with who, what, and before/after values.
        </p>
      </header>

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

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          No audit events match this view.
          {hasFilters ? (
            <>
              {" "}
              <Link href="/audit" className="text-blue-600 hover:underline">
                Clear filters.
              </Link>
            </>
          ) : null}
        </div>
      ) : (
        <>
          <AuditTable rows={rows} names={names} />

          {totalPages > 1 ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Link
                    href={pageHref(page - 1)}
                    className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-100"
                  >
                    ← Prev
                  </Link>
                ) : (
                  <span className="rounded-md border border-slate-100 px-3 py-1.5 text-slate-300">
                    ← Prev
                  </span>
                )}
                {page < totalPages ? (
                  <Link
                    href={pageHref(page + 1)}
                    className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-100"
                  >
                    Next →
                  </Link>
                ) : (
                  <span className="rounded-md border border-slate-100 px-3 py-1.5 text-slate-300">
                    Next →
                  </span>
                )}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
