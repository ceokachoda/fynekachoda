"use client";

import { ShieldAlert } from "lucide-react";
import type { AtRiskStudent } from "@/features/teacher/useTeacherBatchOverview";

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

export function AtRiskList({ students }: { students: AtRiskStudent[] }) {
  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-emerald-100 bg-emerald-50/60 p-6 text-center">
        <ShieldAlert className="size-8 text-emerald-500" />
        <p className="mt-3 text-base font-bold text-slate-900">No students at risk</p>
        <p className="mt-1 text-sm leading-snug text-slate-500">
          Everyone&apos;s composite score is at or above 0.40.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="mb-2 text-xs leading-relaxed text-slate-500">
        Composite score below 0.40 — blends quiz/exam (60%), activity (25%) and streak (15%).
      </p>
      {students.map((s) => (
        <div
          key={s.student_id}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-center">
            <div className="mr-3 flex size-10 items-center justify-center rounded-full bg-red-50 ring-1 ring-red-100">
              <span className="text-xs font-bold text-red-600">
                {initials(s.full_name)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900">{s.full_name}</p>
              <p className="mt-0.5 text-xs font-medium text-slate-500 tabular-nums">
                Mastery {s.avg_mastery === null ? "—" : `${s.avg_mastery}%`} · Attendance{" "}
                {s.attendance_pct === null ? "—" : `${s.attendance_pct}%`}
              </p>
            </div>
            <div className="ml-2 flex flex-col items-center rounded-xl bg-red-50 px-2.5 py-1.5 ring-1 ring-red-100">
              <span className="text-sm font-extrabold tabular-nums text-red-600">
                {s.composite.toFixed(2)}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-red-400">
                composite
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
