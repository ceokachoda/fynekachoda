"use client";

import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { formatIstDay, formatIstTime } from "@/lib/ist";
import type { AttendanceRow } from "@/features/attendance/useAttendanceHistory";

function statusIcon(status: AttendanceRow["status"]) {
  if (status === "present")
    return <CheckCircle2 className="size-5 text-emerald-500" />;
  if (status === "late") return <Clock className="size-5 text-amber-500" />;
  return <XCircle className="size-5 text-red-500" />;
}

function statusLabel(status: AttendanceRow["status"]): string {
  if (status === "present") return "Present";
  if (status === "late") return "Late";
  return "Absent";
}

export function AttendanceHistoryList({ rows }: { rows: AttendanceRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        No attendance records yet.
      </p>
    );
  }
  return (
    <div>
      {rows.map((r, idx) => {
        const ts = r.scheduled_start ?? r.marked_at;
        return (
          <div
            key={r.id}
            className={`flex items-center py-3 ${
              idx < rows.length - 1 ? "border-b border-slate-100" : ""
            }`}
          >
            <div className="mr-3">{statusIcon(r.status)}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">
                {r.subject_name ?? "Class"}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {formatIstDay(ts)} · {formatIstTime(ts)}
              </p>
            </div>
            <div className="text-right">
              <p
                className={`text-xs font-bold ${
                  r.status === "present"
                    ? "text-emerald-600"
                    : r.status === "late"
                      ? "text-amber-600"
                      : "text-red-600"
                }`}
              >
                {statusLabel(r.status)}
              </p>
              <p className="mt-0.5 text-[10px] uppercase text-slate-400">
                {r.method}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
