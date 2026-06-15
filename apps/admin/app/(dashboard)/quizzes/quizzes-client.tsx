"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { BatchOpt, CourseOpt, QuizRow } from "./page";
import { deleteQuizAction, togglePublishQuizAction } from "./actions";

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
    const url = new URL(window.location.href);
    if (v) url.searchParams.set(k, v);
    else url.searchParams.delete(k);
    if (k === "course") url.searchParams.delete("batch");
    router.replace(url.pathname + "?" + url.searchParams.toString());
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
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div>
          <label className="block text-[10px] uppercase text-slate-500">Course</label>
          <select
            value={filters.course}
            onChange={(e) => setFilter("course", e.target.value)}
            className="rounded border-slate-300 px-2 py-1 text-sm"
          >
            <option value="">All</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase text-slate-500">Batch</label>
          <select
            value={filters.batch}
            onChange={(e) => setFilter("batch", e.target.value)}
            className="rounded border-slate-300 px-2 py-1 text-sm"
          >
            <option value="">All</option>
            <option value="course-wide">Course-wide (no batch)</option>
            {batchesForCourse.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase text-slate-500">Status</label>
          <select
            value={filters.status}
            onChange={(e) => setFilter("status", e.target.value)}
            className="rounded border-slate-300 px-2 py-1 text-sm"
          >
            <option value="">All</option>
            <option value="published">Published</option>
            <option value="unpublished">Draft</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-[10px] uppercase text-slate-500">Search</label>
          <input
            defaultValue={filters.q}
            onKeyDown={(e) => {
              if (e.key === "Enter") setFilter("q", (e.target as HTMLInputElement).value);
            }}
            placeholder="Title contains…"
            className="w-full rounded border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          Export CSV
        </button>
      </div>

      {errMsg ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{errMsg}</div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
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
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                  No quizzes match the filters.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{r.title}</div>
                    <div className="text-[11px] text-slate-500">By {r.created_by_name}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div>{r.course_code}</div>
                    <div className="text-[11px] text-slate-500">{r.batch_name ?? "Course-wide"}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div>{r.topic_name ?? r.chapter_name ?? "—"}</div>
                    <div className="text-[11px] text-slate-500">{r.duration_min} min</div>
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    +{r.marks_correct} / {r.marks_wrong} / {r.marks_skip}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {r.question_count} · {r.attempt_count}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        r.is_published
                          ? "rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
                          : "rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600"
                      }
                    >
                      {r.is_published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/quizzes/${r.id}`}
                        className="rounded border border-blue-300 bg-white px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                      >
                        Results
                      </Link>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          toggle(r.id, r.is_published ? "unpublish" : "publish")
                        }
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        {r.is_published ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setConfirmDelete(r)}
                        className="rounded border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {confirmDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900">Delete quiz?</h3>
            <p className="mt-2 text-sm text-slate-600">
              This permanently removes <strong>{confirmDelete.title}</strong> along
              with all its attempts and answers. This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => remove(confirmDelete.id)}
                className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
