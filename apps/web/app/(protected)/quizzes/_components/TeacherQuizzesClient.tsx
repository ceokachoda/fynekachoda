"use client";

// Phase 4 Track 4B — teacher /quizzes list. Mirrors mobile
// (teacher)/quizzes.tsx; each row deep-links to /quiz-builder/{id}.

import Link from "next/link";
import { ChevronRight, FilePlus2, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Pill } from "@/components/fyne/Pill";
import { PageHeader } from "@/components/fyne/PageHeader";
import { EmptyState } from "@/components/fyne/EmptyState";
import { useTeacherQuizzes } from "@/features/teacher/useTeacherQuizzes";

export function TeacherQuizzesClient() {
  const quizzes = useTeacherQuizzes();
  const rows = quizzes.data ?? [];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Quizzes"
        description="Author practice quizzes for your topics."
        actions={
          <Button asChild>
            <Link href="/quiz-builder/new">
              <FilePlus2 />
              New quiz
            </Link>
          </Button>
        }
      />
      {quizzes.isLoading && !quizzes.data ? (
        <Skeleton className="h-32 w-full rounded-2xl" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No quizzes yet"
          description="Tap “New quiz” to author your first practice quiz."
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/quiz-builder/${r.id}`}
                className="flex items-center rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
                data-testid={`quiz-row-${r.id}`}
              >
                <div className="mr-3 flex size-10 items-center justify-center rounded-xl bg-blue-50">
                  <ListChecks className="size-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">
                    {r.title || "(untitled)"}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {r.question_count} question{r.question_count === 1 ? "" : "s"} ·{" "}
                    {r.duration_min} min
                  </p>
                </div>
                <Pill tone={r.is_published ? "success" : "neutral"}>
                  {r.is_published ? "Published" : "Draft"}
                </Pill>
                <ChevronRight className="ml-2 size-4 text-slate-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
