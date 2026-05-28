"use client";

import type { TopicMastery } from "@/features/teacher/useTeacherBatchOverview";

function colorFor(pct: number): string {
  if (pct < 50) return "#ef4444";
  if (pct < 75) return "#f59e0b";
  return "#10b981";
}

export function TopicMasteryBars({ topics }: { topics: TopicMastery[] }) {
  if (topics.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-5">
        <p className="text-sm text-slate-500">
          No mastery data yet — it appears once students attempt quizzes or exams.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="mb-1 text-xs text-slate-500">
        Class average per topic, weakest first.
      </p>
      {topics.map((t) => {
        const pct = Math.max(0, Math.min(100, Math.round(t.avg_mastery)));
        const color = colorFor(pct);
        return (
          <div
            key={t.topic_id}
            className="rounded-2xl border border-slate-100 bg-white p-4"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="mr-2 flex-1 truncate text-sm font-bold text-slate-900">
                {t.topic_name}
              </p>
              <span className="text-sm font-extrabold" style={{ color }}>
                {pct}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              {t.student_count} student{t.student_count === 1 ? "" : "s"} with data
            </p>
          </div>
        );
      })}
    </div>
  );
}
