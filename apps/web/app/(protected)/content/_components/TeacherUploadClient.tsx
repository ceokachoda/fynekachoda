"use client";

// Phase 4 Track 4B — teacher /content. Pick Video URL vs PDF, scope via the
// shared CurriculumPicker, then either content-create-video or
// content-presign-upload → PUT (progress bar) → content-finalize.

import { useEffect, useMemo, useState } from "react";
import { FileText, PlayCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/fyne/PageHeader";
import { Pill } from "@/components/fyne/Pill";
import { CurriculumPicker } from "@/components/teacher/CurriculumPicker";
import { useTeacherCurriculum } from "@/features/teacher/useTeacherCurriculum";
import {
  putBlobWithProgress,
  useContentCreateVideo,
  useContentFinalize,
  useContentPresignUpload,
} from "@/features/teacher/mutations";
import { cn } from "@/lib/utils";

type Kind = "video" | "pdf";
type Scope = "batch" | "suggest";

export function TeacherUploadClient() {
  const curriculum = useTeacherCurriculum();
  const [kind, setKind] = useState<Kind>("video");
  const [scope, setScope] = useState<Scope>("batch");
  const [courseId, setCourseId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ytUrl, setYtUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState<{ tone: "ok" | "err"; msg: string } | null>(
    null,
  );

  const courses = curriculum.data ?? [];
  const onlyCourse = courses.length === 1 ? courses[0] : null;

  // Auto-pick the only course.
  useEffect(() => {
    if (onlyCourse && !courseId) {
      setCourseId(onlyCourse.course_id);
    }
  }, [onlyCourse, courseId]);

  const video = useContentCreateVideo();
  const presign = useContentPresignUpload();
  const finalize = useContentFinalize();

  const canSubmit = useMemo(() => {
    if (!topicId || title.trim().length === 0) return false;
    if (scope === "batch" && !batchId) return false;
    if (kind === "video" && ytUrl.trim().length === 0) return false;
    if (kind === "pdf" && !file) return false;
    return true;
  }, [topicId, title, scope, batchId, kind, ytUrl, file]);

  const reset = () => {
    setTitle("");
    setDescription("");
    setYtUrl("");
    setFile(null);
    setProgress(0);
  };

  const submit = async () => {
    if (!topicId) return;
    setSubmitting(true);
    setInfo(null);
    const effectiveBatch = scope === "batch" ? batchId : undefined;
    try {
      if (kind === "video") {
        const out = await video.mutateAsync({
          yt_url_or_id: ytUrl.trim(),
          topic_id: topicId,
          title: title.trim(),
          description: description.trim() || undefined,
          batch_id: effectiveBatch ?? undefined,
        });
        setInfo({
          tone: "ok",
          msg:
            out.yt_verified === false
              ? "Linked. (YT verification is currently disabled — admin will review.)"
              : "Video linked successfully.",
        });
        reset();
      } else {
        if (!file) {
          setInfo({ tone: "err", msg: "Pick a PDF first." });
          return;
        }
        if (file.size > 50 * 1024 * 1024) {
          setInfo({ tone: "err", msg: "Max 50 MB per file." });
          return;
        }
        const mime = file.type || "application/pdf";
        const pre = await presign.mutateAsync({
          kind: "pdf",
          topic_id: topicId,
          title: title.trim(),
          batch_id: effectiveBatch ?? undefined,
          content_size_bytes: file.size,
          mime_type: mime,
        });
        await putBlobWithProgress(pre.upload_url, file, mime, setProgress);
        await finalize.mutateAsync({
          kind: "pdf",
          topic_id: topicId,
          title: title.trim(),
          description: description.trim() || undefined,
          batch_id: effectiveBatch ?? undefined,
          file_path: pre.path,
          file_size_bytes: file.size,
          mime_type: mime,
        });
        setInfo({ tone: "ok", msg: "Uploaded — content added to library." });
        reset();
      }
    } catch (e) {
      setInfo({
        tone: "err",
        msg: e instanceof Error ? e.message : "Upload failed.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (curriculum.isLoading && !curriculum.data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Upload content" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Upload content"
        description="Add a YouTube video link or a PDF for your students."
      />

      <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4">
        <p className="text-[11px] font-bold uppercase text-slate-500">Kind</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { v: "video", label: "Video", icon: PlayCircle },
              { v: "pdf", label: "PDF", icon: FileText },
            ] as const
          ).map((opt) => {
            const Icon = opt.icon;
            const active = kind === opt.v;
            return (
              <button
                key={opt.v}
                type="button"
                onClick={() => setKind(opt.v)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold",
                  active
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-slate-200 bg-white text-slate-700",
                )}
              >
                <Icon className="size-4" />
                {opt.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-4">
        <CurriculumPicker
          courses={courses}
          courseId={courseId}
          subjectId={subjectId}
          chapterId={chapterId}
          topicId={topicId}
          batchId={batchId}
          showBatch={scope === "batch"}
          onChange={(next) => {
            setCourseId(next.courseId);
            setSubjectId(next.subjectId);
            setChapterId(next.chapterId);
            setTopicId(next.topicId);
            setBatchId(next.batchId);
          }}
        />
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4">
        <p className="text-[11px] font-bold uppercase text-slate-500">Scope</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { v: "batch", label: "My Batch" },
              { v: "suggest", label: "Suggest course-wide" },
            ] as const
          ).map((opt) => {
            const active = scope === opt.v;
            return (
              <button
                key={opt.v}
                type="button"
                onClick={() => setScope(opt.v)}
                className={cn(
                  "rounded-xl border px-4 py-2 text-sm font-bold",
                  active
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-slate-200 bg-white text-slate-700",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {scope === "suggest" ? (
          <p className="text-xs text-slate-500">
            Admin reviews course-wide suggestions before students see them.
          </p>
        ) : null}
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4">
        <p className="text-[11px] font-bold uppercase text-slate-500">Title</p>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Intro to Projectile Motion"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={3}
          className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
        />
        {kind === "video" ? (
          <Input
            value={ytUrl}
            onChange={(e) => setYtUrl(e.target.value)}
            placeholder="https://youtu.be/…  (must be Unlisted on institute channel)"
          />
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center">
            <FileText className="mx-auto mb-2 size-6 text-slate-400" />
            <label className="cursor-pointer">
              <span className="text-sm font-bold text-slate-800">
                {file ? file.name : "Pick a PDF (max 50 MB)"}
              </span>
              <input
                type="file"
                accept="application/pdf"
                hidden
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {file ? (
              <p className="mt-1 text-xs text-slate-500">
                {(file.size / (1024 * 1024)).toFixed(1)} MB
              </p>
            ) : null}
          </div>
        )}
        {submitting && kind === "pdf" && progress > 0 && progress < 100 ? (
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-primary transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">Uploading {progress}%…</p>
          </div>
        ) : null}
      </section>

      {info ? (
        <Pill tone={info.tone === "ok" ? "success" : "error"}>{info.msg}</Pill>
      ) : null}

      <Button onClick={submit} disabled={!canSubmit || submitting} size="lg">
        {submitting ? (
          <>
            <Loader2 className="mr-1 size-3 animate-spin" />
            Uploading…
          </>
        ) : (
          "Upload"
        )}
      </Button>
    </div>
  );
}
