"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { WeakTopicItem } from "@/features/dashboard/types";

export function WeakTopicsList({ items }: { items: WeakTopicItem[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl bg-emerald-50 px-4 py-6 text-center text-sm font-medium text-emerald-700">
        All topics looking strong. Keep it up.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((w) => (
        <Link
          key={w.topic_id}
          href="/library"
          className="flex items-center rounded-2xl border border-slate-100 bg-white p-4 transition hover:border-slate-200"
        >
          <div className="mr-3 flex size-12 items-center justify-center rounded-2xl bg-amber-50">
            <span className="text-sm font-extrabold text-amber-700">
              {Math.round(w.mastery)}%
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">{w.topic_name}</p>
            <p className="mt-1 text-[11px] font-semibold text-primary">
              {w.quiz_id ? "Practice this topic" : "Review in library"}
            </p>
          </div>
          <ChevronRight className="size-4 text-slate-400" />
        </Link>
      ))}
    </div>
  );
}
