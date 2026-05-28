"use client";

import type { AttendanceDay } from "@/features/teacher/useTeacherBatchOverview";

function colorFor(pct: number): string {
  if (pct < 60) return "#ef4444";
  if (pct < 80) return "#f59e0b";
  return "#10b981";
}

export function BatchHeatmap({ days }: { days: AttendanceDay[] }) {
  if (days.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-5">
        <p className="text-sm text-slate-500">
          No attendance recorded in the last 30 days.
        </p>
      </div>
    );
  }
  return (
    <div>
      <p className="mb-3 text-xs text-slate-500">
        Present/late share per class day (last 30 days).
      </p>
      <div className="overflow-x-auto">
        <div className="flex gap-2 pb-2">
          {days.map((d) => (
            <div key={d.date} className="flex flex-col items-center">
              <div
                className="flex h-16 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: colorFor(d.pct) }}
              >
                <span className="text-xs font-extrabold text-white">
                  {d.pct}%
                </span>
              </div>
              <span className="mt-1 text-[10px] text-slate-400">
                {Number(d.date.slice(8, 10))}/{Number(d.date.slice(5, 7))}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3.5">
        {[
          { c: "#10b981", l: "≥80%" },
          { c: "#f59e0b", l: "60–79%" },
          { c: "#ef4444", l: "<60%" },
        ].map((x) => (
          <div key={x.l} className="flex items-center">
            <span
              className="mr-1.5 inline-block size-3 rounded"
              style={{ backgroundColor: x.c }}
            />
            <span className="text-[11px] text-slate-500">{x.l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
