"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CourseOpt, QuestionRow } from "./page";
import { archiveQuestionAction, deleteQuestionAction } from "./actions";

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
          <label className="block text-[10px] uppercase text-slate-500">Difficulty</label>
          <select
            value={filters.difficulty}
            onChange={(e) => setFilter("difficulty", e.target.value)}
            className="rounded border-slate-300 px-2 py-1 text-sm"
          >
            <option value="">All</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
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
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-[10px] uppercase text-slate-500">Search</label>
          <input
            defaultValue={filters.q}
            onKeyDown={(e) => {
              if (e.key === "Enter") setFilter("q", (e.target as HTMLInputElement).value);
            }}
            placeholder="Prompt contains…"
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
              <th className="px-3 py-2">Prompt</th>
              <th className="px-3 py-2">Topic</th>
              <th className="px-3 py-2">Difficulty</th>
              <th className="px-3 py-2">Options</th>
              <th className="px-3 py-2">Used in</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                  No questions match the filters.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 max-w-[400px]">
                    <div className="line-clamp-3 text-slate-900" title={r.prompt_md}>
                      {r.prompt_md}
                    </div>
                    <div className="text-[11px] text-slate-500">By {r.created_by_name}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div>{r.topic_name ?? "—"}</div>
                    <div className="text-[11px] text-slate-500">
                      {r.subject_name ? `${r.subject_name} · ${r.chapter_name}` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {r.difficulty ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        {r.difficulty.toUpperCase()}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {r.option_count} ({r.correct_option_count} correct)
                  </td>
                  <td className="px-3 py-2 tabular-nums">{r.use_count} quiz(zes)</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        r.is_archived
                          ? "rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700"
                          : "rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
                      }
                    >
                      {r.is_archived ? "Archived" : "Active"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          archive(r.id, r.is_archived ? "unarchive" : "archive")
                        }
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        {r.is_archived ? "Unarchive" : "Archive"}
                      </button>
                      <button
                        type="button"
                        disabled={pending || r.use_count > 0}
                        onClick={() => setConfirmDelete(r)}
                        title={r.use_count > 0 ? "Used by a quiz — archive instead" : ""}
                        className="rounded border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-40"
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
            <h3 className="text-lg font-semibold text-slate-900">Delete question?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Permanently remove this question and its options + solution. This cannot
              be undone.
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
