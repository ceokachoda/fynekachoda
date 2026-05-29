"use client";

import Link from "next/link";
import type { DashboardStats } from "@/features/dashboard/types";

interface StatTileProps {
  label: string;
  value: string;
  href: string;
}

function StatTile({ label, value, href }: StatTileProps) {
  return (
    <Link
      href={href}
      className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
    >
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <span className="mt-1 text-xl font-extrabold text-slate-900 tabular-nums">{value}</span>
    </Link>
  );
}

export function StatsStrip({ stats }: { stats: DashboardStats }) {
  return (
    <div className="flex gap-3">
      <StatTile
        label="Attendance"
        value={`${Math.round(stats.attendance_pct)}%`}
        href="/attendance"
      />
      <StatTile
        label="Mastery"
        value={`${Math.round(stats.mastery_pct)}%`}
        href="/profile?tab=mastery"
      />
      <StatTile
        label="Rank"
        value={stats.rank_this_week != null ? `#${stats.rank_this_week}` : "—"}
        href="/leaderboard"
      />
    </div>
  );
}
