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
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Tree is Subject → Chapter → Topic. Edit names + sort order inline.
        Deletes cascade to children.
      </p>

      {subjects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-8 text-center text-sm text-muted-foreground">
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
    <li className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted transition-colors"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? "▾" : "▸"}
        </button>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
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
        <div className="space-y-3 border-t border-border bg-muted/20 px-4 py-3">
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
    <li className="rounded-md border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted transition-colors"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? "▾" : "▸"}
        </button>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
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
        <div className="space-y-2 border-t border-border bg-muted/30 px-4 py-3">
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
    <li className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Topic</span>
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
    <span className="ml-auto text-[11px] font-medium text-muted-foreground">
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
        className="rounded px-2 py-0.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
      >
        {name}
        <span className="ml-2 text-[10px] text-muted-foreground">#{sortOrder}</span>
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
        className="rounded px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
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
      <span className="text-[11px] text-destructive mr-2">{warn}</span>
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
    <form action={formAction} className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-card/50 px-4 py-3">
      <input type="hidden" name="parent_id" value={courseId} />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">+ Subject</span>
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
        <span className="text-xs text-destructive">{state.error}</span>
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
      className="flex items-center gap-3 rounded-md border border-dashed border-border bg-card/50 px-4 py-3"
    >
      <input type="hidden" name="parent_id" value={subjectId} />
      <input type="hidden" name="course_id" value={courseId} />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">+ Chapter</span>
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
        <span className="text-xs text-destructive">{state.error}</span>
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
      className="flex items-center gap-3 rounded-md border border-dashed border-border bg-card/50 px-4 py-3"
    >
      <input type="hidden" name="parent_id" value={chapterId} />
      <input type="hidden" name="course_id" value={courseId} />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">+ Topic</span>
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
        <span className="text-xs text-destructive">{state.error}</span>
      ) : null}
    </form>
  );
}
