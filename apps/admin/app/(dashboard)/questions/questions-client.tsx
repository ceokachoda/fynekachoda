"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CourseOpt, QuestionRow } from "./page";
import { archiveQuestionAction, deleteQuestionAction } from "./actions";
import { DataTableLayout } from "@/components/data-table-layout";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  rows: QuestionRow[];
  courses: CourseOpt[];
  filters: { course: string; difficulty: string; status: string; q: string };
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(rows: QuestionRow[]): string {
  const header = [
    "id",
    "prompt",
    "course",
    "subject",
    "chapter",
    "topic",
    "difficulty",
    "is_archived",
    "options",
    "correct_options",
    "used_in_quizzes",
    "created_by",
    "created_at",
  ].join(",");
  const body = rows.map((r) =>
    [
      r.id,
      csvEscape(r.prompt_md.replace(/\s+/g, " ").slice(0, 200)),
      r.course_code ?? "",
      csvEscape(r.subject_name ?? ""),
      csvEscape(r.chapter_name ?? ""),
      csvEscape(r.topic_name ?? ""),
      r.difficulty ?? "",
      r.is_archived ? "yes" : "no",
      r.option_count,
      r.correct_option_count,
      r.use_count,
      csvEscape(r.created_by_name),
      r.created_at,
    ].join(",")
  );
  return [header, ...body].join("\n");
}

export function QuestionsClient({ rows, courses, filters }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<QuestionRow | null>(null);

  const setFilter = (k: keyof typeof filters, v: string) => {
    const url = new URL(window.location.href);
    if (v) url.searchParams.set(k, v);
    else url.searchParams.delete(k);
    router.replace(url.pathname + "?" + url.searchParams.toString());
  };

  const archive = (id: string, next: "archive" | "unarchive") => {
    setErrMsg(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("question_id", id);
      fd.set("next", next);
      const r = await archiveQuestionAction({}, fd);
      if (r.error) setErrMsg(r.error);
    });
  };

  const remove = (id: string) => {
    setErrMsg(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("question_id", id);
      const r = await deleteQuestionAction({}, fd);
      if (r.error) setErrMsg(r.error);
      setConfirmDelete(null);
    });
  };

  const exportCsv = () => {
    const blob = new Blob([rowsToCsv(rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `questions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      {errMsg ? (
        <div className="rounded-md border border-destructive bg-destructive/15 px-3 py-2 text-sm text-destructive">{errMsg}</div>
      ) : null}

      <DataTableLayout
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
              <label className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Difficulty</label>
              <select
                value={filters.difficulty}
                onChange={(e) => setFilter("difficulty", e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">All difficulties</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
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
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
              <label className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Search</label>
              <input
                defaultValue={filters.q}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setFilter("q", (e.target as HTMLInputElement).value);
                }}
                placeholder="Prompt contains…"
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
            title="No questions found"
            description="Adjust your filters to find questions."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted border-b border-border text-left text-[11px] uppercase text-muted-foreground tracking-wide">
            <tr>
              <th className="px-3 py-2">Prompt</th>
              <th className="px-3 py-2">Topic</th>
              <th className="px-3 py-2">Difficulty</th>
              <th className="px-3 py-2">Options</th>
              <th className="px-3 py-2">Used in</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-3 py-3 max-w-[400px]">
                    <div className="line-clamp-3 text-foreground" title={r.prompt_md}>
                      {r.prompt_md}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">By {r.created_by_name}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium">{r.topic_name ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {r.subject_name ? `${r.subject_name} · ${r.chapter_name}` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    {r.difficulty ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground border border-border">
                        {r.difficulty.toUpperCase()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 tabular-nums font-medium text-foreground/80">
                    {r.option_count} ({r.correct_option_count} correct)
                  </td>
                  <td className="px-3 py-3 tabular-nums font-medium text-foreground/80">{r.use_count} quiz(zes)</td>
                  <td className="px-3 py-3">
                    <StatusBadge status={r.is_archived ? "Archived" : "Active"} variant={r.is_archived ? "warning" : "success"} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          archive(r.id, r.is_archived ? "unarchive" : "archive")
                        }
                      >
                        {r.is_archived ? "Unarchive" : "Archive"}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={pending || r.use_count > 0}
                        onClick={() => setConfirmDelete(r)}
                        title={r.use_count > 0 ? "Used by a quiz — archive instead" : ""}
                        className="disabled:opacity-40"
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
            <h3 className="text-lg font-semibold text-foreground">Delete question?</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Permanently remove this question and its options + solution. This cannot
              be undone.
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
