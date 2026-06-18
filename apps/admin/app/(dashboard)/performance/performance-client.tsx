"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BatchOpt, OfflineScoreRow } from "./page";
import { deleteOfflineScoreAction } from "./actions";
import { DataTableLayout } from "@/components/data-table-layout";
import { EmptyState } from "@/components/empty-state";
import { FileSpreadsheet, Keyboard, UploadCloud, List, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ManualEntryView } from "./components/manual-entry-view";
import { CsvImportView } from "./components/csv-import-view";

interface Props {
  rows: OfflineScoreRow[];
  batches: BatchOpt[];
  filters: { batch: string; q: string };
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(rows: OfflineScoreRow[]): string {
  const header = [
    "id",
    "test_name",
    "test_date",
    "batch",
    "course",
    "subject",
    "student",
    "score",
    "max_score",
    "notes",
    "entered_by",
    "entered_at_ist",
  ].join(",");
  const body = rows.map((r) =>
    [
      r.id,
      csvEscape(r.test_name),
      r.test_date,
      csvEscape(r.batch_name),
      r.course_code,
      csvEscape(r.subject_name ?? ""),
      csvEscape(r.student_name),
      r.score,
      r.max_score,
      csvEscape(r.notes ?? ""),
      csvEscape(r.entered_by_name),
      new Date(r.entered_at).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour12: false,
      }),
    ].join(","),
  );
  return [header, ...body].join("\n");
}

type Tab = "list" | "manual" | "csv";

export function OfflineScoresClient({ rows, batches, filters }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("list");
  const [pending, startTransition] = useTransition();
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<OfflineScoreRow | null>(null);

  const setFilter = (k: keyof typeof filters, v: string) => {
    const url = new URL(window.location.href);
    if (v) url.searchParams.set(k, v);
    else url.searchParams.delete(k);
    router.replace(url.pathname + "?" + url.searchParams.toString());
  };

  const remove = (id: string) => {
    setErrMsg(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("offline_score_id", id);
      const r = await deleteOfflineScoreAction({}, fd);
      if (r.error) setErrMsg(r.error);
      setConfirmDelete(null);
    });
  };

  const exportCsv = () => {
    const blob = new Blob([rowsToCsv(rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `offline-scores-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex bg-muted/50 p-1 rounded-lg w-fit border border-border">
        <button
          onClick={() => setActiveTab("list")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
            activeTab === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <List className="w-4 h-4" />
          Score History
        </button>
        <button
          onClick={() => setActiveTab("manual")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
            activeTab === "manual" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Keyboard className="w-4 h-4" />
          Fast Manual Entry
        </button>
        <button
          onClick={() => setActiveTab("csv")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
            activeTab === "csv" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <UploadCloud className="w-4 h-4" />
          Bulk CSV Import
        </button>
      </div>

      {activeTab === "manual" && (
        <ManualEntryView batches={batches} onComplete={() => setActiveTab("list")} />
      )}

      {activeTab === "csv" && (
        <CsvImportView batches={batches} onComplete={() => setActiveTab("list")} />
      )}

      {activeTab === "list" && (
        <div className="space-y-4">
          {errMsg ? (
            <div className="rounded-md border border-destructive bg-destructive/15 px-3 py-2 text-sm text-destructive">{errMsg}</div>
          ) : null}

          <DataTableLayout
            filters={
              <div className="flex flex-wrap items-end gap-3 w-full">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Batch</label>
                  <select
                    value={filters.batch}
                    onChange={(e) => setFilter("batch", e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">All batches</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                  <label className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Search test</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      defaultValue={filters.q}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setFilter("q", (e.target as HTMLInputElement).value);
                      }}
                      placeholder="Test name contains…"
                      className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                </div>
                <Button variant="outline" onClick={exportCsv} className="h-9">
                  Export CSV
                </Button>
              </div>
            }
          >
            {rows.length === 0 ? (
              <EmptyState
                icon={FileSpreadsheet}
                title="No offline scores found"
                description="Adjust your filters or add a score to get started."
              />
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted border-b border-border text-left text-[11px] uppercase text-muted-foreground tracking-wide">
                <tr>
                  <th className="px-3 py-2 rounded-tl-md">Test</th>
                  <th className="px-3 py-2">Batch · Course</th>
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2 text-right">Score</th>
                  <th className="px-3 py-2">Entered</th>
                  <th className="px-3 py-2 text-right rounded-tr-md">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-3 py-3">
                        <div className="font-medium text-foreground">{r.test_name}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{r.test_date}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium">{r.batch_name}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{r.course_code}</div>
                      </td>
                      <td className="px-3 py-3 font-medium">{r.subject_name ?? "—"}</td>
                      <td className="px-3 py-3">{r.student_name}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-medium text-foreground/80">
                        {r.score} / {r.max_score}
                      </td>
                      <td className="px-3 py-3 text-[11px] text-muted-foreground">
                        <div className="font-medium text-foreground">{r.entered_by_name}</div>
                        <div className="mt-0.5 opacity-80">
                          {new Date(r.entered_at).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                            hour12: false,
                          })}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end">
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={pending}
                            onClick={() => setConfirmDelete(r)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </DataTableLayout>
        </div>
      )}

      {confirmDelete ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-card border border-border p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-foreground">Delete offline score?</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              This removes <strong className="text-foreground font-medium">{confirmDelete.student_name}</strong>&apos;s score
              of {confirmDelete.score}/{confirmDelete.max_score} on
              &quot;{confirmDelete.test_name}&quot; ({confirmDelete.test_date}). This
              cannot be undone (audit log retains the snapshot).
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => remove(confirmDelete.id)}
              >
                Delete permanently
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
