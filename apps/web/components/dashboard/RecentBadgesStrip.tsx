"use client";

import { Award } from "lucide-react";
import type { RecentBadge } from "@/features/dashboard/types";

const BADGE_COLOR: Record<string, string> = {
  first_quiz: "#16a34a",
  streak_7: "#f97316",
  streak_30: "#dc2626",
  streak_90: "#eab308",
  perfect_week_attendance: "#0d9488",
  topper_of_week: "#f59e0b",
  runner_up_week: "#64748b",
  quiz_100: "#7c3aed",
  mastery_80_subject: "#2563eb",
  early_bird: "#06b6d4",
  comeback: "#6366f1",
};

export function RecentBadgesStrip({ badges }: { badges: RecentBadge[] }) {
  if (badges.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 text-center">
        <p className="text-sm text-slate-500">
          Earn badges by attending sessions, hitting streaks, and topping quizzes.
        </p>
      </div>
    );
  }
  return (
    <div className="flex gap-2.5">
      {badges.slice(0, 3).map((b) => {
        const color = BADGE_COLOR[b.code] ?? "#7c3aed";
        return (
          <div
            key={b.code}
            className="flex flex-1 flex-col items-center rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-colors hover:border-slate-300"
          >
            <div
              className="mb-1.5 flex size-11 items-center justify-center rounded-2xl ring-1"
              style={{ backgroundColor: `${color}1a`, borderColor: `${color}33` }}
            >
              <Award className="size-5" style={{ color }} />
            </div>
            <p className="line-clamp-2 text-center text-xs font-bold text-slate-700">
              {b.name}
            </p>
          </div>
        );
      })}
    </div>
  );
}
