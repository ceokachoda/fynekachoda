"use client";

import Link from "next/link";
import { CheckCircle2, Hand, Megaphone } from "lucide-react";
import type { TeacherPending } from "@/features/teacher/useTeacherDashboard";

export function PendingList({ pending }: { pending: TeacherPending }) {
  const exams = pending.exams_awaiting_release;
  const nothing = exams.length === 0 && pending.raised_hands === 0;

  if (nothing) {
    return (
      <div className="flex items-center rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-100">
          <CheckCircle2 className="size-5 text-emerald-600" />
        </div>
        <p className="ml-3 flex-1 text-sm font-medium text-slate-700">
          You&apos;re all caught up — nothing pending.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {exams.map((e) => (
        <Link
          key={e.exam_id}
          href={`/exam-results/${e.exam_id}`}
          className="flex items-center rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
        >
          <div className="mr-3 flex size-10 items-center justify-center rounded-2xl bg-amber-50">
            <Megaphone className="size-4 text-amber-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">
              Release results: {e.title}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {e.batch} · {e.submitted_count} submitted
            </p>
          </div>
        </Link>
      ))}
      {pending.raised_hands > 0 ? (
        <div className="flex items-center rounded-2xl border border-slate-100 bg-white p-4">
          <div className="mr-3 flex size-10 items-center justify-center rounded-2xl bg-blue-50">
            <Hand className="size-4 text-primary" />
          </div>
          <p className="flex-1 text-sm font-bold text-slate-900">
            Review {pending.raised_hands} raised hand
            {pending.raised_hands === 1 ? "" : "s"}
          </p>
        </div>
      ) : null}
    </div>
  );
}
