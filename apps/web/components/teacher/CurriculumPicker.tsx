"use client";

// Phase 4 Track 4B — cascading Course → Subject → Chapter → Topic + optional
// Batch picker. Used by the content upload form + the quiz builder scope.
// Built on NativeSelect (styled native <select>s) — keyboard-accessible, touch-
// friendly, and immune to the clipping a custom popover hits inside a scroll
// container. Each select stays disabled until its parent is chosen.

import { useMemo } from "react";
import { NativeSelect } from "@/components/ui/native-select";
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
          <NativeSelect
            value={courseId ?? ""}
            onChange={(e) =>
              onChange({
                courseId: e.target.value || null,
                subjectId: null,
                chapterId: null,
                topicId: null,
                batchId: null,
              })
            }
          >
            <option value="">Select course</option>
            {courses.map((c) => (
              <option key={c.course_id} value={c.course_id}>
                {c.course_code} · {c.course_name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      ) : null}

      <Field label="Subject">
        <NativeSelect
          value={subjectId ?? ""}
          disabled={!selectedCourse}
          onChange={(e) =>
            onChange({
              courseId,
              subjectId: e.target.value || null,
              chapterId: null,
              topicId: null,
              batchId,
            })
          }
        >
          <option value="">Select subject</option>
          {(selectedCourse?.subjects ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <Field label="Chapter">
        <NativeSelect
          value={chapterId ?? ""}
          disabled={!selectedSubject}
          onChange={(e) =>
            onChange({
              courseId,
              subjectId,
              chapterId: e.target.value || null,
              topicId: null,
              batchId,
            })
          }
        >
          <option value="">Select chapter</option>
          {(selectedSubject?.chapters ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <Field label="Topic">
        <NativeSelect
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
          <option value="">Select topic</option>
          {(selectedChapter?.topics ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </NativeSelect>
      </Field>

      {showBatch ? (
        <Field label={batchLabel}>
          <NativeSelect
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
              <option value="">Select batch</option>
            )}
            {(selectedCourse?.batches ?? []).map((b) => (
              <option key={b.batch_id} value={b.batch_id}>
                {b.batch_name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      ) : null}
    </div>
  );
}

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
