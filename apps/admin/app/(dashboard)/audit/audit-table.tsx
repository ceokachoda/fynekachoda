"use client";

import { useState, useMemo } from "react";
import type { AuditEntry } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { ActivityFeedItem } from "../_components/dashboard-widgets";
import { Download, ShieldAlert, FileJson, Clock, User, Globe } from "lucide-react";

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
    return r.actor_role ? r.actor_role.replace(/_/g, " ") : "System Process";
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

  // Group rows by date for a better timeline experience
  const groupedRows = useMemo(() => {
    const groups: Record<string, AuditEntry[]> = {};
    rows.forEach(r => {
      const date = new Date(r.occurred_at).toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" });
      if (!groups[date]) groups[date] = [];
      groups[date].push(r);
    });
    return groups;
  }, [rows]);

  return (
    <div className="space-y-6 animate-in-fade">
      <div className="flex justify-between items-center bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-3 text-muted-foreground">
          <ShieldAlert className="w-5 h-5 text-primary" />
          <p className="text-sm">Viewing <strong className="text-foreground">{rows.length}</strong> security and administrative events</p>
        </div>
        <Button variant="outline" className="bg-background gap-2 h-9" onClick={exportCsv}>
          <Download className="w-4 h-4" /> Export Events (CSV)
        </Button>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm p-6 sm:p-8">
        <div className="space-y-12">
          {Object.entries(groupedRows).map(([date, entries]) => (
            <div key={date} className="relative">
              <div className="sticky top-0 z-10 bg-card/90 backdrop-blur-sm py-2 mb-4 -mx-2 px-2">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {date}
                </h3>
              </div>
              
              <div className="space-y-2 relative ml-2">
                {/* Timeline vertical line */}
                <div className="absolute left-4 top-4 bottom-4 w-px bg-border/60" />
                
                {entries.map((r) => (
                  <div 
                    key={r.id} 
                    className="relative group cursor-pointer hover:bg-muted/30 rounded-xl transition-colors pr-4"
                    onClick={() => setSelected(r)}
                  >
                    <ActivityFeedItem
                      actionLabel={r.action.replace(/_/g, " ")}
                      actionRaw={r.action}
                      entity={r.entity_table}
                      actorRole={r.actor_role ?? "system"}
                      time={new Date(r.occurred_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs font-medium">
                        <FileJson className="w-3.5 h-3.5" /> Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {rows.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No audit events found for the selected criteria.
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="sm:max-w-3xl p-0 overflow-hidden gap-0 bg-background border-border shadow-lg">
          {selected && (
            <>
              <div className="bg-muted/30 border-b border-border p-6 flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground flex items-center gap-3">
                    <ShieldAlert className="w-6 h-6 text-primary" />
                    <span className="capitalize">{selected.action.replace(/_/g, " ")}</span>
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                    Action performed on table <code className="bg-muted px-1.5 py-0.5 rounded text-primary text-xs">{selected.entity_table}</code>
                  </p>
                </div>
              </div>
              
              <div className="max-h-[70vh] overflow-y-auto">
                <div className="p-6 grid gap-6">
                  {/* Metadata Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <MetaCard icon={<User className="w-4 h-4 text-blue-500" />} label="Actor" value={actorName(selected)} />
                    <MetaCard icon={<ShieldAlert className="w-4 h-4 text-amber-500" />} label="Role" value={selected.actor_role?.replace(/_/g, " ") ?? "System"} />
                    <MetaCard icon={<Clock className="w-4 h-4 text-emerald-500" />} label="Timestamp" value={fmt(selected.occurred_at)} />
                    <MetaCard icon={<Globe className="w-4 h-4 text-purple-500" />} label="IP Address" value={selected.ip_address ?? "Not recorded"} />
                  </div>

                  {/* Diffs */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Previous State</p>
                        <span className="w-2 h-2 rounded-full bg-rose-500/50" />
                      </div>
                      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 overflow-hidden">
                        <pre className="max-h-[400px] overflow-auto p-4 text-xs font-mono text-rose-900 dark:text-rose-200">
                          {pretty(selected.before_data)}
                        </pre>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">New State</p>
                        <span className="w-2 h-2 rounded-full bg-emerald-500/50" />
                      </div>
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
                        <pre className="max-h-[400px] overflow-auto p-4 text-xs font-mono text-emerald-900 dark:text-emerald-200">
                          {pretty(selected.after_data)}
                        </pre>
                      </div>
                    </div>
                  </div>
                  
                  {/* Additional Info */}
                  <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground block text-xs mb-1 uppercase tracking-wider font-semibold">Entity ID</span>
                        <span className="font-mono text-xs">{selected.entity_id ?? "—"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs mb-1 uppercase tracking-wider font-semibold">User Agent</span>
                        <span className="text-xs text-muted-foreground break-all">{selected.user_agent ?? "—"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetaCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      </div>
      <span className="font-semibold text-sm truncate" title={value}>{value}</span>
    </div>
  );
}
