"use client";

// Phase 4 Track 4B — teacher /batch list. Mirrors mobile (teacher)/batch
// index; each row links to /batch/{id} (inside (protected) — keeps the side
// rail, locked decision #2).

import Link from "next/link";
import { CalendarClock, ChevronRight, Sparkles, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/fyne/EmptyState";
import { PageHeader } from "@/components/fyne/PageHeader";
import { useAssignedBatches } from "@/features/teacher/useAssignedBatches";

export function TeacherBatchListClient() {
  const batches = useAssignedBatches();
  const list = batches.data ?? [];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Batches"
        description="Tap a batch for risk, mastery and attendance analytics."
      />
      {batches.isLoading && !batches.data ? (
        <Skeleton className="h-32 w-full rounded-2xl" />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No batches assigned yet"
          description="Ask the admin to add you to a batch. Your roster + analytics appear here."
        />
      ) : (
        <ul className="space-y-2">
          {list.map((b) => (
            <li key={b.batch_id}>
              <Link
                href={`/batch/${b.batch_id}`}
                className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1 pr-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-primary">
                      {b.course_code}
                    </p>
                    <p className="mt-1 truncate text-base font-extrabold text-slate-900">
                      {b.batch_name}
                    </p>
                    <p className="text-xs font-medium text-slate-500">
                      {b.course_name}
                    </p>
                  </div>
                  <ChevronRight className="size-4 text-slate-300" />
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs font-semibold text-slate-700">
                  <span className="flex items-center tabular-nums">
                    <Users className="mr-1.5 size-3.5 text-slate-500" />
                    {b.student_count}{" "}
                    <span className="ml-1 font-medium text-slate-500">
                      student{b.student_count === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="flex items-center">
                    <CalendarClock className="mr-1.5 size-3.5 text-slate-500" />
                    {b.next_session?.label ?? (
                      <span className="font-medium text-slate-400">
                        No schedule set
                      </span>
                    )}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
