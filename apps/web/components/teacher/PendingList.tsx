"use client";

import Link from "next/link";
import { CheckCircle2, Hand, Megaphone } from "lucide-react";
import type { TeacherPending } from "@/features/teacher/useTeacherDashboard";

export function PendingList({ pending }: { pending: TeacherPending }) {
  const exams = pending.exams_awaiting_release;
  const nothing = exams.length === 0 && pending.raised_hands === 0;

  if (nothing) {
    return (
      <div className="flex items-center rounded-2xl border border-slate-100 bg-white p-4">
        <CheckCircle2 className="size-5 text-emerald-500" />
        <p className="ml-3 flex-1 text-sm text-slate-500">
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
          className="flex items-center rounded-2xl border border-slate-100 bg-white p-4 transition hover:border-slate-200"
        >
          <div className="mr-3 flex size-10 items-center justify-center rounded-2xl bg-amber-50">
            <Megaphone className="size-4 text-amber-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">
              Release results: {e.title}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
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
