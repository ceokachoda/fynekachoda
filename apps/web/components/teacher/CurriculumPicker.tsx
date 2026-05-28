"use client";

// Phase 4 Track 4B — cascading Course → Subject → Chapter → Topic + optional
// Batch picker. Used by the content upload form + the quiz builder scope.
// Renders 4-5 plain `<select>`s for keyboard accessibility (mobile uses bottom
// sheets; web has native selects that work everywhere and are touch-friendly
// without an extra Radix dep).

import { useMemo } from "react";
import type {
  CurriculumCourse,
  CurriculumSubject,
  CurriculumChapter,
} from "@/features/teacher/useTeacherCurriculum";

interface CurriculumPickerProps {
  courses: CurriculumCourse[];
  courseId: string | null;
  subjectId: string | null;
  chapterId: string | null;
  topicId: string | null;
  batchId: string | null;
  showBatch?: boolean;
  batchLabel?: string;
  allowCourseWide?: boolean;
  onChange: (next: {
    courseId: string | null;
    subjectId: string | null;
    chapterId: string | null;
    topicId: string | null;
    batchId: string | null;
  }) => void;
}

export function CurriculumPicker({
  courses,
  courseId,
  subjectId,
  chapterId,
  topicId,
  batchId,
  showBatch = true,
  batchLabel = "Batch",
  allowCourseWide = false,
  onChange,
}: CurriculumPickerProps) {
  const selectedCourse = useMemo<CurriculumCourse | null>(
    () => courses.find((c) => c.course_id === courseId) ?? null,
    [courses, courseId],
  );
  const selectedSubject = useMemo<CurriculumSubject | null>(
    () => selectedCourse?.subjects.find((s) => s.id === subjectId) ?? null,
    [selectedCourse, subjectId],
  );
  const selectedChapter = useMemo<CurriculumChapter | null>(
    () => selectedSubject?.chapters.find((c) => c.id === chapterId) ?? null,
    [selectedSubject, chapterId],
  );

  return (
    <div className="grid gap-3">
      {courses.length > 1 ? (
        <Field label="Course">
          <select
            className={fieldClass}
            value={courseId ?? ""}
            onChange={(e) => {
              const id = e.target.value || null;
              onChange({
                courseId: id,
                subjectId: null,
                chapterId: null,
                topicId: null,
                batchId: null,
              });
            }}
          >
            <option value="">Tap to choose</option>
            {courses.map((c) => (
              <option key={c.course_id} value={c.course_id}>
                {c.course_code} · {c.course_name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <Field label="Subject">
        <select
          className={fieldClass}
          value={subjectId ?? ""}
          disabled={!selectedCourse}
          onChange={(e) => {
            const id = e.target.value || null;
            onChange({
              courseId,
              subjectId: id,
              chapterId: null,
              topicId: null,
              batchId,
            });
          }}
        >
          <option value="">Tap to choose</option>
          {(selectedCourse?.subjects ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Chapter">
        <select
          className={fieldClass}
          value={chapterId ?? ""}
          disabled={!selectedSubject}
          onChange={(e) => {
            const id = e.target.value || null;
            onChange({
              courseId,
              subjectId,
              chapterId: id,
              topicId: null,
              batchId,
            });
          }}
        >
          <option value="">Tap to choose</option>
          {(selectedSubject?.chapters ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Topic">
        <select
          className={fieldClass}
          value={topicId ?? ""}
          disabled={!selectedChapter}
          onChange={(e) =>
            onChange({
              courseId,
              subjectId,
              chapterId,
              topicId: e.target.value || null,
              batchId,
            })
          }
        >
          <option value="">Tap to choose</option>
          {(selectedChapter?.topics ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Field>

      {showBatch ? (
        <Field label={batchLabel}>
          <select
            className={fieldClass}
            value={batchId ?? (allowCourseWide ? "__cw__" : "")}
            disabled={!selectedCourse}
            onChange={(e) => {
              const v = e.target.value;
              onChange({
                courseId,
                subjectId,
                chapterId,
                topicId,
                batchId: v === "__cw__" || v === "" ? null : v,
              });
            }}
          >
            {allowCourseWide ? (
              <option value="__cw__">Course-wide (no batch)</option>
            ) : (
              <option value="">Tap to choose</option>
            )}
            {(selectedCourse?.batches ?? []).map((b) => (
              <option key={b.batch_id} value={b.batch_id}>
                {b.batch_name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
    </div>
  );
}

const fieldClass =
  "block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
