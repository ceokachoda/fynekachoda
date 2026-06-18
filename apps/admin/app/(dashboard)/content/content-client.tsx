"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BatchOpt, ContentItem, CourseOpt } from "./page";
import {
  deleteContentAction,
  promoteAction,
  togglePublishAction,
} from "./actions";
import { DataTableLayout } from "@/components/data-table-layout";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { FileVideo } from "lucide-react";

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
      {errMsg ? (
        <div className="rounded border border-destructive bg-destructive/15 px-3 py-2 text-sm text-destructive">
          {errMsg}
        </div>
      ) : null}

      <DataTableLayout
        filters={
          <div className="flex flex-wrap items-end gap-3 w-full">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
                Course
              </label>
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
              <label className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
                Batch
              </label>
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
              <label className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
                Kind
              </label>
              <select
                value={filters.kind}
                onChange={(e) => setFilter("kind", e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">All kinds</option>
                <option value="video">Video</option>
                <option value="pdf">PDF</option>
                <option value="note">Note</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilter("status", e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">All statuses</option>
                <option value="published">Published</option>
                <option value="unpublished">Pending</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
              <label className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
                Search
              </label>
              <input
                type="text"
                placeholder="Title contains…"
                defaultValue={filters.q}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setFilter("q", e.currentTarget.value);
                }}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <Button variant="outline" onClick={exportCsv} className="h-9">
              Export CSV
            </Button>
          </div>
        }
      >
        {items.length === 0 ? (
          <EmptyState
            icon={FileVideo}
            title="No content found"
            description="Adjust your filters or wait for teachers to upload new content."
          />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-muted border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
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
          <tbody className="divide-y divide-border">
              {items.map((it) => (
                <tr key={it.id} className="align-top hover:bg-muted/50 transition-colors">
                  <td className="px-3 py-3">
                    <div className="font-medium text-foreground">{it.title}</div>
                    {it.description ? (
                      <div className="text-xs text-muted-foreground mt-1">
                        {it.description.slice(0, 120)}
                        {it.description.length > 120 ? "…" : ""}
                      </div>
                    ) : null}
                    {it.yt_video_id ? (
                      <div className="mt-1 text-[11px] text-muted-foreground/70">
                        YT id: <code>{it.yt_video_id}</code>
                      </div>
                    ) : null}
                    {it.file_path ? (
                      <div className="mt-1 text-[11px] text-muted-foreground/70 break-all">
                        path: <code>{it.file_path}</code>
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 uppercase text-xs font-semibold text-muted-foreground">
                    {it.kind}
                  </td>
                  <td className="px-3 py-3 text-xs">
                    <div className="font-medium text-foreground">{it.course_code}</div>
                    <div className="text-muted-foreground">{it.subject_name}</div>
                    <div className="text-muted-foreground">{it.chapter_name}</div>
                    <div className="text-muted-foreground">{it.topic_name}</div>
                  </td>
                  <td className="px-3 py-3 text-xs">
                    {it.batch_id
                      ? (
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-foreground font-medium border border-border">
                          {it.batch_name}
                        </span>
                      )
                      : (
                        <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-primary font-medium">
                          course-wide
                        </span>
                      )}
                  </td>
                  <td className="px-3 py-3 text-xs text-foreground font-medium">{it.uploader_name}</td>
                  <td className="px-3 py-3 text-xs">
                    <StatusBadge status={it.is_published ? "Published" : "Pending"} variant={it.is_published ? "success" : "warning"} />
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    {new Date(it.created_at).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                    })}
                  </td>
                  <td className="px-3 py-3 space-y-1.5">
                    <button
                      disabled={pending}
                      onClick={() =>
                        submit(
                          it.is_published ? "unpublish" : "publish",
                          it.id,
                        )}
                      className="block w-full rounded border border-border bg-card px-2 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      {it.is_published ? "Unpublish" : "Publish"}
                    </button>
                    {it.batch_id
                      ? (
                        <button
                          disabled={pending}
                          onClick={() => promote("promote", it.id)}
                          className="block w-full rounded bg-primary/10 px-2 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                        >
                          Promote course-wide
                        </button>
                      )
                      : (
                        <details className="block group">
                          <summary className="cursor-pointer rounded border border-border bg-card px-2 py-1.5 text-xs font-medium text-foreground list-none hover:bg-muted transition-colors">
                            Scope to batch…
                          </summary>
                          <div className="mt-1 flex flex-col gap-1 p-1 bg-card border border-border rounded shadow-sm">
                            {batches
                              .filter((b) => b.course_id === it.course_id)
                              .map((b) => (
                                <button
                                  key={b.id}
                                  disabled={pending}
                                  onClick={() =>
                                    promote("unpromote", it.id, b.id)}
                                  className="rounded bg-transparent px-2 py-1 text-xs text-left text-foreground hover:bg-muted transition-colors disabled:opacity-50"
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
                      className="block w-full rounded bg-destructive/10 px-2 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DataTableLayout>

      {confirmDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="rounded-xl bg-card border border-border p-6 shadow-xl max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-foreground">
              Delete content?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              This removes <strong className="text-foreground font-medium">{confirmDelete.title}</strong> permanently
              from the library. Storage objects remain (orphaned).
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={pending}
                onClick={() => removeItem(confirmDelete.id)}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
