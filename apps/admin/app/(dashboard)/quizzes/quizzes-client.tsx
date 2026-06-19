"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { BatchOpt, CourseOpt, QuizRow } from "./page";
import { deleteQuizAction, togglePublishQuizAction } from "./actions";
import { DataTableLayout } from "@/components/data-table-layout";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  rows: QuizRow[];
  courses: CourseOpt[];
  batches: BatchOpt[];
  filters: { course: string; batch: string; status: string; q: string };
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(rows: QuizRow[]): string {
  const header = [
    "id",
    "title",
    "course",
    "batch",
    "topic",
    "chapter",
    "duration_min",
    "marks_correct",
    "marks_wrong",
    "marks_skip",
    "is_published",
    "question_count",
    "attempt_count",
    "created_by",
    "created_at",
  ].join(",");
  const body = rows.map((r) =>
    [
      r.id,
      csvEscape(r.title),
      r.course_code,
      r.batch_name ?? "(course-wide)",
      csvEscape(r.topic_name ?? ""),
      csvEscape(r.chapter_name ?? ""),
      r.duration_min,
      r.marks_correct,
      r.marks_wrong,
      r.marks_skip,
      r.is_published ? "yes" : "no",
      r.question_count,
      r.attempt_count,
      csvEscape(r.created_by_name),
      r.created_at,
    ].join(",")
  );
  return [header, ...body].join("\n");
}

export function QuizzesClient({ rows, courses, batches, filters }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<QuizRow | null>(null);

  const batchesForCourse = useMemo(
    () =>
      filters.course
        ? batches.filter((b) => b.course_id === filters.course)
        : batches,
    [batches, filters.course],
  );

  const setFilter = (k: keyof typeof filters, v: string) => {
    startTransition(() => {
      const url = new URL(window.location.href);
      if (v) url.searchParams.set(k, v);
      else url.searchParams.delete(k);
      if (k === "course") url.searchParams.delete("batch");
      router.replace(url.pathname + "?" + url.searchParams.toString(), { scroll: false });
    });
  };

  const toggle = (id: string, next: "publish" | "unpublish") => {
    setErrMsg(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("quiz_id", id);
      fd.set("next", next);
      const r = await togglePublishQuizAction({}, fd);
      if (r.error) setErrMsg(r.error);
    });
  };

  const remove = (id: string) => {
    setErrMsg(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("quiz_id", id);
      const r = await deleteQuizAction({}, fd);
      if (r.error) setErrMsg(r.error);
      setConfirmDelete(null);
    });
  };

  const exportCsv = () => {
    const blob = new Blob([rowsToCsv(rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `quizzes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      {errMsg ? (
        <div className="rounded-md border border-destructive bg-destructive/15 px-3 py-2 text-sm text-destructive">{errMsg}</div>
      ) : null}

      <DataTableLayout
        isLoading={pending}
        filters={
          <div className="flex flex-wrap items-end gap-3 w-full">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Course</label>
              <select
                value={filters.course}
                onChange={(e) => setFilter("course", e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">All courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Batch</label>
              <select
                value={filters.batch}
                onChange={(e) => setFilter("batch", e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">All batches</option>
                <option value="course-wide">Course-wide</option>
                {batchesForCourse.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilter("status", e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">All statuses</option>
                <option value="published">Published</option>
                <option value="unpublished">Draft</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
              <label className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Search</label>
              <input
                defaultValue={filters.q}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setFilter("q", (e.target as HTMLInputElement).value);
                }}
                placeholder="Title contains…"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <Button variant="outline" onClick={exportCsv} className="h-9">
              Export CSV
            </Button>
          </div>
        }
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={FileQuestion}
            title="No quizzes found"
            description="Adjust your filters or create a new quiz to get started."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted border-b border-border text-left text-[11px] uppercase text-muted-foreground tracking-wide">
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Scope</th>
              <th className="px-3 py-2">Topic / Chapter</th>
              <th className="px-3 py-2">Marks</th>
              <th className="px-3 py-2">Q · Attempts</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-3 py-3">
                    <div className="font-medium text-foreground">{r.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">By {r.created_by_name}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium">{r.course_code}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{r.batch_name ?? "Course-wide"}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium">{r.topic_name ?? r.chapter_name ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{r.duration_min} min</div>
                  </td>
                  <td className="px-3 py-3 tabular-nums font-medium text-foreground/80">
                    +{r.marks_correct} / {r.marks_wrong} / {r.marks_skip}
                  </td>
                  <td className="px-3 py-3 tabular-nums font-medium text-foreground/80">
                    {r.question_count} · {r.attempt_count}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={r.is_published ? "Published" : "Draft"} variant={r.is_published ? "success" : "default"} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/quizzes/${r.id}`}>
                          Results
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          toggle(r.id, r.is_published ? "unpublish" : "publish")
                        }
                      >
                        {r.is_published ? "Unpublish" : "Publish"}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={pending}
                        onClick={() => setConfirmDelete(r)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DataTableLayout>

      {confirmDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-xl bg-card border border-border p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-foreground">Delete quiz?</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              This permanently removes <strong className="text-foreground font-medium">{confirmDelete.title}</strong> along
              with all its attempts and answers. This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => remove(confirmDelete.id)}
              >
                Delete permanently
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
