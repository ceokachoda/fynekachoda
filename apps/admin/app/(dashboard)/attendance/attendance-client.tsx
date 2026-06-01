"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { correctAttendanceAction, type AttendanceCorrectState } from "./actions";
import type { AttendanceCell } from "./page";

interface BatchOption {
  id: string;
  name: string;
  course_code: string;
}

interface StudentRow {
  user_id: string;
  full_name: string;
  email: string;
}

interface SessionCol {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  subject_name: string | null;
  title: string | null;
  is_ad_hoc: boolean;
}

function sessionName(s: { title: string | null; subject_name: string | null }): string {
  return s.title?.trim() || s.subject_name?.trim() || "Class";
}

interface Props {
  from: string;
  to: string;
  selectedBatchId?: string;
  batches: BatchOption[];
  students: StudentRow[];
  sessions: SessionCol[];
  cellsRecord: Record<string, AttendanceCell>;
}

const REASON_PRESETS = [
  "Late entry confirmed",
  "QR scan failed",
  "Teacher error",
  "Other",
];

function formatColumnDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusGlyph(s: AttendanceCell | undefined): string {
  if (!s) return "—";
  if (s.status === "present") return "P";
  if (s.status === "late") return "L";
  return "A";
}

function cellClassName(s: AttendanceCell | undefined): string {
  if (!s) return "bg-slate-50 text-slate-300";
  if (s.status === "present") return "bg-emerald-50 text-emerald-800";
  if (s.status === "late") return "bg-amber-50 text-amber-800";
  return "bg-red-50 text-red-800";
}

function escapeCsvCell(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const initialCorrection: AttendanceCorrectState = {};

export function AttendanceMatrix({
  from,
  to,
  selectedBatchId,
  batches,
  students,
  sessions,
  cellsRecord,
}: Props) {
  const router = useRouter();
  const cells = useMemo(() => new Map(Object.entries(cellsRecord)), [cellsRecord]);
  const selectedBatch = batches.find((b) => b.id === selectedBatchId);

  const [editing, setEditing] = useState<{
    student: StudentRow;
    session: SessionCol;
    cell: AttendanceCell;
  } | null>(null);
  const [draftStatus, setDraftStatus] = useState<"present" | "late" | "absent" | null>(null);
  const [draftReason, setDraftReason] = useState("");

  const [state, formAction, pending] = useActionState(
    correctAttendanceAction,
    initialCorrection,
  );

  useEffect(() => {
    if (state.ok) {
      setEditing(null);
      setDraftReason("");
      setDraftStatus(null);
      router.refresh();
    }
  }, [state, router]);

  function applyFilters(form: HTMLFormElement) {
    const fd = new FormData(form);
    const sp = new URLSearchParams();
    const f = String(fd.get("from") ?? "");
    const t = String(fd.get("to") ?? "");
    const b = String(fd.get("batch") ?? "");
    if (f) sp.set("from", f);
    if (t) sp.set("to", t);
    if (b) sp.set("batch", b);
    router.push(`/attendance?${sp.toString()}`);
  }

  function exportCsv() {
    if (!selectedBatch) return;
    const header = [
      "Student",
      "Email",
      ...sessions.map((s) =>
        `${formatColumnDate(s.scheduled_start)} — ${sessionName(s)}${s.is_ad_hoc ? " (ad-hoc)" : ""}`,
      ),
    ];
    const lines = [header.map(escapeCsvCell).join(",")];
    for (const stu of students) {
      const row: string[] = [stu.full_name, stu.email];
      for (const sess of sessions) {
        const c = cells.get(`${sess.id}|${stu.user_id}`);
        row.push(c ? c.status : "");
      }
      lines.push(row.map(escapeCsvCell).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = selectedBatch.name.replace(/[^a-z0-9-]+/gi, "_");
    a.href = url;
    a.download = `attendance_${safeName}_${from}_to_${to}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          applyFilters(e.currentTarget);
        }}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="from" className="text-xs uppercase tracking-wide text-slate-500">
            From
          </label>
          <Input
            id="from"
            name="from"
            type="date"
            defaultValue={from}
            className="w-40"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="to" className="text-xs uppercase tracking-wide text-slate-500">
            To
          </label>
          <Input
            id="to"
            name="to"
            type="date"
            defaultValue={to}
            className="w-40"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="batch" className="text-xs uppercase tracking-wide text-slate-500">
            Batch
          </label>
          <select
            id="batch"
            name="batch"
            defaultValue={selectedBatchId ?? ""}
            className="h-8 w-60 rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            <option value="">Pick a batch</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.course_code} · {b.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit">Apply</Button>
        <Button
          type="button"
          variant="outline"
          disabled={!selectedBatchId || sessions.length === 0 || students.length === 0}
          onClick={exportCsv}
        >
          Export CSV
        </Button>
      </form>

      {!selectedBatchId ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          Pick a batch above to load the attendance matrix.
        </div>
      ) : students.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          No students in this batch.
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          No sessions in {from} → {to} for this batch.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 font-medium">
                  Student
                </th>
                {sessions.map((s) => (
                  <th
                    key={s.id}
                    className="whitespace-nowrap px-3 py-3 font-medium"
                  >
                    <div>{formatColumnDate(s.scheduled_start)}</div>
                    <div className="text-[10px] font-normal text-slate-400">
                      {sessionName(s)}
                      {s.is_ad_hoc ? " · ad-hoc" : ""}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {students.map((stu) => (
                <tr key={stu.user_id} className="hover:bg-slate-50/60">
                  <td className="sticky left-0 z-10 bg-white px-4 py-2.5 align-middle">
                    <div className="font-medium text-slate-900">
                      {stu.full_name}
                    </div>
                    <div className="text-[11px] text-slate-500">{stu.email}</div>
                  </td>
                  {sessions.map((s) => {
                    const key = `${s.id}|${stu.user_id}`;
                    const c = cells.get(key);
                    const className = cellClassName(c);
                    const disabled = !c;
                    return (
                      <td key={key} className="px-2 py-2 text-center align-middle">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            if (!c) return;
                            setEditing({ student: stu, session: s, cell: c });
                            setDraftStatus(null);
                            setDraftReason("");
                          }}
                          className={`inline-flex w-9 justify-center rounded-md px-2 py-1 text-xs font-bold ${className} ${
                            disabled ? "cursor-not-allowed opacity-60" : "hover:ring-2 hover:ring-blue-300"
                          }`}
                          title={
                            c
                              ? `${c.status} (${c.method}) · ${new Date(c.marked_at).toLocaleString()}`
                              : "Unmarked"
                          }
                        >
                          {statusGlyph(c)}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setDraftReason("");
            setDraftStatus(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Correct attendance
              {editing ? ` — ${editing.student.full_name}` : ""}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? `${sessionName(editing.session)} · ${formatColumnDate(editing.session.scheduled_start)} · current status: ${editing.cell.status}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <form action={formAction} className="space-y-4">
            {editing ? (
              <input
                type="hidden"
                name="attendance_id"
                value={editing.cell.attendance_id}
              />
            ) : null}

            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">
                New status
              </p>
              <div className="flex gap-2">
                {(["present", "late", "absent"] as const).map((s) => (
                  <label
                    key={s}
                    className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-xs font-semibold ${
                      draftStatus === s
                        ? s === "present"
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : s === "late"
                            ? "border-amber-500 bg-amber-500 text-white"
                            : "border-red-600 bg-red-600 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="new_status"
                      value={s}
                      checked={draftStatus === s}
                      onChange={() => setDraftStatus(s)}
                      className="sr-only"
                    />
                    {s.toUpperCase()}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">
                Reason
              </p>
              <div className="mb-2 flex flex-wrap gap-2">
                {REASON_PRESETS.map((r) => (
                  <button
                    type="button"
                    key={r}
                    onClick={() => setDraftReason(r)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      draftReason === r
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <Input
                name="reason"
                value={draftReason}
                onChange={(e) => setDraftReason(e.target.value)}
                placeholder="Type a reason (3+ chars)"
                maxLength={500}
              />
            </div>

            {state.error ? (
              <p className="text-xs text-red-600">{state.error}</p>
            ) : null}

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={
                  pending ||
                  draftStatus === null ||
                  draftReason.trim().length < 3
                }
              >
                {pending ? "Saving…" : "Save correction"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
