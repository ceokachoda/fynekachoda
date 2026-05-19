"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BatchOpt, ContentItem, CourseOpt } from "./page";
import {
  deleteContentAction,
  promoteAction,
  togglePublishAction,
} from "./actions";

interface Props {
  items: ContentItem[];
  courses: CourseOpt[];
  batches: BatchOpt[];
  filters: {
    course: string;
    batch: string;
    kind: string;
    status: string;
    q: string;
  };
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(items: ContentItem[]): string {
  const header = [
    "id",
    "kind",
    "title",
    "course",
    "batch",
    "subject",
    "chapter",
    "topic",
    "uploader",
    "is_published",
    "yt_video_id",
    "file_path",
    "created_at",
  ].join(",");
  const rows = items.map((i) =>
    [
      i.id,
      i.kind,
      csvEscape(i.title),
      i.course_code,
      i.batch_name ?? "(course-wide)",
      csvEscape(i.subject_name),
      csvEscape(i.chapter_name),
      csvEscape(i.topic_name),
      csvEscape(i.uploader_name),
      i.is_published ? "yes" : "no",
      i.yt_video_id ?? "",
      i.file_path ?? "",
      i.created_at,
    ].join(",")
  );
  return [header, ...rows].join("\n");
}

export function ContentModerationClient({
  items,
  courses,
  batches,
  filters,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ContentItem | null>(null);

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

  const submit = (action: "publish" | "unpublish", id: string) => {
    setErrMsg(null);
    startTransition(async () => {
      const form = new FormData();
      form.set("content_id", id);
      form.set("next", action);
      const r = await togglePublishAction({}, form);
      if (r.error) setErrMsg(r.error);
    });
  };

  const promote = (
    action: "promote" | "unpromote",
    id: string,
    batchId?: string,
  ) => {
    setErrMsg(null);
    startTransition(async () => {
      const form = new FormData();
      form.set("content_id", id);
      form.set("action", action);
      if (batchId) form.set("batch_id", batchId);
      const r = await promoteAction({}, form);
      if (r.error) setErrMsg(r.error);
    });
  };

  const removeItem = (id: string) => {
    setErrMsg(null);
    startTransition(async () => {
      const form = new FormData();
      form.set("content_id", id);
      const r = await deleteContentAction({}, form);
      if (r.error) setErrMsg(r.error);
      setConfirmDelete(null);
    });
  };

  const exportCsv = () => {
    const blob = new Blob([rowsToCsv(items)], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `content-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div>
          <label className="block text-[10px] uppercase text-slate-500">
            Course
          </label>
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
          <label className="block text-[10px] uppercase text-slate-500">
            Batch
          </label>
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
          <label className="block text-[10px] uppercase text-slate-500">
            Kind
          </label>
          <select
            value={filters.kind}
            onChange={(e) => setFilter("kind", e.target.value)}
            className="rounded border-slate-300 px-2 py-1 text-sm"
          >
            <option value="">All</option>
            <option value="video">Video</option>
            <option value="pdf">PDF</option>
            <option value="note">Note</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase text-slate-500">
            Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => setFilter("status", e.target.value)}
            className="rounded border-slate-300 px-2 py-1 text-sm"
          >
            <option value="">All</option>
            <option value="published">Published</option>
            <option value="unpublished">Unpublished</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-[10px] uppercase text-slate-500">
            Search
          </label>
          <input
            type="text"
            placeholder="Title contains…"
            defaultValue={filters.q}
            onKeyDown={(e) => {
              if (e.key === "Enter") setFilter("q", e.currentTarget.value);
            }}
            className="w-full rounded border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <button
          onClick={exportCsv}
          className="rounded bg-slate-100 px-3 py-1.5 text-sm hover:bg-slate-200"
        >
          Export CSV
        </button>
      </div>

      {errMsg ? (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errMsg}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 font-semibold">Title</th>
              <th className="px-3 py-2 font-semibold">Kind</th>
              <th className="px-3 py-2 font-semibold">Path</th>
              <th className="px-3 py-2 font-semibold">Scope</th>
              <th className="px-3 py-2 font-semibold">Uploader</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">Created</th>
              <th className="px-3 py-2 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                  No content matches.
                </td>
              </tr>
            ) : (
              items.map((it) => (
                <tr key={it.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{it.title}</div>
                    {it.description ? (
                      <div className="text-xs text-slate-500">
                        {it.description.slice(0, 120)}
                        {it.description.length > 120 ? "…" : ""}
                      </div>
                    ) : null}
                    {it.yt_video_id ? (
                      <div className="mt-1 text-[11px] text-slate-400">
                        YT id: <code>{it.yt_video_id}</code>
                      </div>
                    ) : null}
                    {it.file_path ? (
                      <div className="mt-1 text-[11px] text-slate-400 break-all">
                        path: <code>{it.file_path}</code>
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 uppercase text-xs text-slate-700">
                    {it.kind}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <div>{it.course_code}</div>
                    <div className="text-slate-500">{it.subject_name}</div>
                    <div className="text-slate-500">{it.chapter_name}</div>
                    <div className="text-slate-500">{it.topic_name}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {it.batch_id
                      ? (
                        <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-slate-700">
                          {it.batch_name}
                        </span>
                      )
                      : (
                        <span className="inline-flex items-center rounded bg-emerald-100 px-2 py-0.5 text-emerald-700">
                          course-wide
                        </span>
                      )}
                  </td>
                  <td className="px-3 py-2 text-xs">{it.uploader_name}</td>
                  <td className="px-3 py-2 text-xs">
                    {it.is_published
                      ? (
                        <span className="inline-flex rounded bg-green-100 px-2 py-0.5 text-green-700">
                          Published
                        </span>
                      )
                      : (
                        <span className="inline-flex rounded bg-amber-100 px-2 py-0.5 text-amber-700">
                          Pending
                        </span>
                      )}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {new Date(it.created_at).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                    })}
                  </td>
                  <td className="px-3 py-2 space-y-1">
                    <button
                      disabled={pending}
                      onClick={() =>
                        submit(
                          it.is_published ? "unpublish" : "publish",
                          it.id,
                        )}
                      className="block w-full rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200"
                    >
                      {it.is_published ? "Unpublish" : "Publish"}
                    </button>
                    {it.batch_id
                      ? (
                        <button
                          disabled={pending}
                          onClick={() => promote("promote", it.id)}
                          className="block w-full rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
                        >
                          Promote course-wide
                        </button>
                      )
                      : (
                        <details className="block">
                          <summary className="cursor-pointer rounded bg-slate-50 px-2 py-1 text-xs text-slate-700 list-none">
                            Scope to batch…
                          </summary>
                          <div className="mt-1 flex flex-col gap-1">
                            {batches
                              .filter((b) => b.course_id === it.course_id)
                              .map((b) => (
                                <button
                                  key={b.id}
                                  disabled={pending}
                                  onClick={() =>
                                    promote("unpromote", it.id, b.id)}
                                  className="rounded bg-slate-100 px-2 py-0.5 text-xs hover:bg-slate-200"
                                >
                                  {b.name}
                                </button>
                              ))}
                          </div>
                        </details>
                      )}
                    <button
                      disabled={pending}
                      onClick={() => setConfirmDelete(it)}
                      className="block w-full rounded bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {confirmDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-xl bg-white p-6 shadow-lg max-w-md">
            <h2 className="text-lg font-semibold text-slate-900">
              Delete content?
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              This removes <strong>{confirmDelete.title}</strong> permanently
              from the library. Storage objects remain (orphaned).
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                disabled={pending}
                onClick={() => setConfirmDelete(null)}
                className="rounded border border-slate-200 px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                disabled={pending}
                onClick={() => removeItem(confirmDelete.id)}
                className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
