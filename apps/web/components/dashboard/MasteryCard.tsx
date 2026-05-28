"use client";

import { formatIstDay } from "@/lib/ist";
import { masteryColor } from "@/features/dashboard/useMastery";
import type { MasteryRow } from "@/features/dashboard/useMastery";

export function MasteryCard({ row }: { row: MasteryRow }) {
  const pct = Math.round(row.mastery_pct);
  const color = masteryColor(pct);
  const last = row.last_attempt_at ? formatIstDay(row.last_attempt_at) : "never";
  return (
    <div className="mb-2 rounded-2xl border border-slate-100 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="mr-2 flex-1 truncate text-sm font-bold text-slate-900">
          {row.topic_name}
        </p>
        <span className="text-sm font-extrabold" style={{ color }}>
          {pct}%
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${row.topic_name} mastery ${pct} percent`}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        Avg of last {row.attempt_count} attempt{row.attempt_count === 1 ? "" : "s"} · practiced {last}
      </p>
    </div>
  );
}
