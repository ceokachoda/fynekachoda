"use client";

import Link from "next/link";
import type { TodayItem } from "@/features/dashboard/types";
import { formatIstTime } from "@/lib/ist";

function badgeFor(item: TodayItem): { label: string; bg: string; text: string; dot?: boolean } {
  if (item.status === "live") {
    return { label: "LIVE", bg: "bg-red-50", text: "text-red-700", dot: true };
  }
  if (item.attendance_status === "present") {
    return { label: "Present", bg: "bg-emerald-50", text: "text-emerald-700" };
  }
  if (item.attendance_status === "late") {
    return { label: "Late", bg: "bg-amber-50", text: "text-amber-700" };
  }
  if (item.attendance_status === "absent") {
    return { label: "Absent", bg: "bg-red-50", text: "text-red-700" };
  }
  if (item.status === "ended") {
    return { label: "Ended", bg: "bg-slate-100", text: "text-slate-600" };
  }
  return { label: "Scheduled", bg: "bg-blue-50", text: "text-blue-700" };
}

export function TodayScheduleStrip({ items }: { items: TodayItem[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        No classes scheduled today.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((s) => {
        const b = badgeFor(s);
        return (
          <Link
            key={s.session_id}
            href="/attendance"
            className="flex items-center rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          >
            <div className="w-14">
              <p className="text-sm font-bold text-slate-900">{formatIstTime(s.start)}</p>
              <p className="text-xs text-slate-400">{formatIstTime(s.end)}</p>
            </div>
            <p className="ml-2 flex-1 truncate text-sm font-semibold text-slate-800">
              {s.subject}
            </p>
            <span
              className={`flex items-center rounded-md px-2 py-1 ${b.bg}`}
            >
              {b.dot ? <span className="mr-1.5 size-1.5 rounded-full bg-red-500" /> : null}
              <span className={`text-xs font-bold ${b.text}`}>{b.label}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
