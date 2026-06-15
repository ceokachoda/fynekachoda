"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronRight,
  ListChecks,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/fyne/EmptyState";
import { useStudentQuizDiscovery } from "@/features/quiz/useStudentQuizDiscovery";

export function StudentPracticeClient() {
  const quizzes = useStudentQuizDiscovery();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const list = quizzes.data?.list ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((quiz) => quiz.title.toLowerCase().includes(q));
  }, [quizzes.data, search]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-blue-200 ring-1 ring-blue-200/50">
          <ListChecks className="size-6 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold text-slate-900">Quizzes</h1>
          <p className="text-sm text-slate-500">Practice quizzes for your batch</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search quizzes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="quiz-search"
        />
      </div>

      {quizzes.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : quizzes.error ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          Couldn&apos;t load quizzes. Pull down or reload to try again.
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={search.trim() ? "No matching quizzes" : "No quizzes yet"}
          description={
            search.trim()
              ? "Try a different search term."
              : "Quizzes assigned to your batch will appear here."
          }
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((q) => {
            const attempted = q.attempt_count > 0;
            const pct =
              q.best_score !== null && q.best_max_score
                ? Math.round((q.best_score / q.best_max_score) * 100)
                : null;
            return (
              <li key={q.id}>
                <Link
                  href={`/quiz/${q.id}`}
                  data-testid="quiz-link"
                  className="flex items-center rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
                >
                  <div
                    className={
                      "mr-3 flex size-10 items-center justify-center rounded-2xl " +
                      (attempted ? "bg-emerald-50" : "bg-blue-50")
                    }
                  >
                    {attempted ? (
                      <CheckCircle2 className="size-5 text-emerald-600" />
                    ) : (
                      <ListChecks className="size-5 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {q.title}
                    </p>
                    <p className="text-xs font-medium text-slate-500">
                      {q.duration_min} min · +{q.marks_correct}/{q.marks_wrong}/
                      {q.marks_skip}
                      {attempted
                        ? ` · attempted ${q.attempt_count}×${
                            pct !== null ? `, best ${pct}%` : ""
                          }`
                        : " · not attempted"}
                    </p>
                  </div>
                  <ChevronRight className="size-4 text-slate-400" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
