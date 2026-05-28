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
      <div className="flex flex-col items-center rounded-2xl border border-slate-100 bg-white p-6 text-center">
        <ShieldAlert className="size-7 text-emerald-500" />
        <p className="mt-3 text-sm font-bold text-slate-900">No students at risk</p>
        <p className="mt-1 text-xs leading-snug text-slate-500">
          Everyone&apos;s composite score is at or above 0.40.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="mb-2 text-xs text-slate-500">
        Composite score below 0.40 — blends quiz/exam (60%), activity (25%) and streak (15%).
      </p>
      {students.map((s) => (
        <div
          key={s.student_id}
          className="rounded-2xl border border-slate-100 bg-white p-4"
        >
          <div className="flex items-center">
            <div className="mr-3 flex size-10 items-center justify-center rounded-full bg-red-50">
              <span className="text-xs font-bold text-red-600">
                {initials(s.full_name)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900">{s.full_name}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Mastery {s.avg_mastery === null ? "—" : `${s.avg_mastery}%`} · Attendance{" "}
                {s.attendance_pct === null ? "—" : `${s.attendance_pct}%`}
              </p>
            </div>
            <div className="ml-2 flex flex-col items-center rounded-xl bg-red-50 px-2.5 py-1.5">
              <span className="text-sm font-extrabold text-red-600">
                {s.composite.toFixed(2)}
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-wide text-red-400">
                composite
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
