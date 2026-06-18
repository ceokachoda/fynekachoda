"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteCourseAction,
  updateCourseAction,
  type MutateState,
} from "../actions";

const initial: MutateState = {};

interface Props {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
}

export function CourseOverviewForm({ id, name, description, isActive }: Props) {
  const [state, formAction, pending] = useActionState(updateCourseAction, initial);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteCourseAction, initial);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm">
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="id" value={id} />

        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium text-foreground">
            Name
          </label>
          <Input
            id="name"
            name="name"
            defaultValue={name}
            aria-invalid={state.fieldErrors?.name ? "true" : undefined}
          />
          {state.fieldErrors?.name ? (
            <p className="text-xs text-destructive">{state.fieldErrors.name}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="description" className="text-sm font-medium text-foreground">
            Description
          </label>
          <Input
            id="description"
            name="description"
            defaultValue={description}
            placeholder="(empty)"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="is_active" className="text-sm font-medium text-foreground">
            Status
          </label>
          <select
            id="is_active"
            name="is_active"
            defaultValue={isActive ? "true" : "false"}
            className="flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>

        {state.error ? (
          <div className="rounded-md border border-destructive bg-destructive/15 px-3 py-2 text-sm text-destructive">
            {state.error}
          </div>
        ) : state.ok ? (
          <div className="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
            Saved.
          </div>
        ) : null}

        <div className="flex items-center justify-between border-t border-border pt-5">
          <Button
            type="button"
            variant="outline"
            onClick={() => setConfirmDelete(true)}
          >
            Delete course
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this course?</DialogTitle>
            <DialogDescription>
              All subjects, chapters, and topics under <strong>{name}</strong>{" "}
              will be deleted (cascade). Any batches still referencing it will
              block the delete with a foreign-key error.
            </DialogDescription>
          </DialogHeader>

          <form action={deleteAction} className="space-y-4 pt-2">
            <input type="hidden" name="id" value={id} />
            {deleteState.error ? (
              <div className="rounded-md border border-destructive bg-destructive/15 px-3 py-2 text-sm text-destructive">
                {deleteState.error}
              </div>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmDelete(false)}
                disabled={deletePending}
              >
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={deletePending}>
                {deletePending ? "Deleting…" : "Delete"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
