"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createChapterAction,
  createSubjectAction,
  createTopicAction,
  deleteChapterAction,
  deleteSubjectAction,
  deleteTopicAction,
  renameChapterAction,
  renameSubjectAction,
  renameTopicAction,
  type MutateState,
} from "../actions";

interface Topic {
  id: string;
  name: string;
  sort_order: number;
}
interface Chapter {
  id: string;
  name: string;
  sort_order: number;
  topics: Topic[];
}
interface Subject {
  id: string;
  name: string;
  sort_order: number;
  chapters: Chapter[];
}

interface Props {
  courseId: string;
  subjects: Subject[];
}

const initial: MutateState = {};

export function CurriculumEditor({ courseId, subjects }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Tree is Subject → Chapter → Topic. Edit names + sort order inline.
        Deletes cascade to children.
      </p>

      {subjects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500">
          No subjects yet for this course.
        </div>
      ) : (
        <ul className="space-y-2">
          {subjects.map((s) => (
            <SubjectRow key={s.id} subject={s} courseId={courseId} />
          ))}
        </ul>
      )}

      <AddSubjectForm courseId={courseId} />
    </div>
  );
}

function SubjectRow({ subject, courseId }: { subject: Subject; courseId: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <li className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? "▾" : "▸"}
        </button>
        <span className="text-xs uppercase tracking-wide text-slate-400">
          Subject
        </span>
        <InlineRename
          id={subject.id}
          courseId={courseId}
          name={subject.name}
          sortOrder={subject.sort_order}
          renameAction={renameSubjectAction}
        />
        <ChildCount label="chapter" count={subject.chapters.length} />
        <DeleteNode
          id={subject.id}
          courseId={courseId}
          deleteAction={deleteSubjectAction}
          warn="Cascades to all chapters + topics under this subject."
        />
      </div>
      {expanded ? (
        <div className="space-y-2 border-t border-slate-100 bg-slate-50 px-3 py-2">
          {subject.chapters.length === 0 ? null : (
            <ul className="space-y-2">
              {subject.chapters.map((c) => (
                <ChapterRow key={c.id} chapter={c} courseId={courseId} />
              ))}
            </ul>
          )}
          <AddChapterForm subjectId={subject.id} courseId={courseId} />
        </div>
      ) : null}
    </li>
  );
}

function ChapterRow({ chapter, courseId }: { chapter: Chapter; courseId: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <li className="rounded border border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? "▾" : "▸"}
        </button>
        <span className="text-xs uppercase tracking-wide text-slate-400">
          Chapter
        </span>
        <InlineRename
          id={chapter.id}
          courseId={courseId}
          name={chapter.name}
          sortOrder={chapter.sort_order}
          renameAction={renameChapterAction}
        />
        <ChildCount label="topic" count={chapter.topics.length} />
        <DeleteNode
          id={chapter.id}
          courseId={courseId}
          deleteAction={deleteChapterAction}
          warn="Cascades to all topics under this chapter."
        />
      </div>
      {expanded ? (
        <div className="space-y-2 border-t border-slate-100 bg-slate-50/50 px-3 py-2">
          {chapter.topics.length === 0 ? null : (
            <ul className="space-y-1.5">
              {chapter.topics.map((t) => (
                <TopicRow key={t.id} topic={t} courseId={courseId} />
              ))}
            </ul>
          )}
          <AddTopicForm chapterId={chapter.id} courseId={courseId} />
        </div>
      ) : null}
    </li>
  );
}

function TopicRow({ topic, courseId }: { topic: Topic; courseId: string }) {
  return (
    <li className="flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-1.5">
      <span className="text-xs uppercase tracking-wide text-slate-400">Topic</span>
      <InlineRename
        id={topic.id}
        courseId={courseId}
        name={topic.name}
        sortOrder={topic.sort_order}
        renameAction={renameTopicAction}
      />
      <DeleteNode
        id={topic.id}
        courseId={courseId}
        deleteAction={deleteTopicAction}
        warn="Removes the topic."
      />
    </li>
  );
}

function ChildCount({ label, count }: { label: string; count: number }) {
  return (
    <span className="ml-auto text-xs text-slate-500">
      {count} {label}
      {count === 1 ? "" : "s"}
    </span>
  );
}

function InlineRename({
  id,
  courseId,
  name,
  sortOrder,
  renameAction,
}: {
  id: string;
  courseId: string;
  name: string;
  sortOrder: number;
  renameAction: (formData: FormData) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded px-1 text-sm text-slate-800 hover:bg-slate-100"
      >
        {name}
        <span className="ml-2 text-xs text-slate-400">#{sortOrder}</span>
      </button>
    );
  }
  return (
    <form
      action={async (fd) => {
        await renameAction(fd);
        setEditing(false);
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="course_id" value={courseId} />
      <Input name="name" defaultValue={name} className="h-7 w-56 text-sm" />
      <Input
        name="sort_order"
        type="number"
        defaultValue={sortOrder}
        className="h-7 w-20 text-sm"
        min={0}
      />
      <Button type="submit" className="h-7 px-2 text-xs">
        Save
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-7 px-2 text-xs"
        onClick={() => setEditing(false)}
      >
        Cancel
      </Button>
    </form>
  );
}

function DeleteNode({
  id,
  courseId,
  deleteAction,
  warn,
}: {
  id: string;
  courseId: string;
  deleteAction: (formData: FormData) => Promise<void>;
  warn: string;
}) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
        title="Delete"
      >
        Delete
      </button>
    );
  }
  return (
    <form
      action={async (fd) => {
        await deleteAction(fd);
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="course_id" value={courseId} />
      <span className="text-xs text-red-700">{warn}</span>
      <Button type="submit" variant="destructive" className="h-7 px-2 text-xs">
        Yes, delete
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-7 px-2 text-xs"
        onClick={() => setConfirming(false)}
      >
        Cancel
      </Button>
    </form>
  );
}

function AddSubjectForm({ courseId }: { courseId: string }) {
  const [state, formAction, pending] = useActionState(createSubjectAction, initial);
  return (
    <form action={formAction} className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2">
      <input type="hidden" name="parent_id" value={courseId} />
      <span className="text-xs uppercase tracking-wide text-slate-400">+ Subject</span>
      <Input name="name" placeholder="e.g. Physics" required className="h-8 w-64" />
      <Input
        name="sort_order"
        type="number"
        defaultValue={0}
        className="h-8 w-20"
        min={0}
      />
      <Button type="submit" disabled={pending} className="h-8 text-xs">
        {pending ? "Adding…" : "Add subject"}
      </Button>
      {state.error ? (
        <span className="text-xs text-red-600">{state.error}</span>
      ) : null}
    </form>
  );
}

function AddChapterForm({
  subjectId,
  courseId,
}: {
  subjectId: string;
  courseId: string;
}) {
  const [state, formAction, pending] = useActionState(createChapterAction, initial);
  return (
    <form
      action={formAction}
      className="flex items-center gap-2 rounded border border-dashed border-slate-300 bg-white px-3 py-2"
    >
      <input type="hidden" name="parent_id" value={subjectId} />
      <input type="hidden" name="course_id" value={courseId} />
      <span className="text-xs uppercase tracking-wide text-slate-400">+ Chapter</span>
      <Input
        name="name"
        placeholder="e.g. Mechanics"
        required
        className="h-8 w-64"
      />
      <Input
        name="sort_order"
        type="number"
        defaultValue={0}
        className="h-8 w-20"
        min={0}
      />
      <Button type="submit" disabled={pending} className="h-8 text-xs">
        {pending ? "Adding…" : "Add chapter"}
      </Button>
      {state.error ? (
        <span className="text-xs text-red-600">{state.error}</span>
      ) : null}
    </form>
  );
}

function AddTopicForm({
  chapterId,
  courseId,
}: {
  chapterId: string;
  courseId: string;
}) {
  const [state, formAction, pending] = useActionState(createTopicAction, initial);
  return (
    <form
      action={formAction}
      className="flex items-center gap-2 rounded border border-dashed border-slate-300 bg-white px-3 py-2"
    >
      <input type="hidden" name="parent_id" value={chapterId} />
      <input type="hidden" name="course_id" value={courseId} />
      <span className="text-xs uppercase tracking-wide text-slate-400">+ Topic</span>
      <Input
        name="name"
        placeholder="e.g. Kinematics"
        required
        className="h-8 w-64"
      />
      <Input
        name="sort_order"
        type="number"
        defaultValue={0}
        className="h-8 w-20"
        min={0}
      />
      <Button type="submit" disabled={pending} className="h-8 text-xs">
        {pending ? "Adding…" : "Add topic"}
      </Button>
      {state.error ? (
        <span className="text-xs text-red-600">{state.error}</span>
      ) : null}
    </form>
  );
}
