"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { WeakTopicItem } from "@/features/dashboard/types";

export function WeakTopicsList({ items }: { items: WeakTopicItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-6 text-center">
        <p className="text-sm font-semibold text-emerald-700">
          All topics looking strong. Keep it up.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((w) => {
        const href = w.quiz_id ? `/quiz/${w.quiz_id}` : "/library";
        return (
          <Link
            key={w.topic_id}
            href={href}
            data-testid={w.quiz_id ? "weak-topic-quiz-link" : "weak-topic-library-link"}
            className="flex items-center rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          >
            <div className="mr-3 flex size-12 items-center justify-center rounded-2xl bg-amber-50 ring-1 ring-amber-100">
              <span className="text-sm font-extrabold tabular-nums text-amber-700">
                {Math.round(w.mastery)}%
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900">{w.topic_name}</p>
              <p className="mt-1 text-xs font-semibold text-primary">
                {w.quiz_id ? "Practice this topic →" : "Review in library →"}
              </p>
            </div>
            <ChevronRight className="size-4 text-slate-400" />
          </Link>
        );
      })}
    </div>
  );
}
