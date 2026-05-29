"use client";

// Phase 4 Track 4B — teacher /exams list. Mirrors mobile
// (teacher)/exams.tsx; each row links to /exam-builder/{id} +
// /exam-results/{id}.

import Link from "next/link";
import { ClipboardEdit, FileCheck2, FilePlus2, Lock, PenLine, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Pill } from "@/components/fyne/Pill";
import { PageHeader } from "@/components/fyne/PageHeader";
import { EmptyState } from "@/components/fyne/EmptyState";
import { useTeacherExams, type TeacherExamRow } from "@/features/teacher/useTeacherExams";

function fmtIstDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function statusOf(e: TeacherExamRow): { tone: "neutral" | "primary" | "error" | "success" | "warning"; label: string } {
  const now = Date.now();
  const start = new Date(e.starts_at).getTime();
  const end = start + e.duration_min * 60_000;
  if (!e.is_published) return { tone: "neutral", label: "Draft" };
  if (now < start) return { tone: "primary", label: "Scheduled" };
  if (now < end) return { tone: "error", label: "Live now" };
  if (e.results_released_at) return { tone: "success", label: "Released" };
  return { tone: "warning", label: "Closed" };
}

export function TeacherExamsClient() {
  const exams = useTeacherExams();
  const rows = exams.data ?? [];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Exams"
        description="Schedule, release and regrade graded exams."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/offline-scores">
                <PenLine />
                Offline scores
              </Link>
            </Button>
            <Button asChild>
              <Link href="/exam-builder/new">
                <FilePlus2 />
                New exam
              </Link>
            </Button>
          </div>
        }
      />
      {exams.isLoading && !exams.data ? (
        <Skeleton className="h-32 w-full rounded-2xl" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ClipboardEdit}
          title="No exams yet"
          description="Tap “New exam” to schedule your first graded test."
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((e) => {
            const status = statusOf(e);
            const released = !!e.results_released_at;
            return (
              <li key={e.id}>
                <Link
                  href={`/exam-builder/${e.id}`}
                  className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
                  data-testid={`exam-row-${e.id}`}
                >
                  <div className="flex items-start">
                    <div className="mr-3 flex size-10 items-center justify-center rounded-xl bg-blue-50">
                      <FileCheck2 className="size-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {e.title || "(untitled)"}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {e.batch_name} · {fmtIstDateTime(e.starts_at)} · {e.duration_min} min
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-700">
                        {e.question_count} Qs · {e.attempt_count} attempt{e.attempt_count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <Pill tone={status.tone}>{status.label}</Pill>
                  </div>
                </Link>
                <div className="mt-2 flex gap-2">
                  <Link
                    href={`/exam-results/${e.id}`}
                    className="flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs font-bold text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1"
                  >
                    {released ? (
                      <Unlock className="mr-2 size-3.5" />
                    ) : (
                      <Lock className="mr-2 size-3.5" />
                    )}
                    {released ? "Results · Released" : "Results · Locked"}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
