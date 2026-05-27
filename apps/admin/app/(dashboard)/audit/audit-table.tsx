"use client";

import { useState } from "react";
import type { AuditEntry } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pretty(v: unknown): string {
  if (v === null || v === undefined) return "—";
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function csvCell(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

function download(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function AuditTable({
  rows,
  names,
}: {
  rows: AuditEntry[];
  names: Record<string, string>;
}) {
  const [selected, setSelected] = useState<AuditEntry | null>(null);

  function actorName(r: AuditEntry): string {
    const named = r.actor_user_id ? names[r.actor_user_id] : undefined;
    if (named) return named;
    return r.actor_role ? r.actor_role.replace(/_/g, " ") : "system";
  }

  function exportCsv() {
    const header = [
      "occurred_at",
      "actor",
      "actor_role",
      "action",
      "entity_table",
      "entity_id",
      "ip_address",
    ];
    const lines = rows.map((r) =>
      [
        r.occurred_at,
        actorName(r),
        r.actor_role ?? "",
        r.action,
        r.entity_table,
        r.entity_id ?? "",
        r.ip_address ?? "",
      ]
        .map((c) => csvCell(String(c)))
        .join(","),
    );
    download(
      [header.map(csvCell).join(","), ...lines].join("\r\n"),
      `audit-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  }

  return (
    <>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportCsv}>
          Export page (CSV)
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Actor</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Entity</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-500">{fmt(r.occurred_at)}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{actorName(r)}</p>
                  {r.actor_role ? (
                    <p className="text-xs text-slate-400">
                      {r.actor_role.replace(/_/g, " ")}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {r.action.replace(/_/g, " ")}
                </td>
                <td className="px-4 py-3">
                  <p className="text-slate-700">{r.entity_table}</p>
                  {r.entity_id ? (
                    <p className="max-w-[160px] truncate text-xs text-slate-400">
                      {r.entity_id}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelected(r)}
                  >
                    Details
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selected
                ? `${selected.action.replace(/_/g, " ")} · ${selected.entity_table}`
                : ""}
            </DialogTitle>
          </DialogHeader>
          {selected ? (
            <div className="max-h-[70vh] space-y-4 overflow-auto pr-1">
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <Meta label="Actor" value={actorName(selected)} />
                <Meta label="Role" value={selected.actor_role ?? "—"} />
                <Meta label="When" value={fmt(selected.occurred_at)} />
                <Meta label="Entity ID" value={selected.entity_id ?? "—"} />
                <Meta label="IP" value={selected.ip_address ?? "—"} />
                <Meta
                  label="User agent"
                  value={selected.user_agent ?? "—"}
                />
              </dl>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Before
                  </p>
                  <pre className="max-h-64 overflow-auto rounded-md bg-slate-900 p-3 text-xs text-rose-200">
                    {pretty(selected.before_data)}
                  </pre>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                    After
                  </p>
                  <pre className="max-h-64 overflow-auto rounded-md bg-slate-900 p-3 text-xs text-emerald-200">
                    {pretty(selected.after_data)}
                  </pre>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-slate-400">{label}</dt>
      <dd className="truncate font-medium text-slate-700">{value}</dd>
    </div>
  );
}
