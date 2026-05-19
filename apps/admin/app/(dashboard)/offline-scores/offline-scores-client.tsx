"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BatchOpt, OfflineScoreRow } from "./page";
import { deleteOfflineScoreAction } from "./actions";

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

export function OfflineScoresClient({ rows, batches, filters }: Props) {
  const router = useRouter();
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div>
          <label className="block text-[10px] uppercase text-slate-500">Batch</label>
          <select
            value={filters.batch}
            onChange={(e) => setFilter("batch", e.target.value)}
            className="rounded border-slate-300 px-2 py-1 text-sm"
          >
            <option value="">All</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-[10px] uppercase text-slate-500">Search test</label>
          <input
            defaultValue={filters.q}
            onKeyDown={(e) => {
              if (e.key === "Enter") setFilter("q", (e.target as HTMLInputElement).value);
            }}
            placeholder="Test name contains…"
            className="w-full rounded border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          Export CSV
        </button>
      </div>

      {errMsg ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{errMsg}</div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Test</th>
              <th className="px-3 py-2">Batch · Course</th>
              <th className="px-3 py-2">Subject</th>
              <th className="px-3 py-2">Student</th>
              <th className="px-3 py-2 text-right">Score</th>
              <th className="px-3 py-2">Entered</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                  No offline scores match the filters.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{r.test_name}</div>
                    <div className="text-[11px] text-slate-500">{r.test_date}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div>{r.batch_name}</div>
                    <div className="text-[11px] text-slate-500">{r.course_code}</div>
                  </td>
                  <td className="px-3 py-2">{r.subject_name ?? "—"}</td>
                  <td className="px-3 py-2">{r.student_name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.score} / {r.max_score}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-slate-600">
                    <div>{r.entered_by_name}</div>
                    <div className="text-slate-400">
                      {new Date(r.entered_at).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        hour12: false,
                      })}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setConfirmDelete(r)}
                        className="rounded border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {confirmDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900">Delete offline score?</h3>
            <p className="mt-2 text-sm text-slate-600">
              This removes <strong>{confirmDelete.student_name}</strong>&apos;s score
              of {confirmDelete.score}/{confirmDelete.max_score} on
              &quot;{confirmDelete.test_name}&quot; ({confirmDelete.test_date}). This
              cannot be undone (audit log retains the snapshot).
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => remove(confirmDelete.id)}
                className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
