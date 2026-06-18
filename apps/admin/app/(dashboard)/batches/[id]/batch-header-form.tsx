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
  deleteBatchAction,
  updateBatchAction,
  type BatchMutateState,
} from "../actions";

const initial: BatchMutateState = {};

interface Props {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string | null;
  capacity: number;
  isActive: boolean;
}

export function BatchHeaderForm({ id, name, startsOn, endsOn, capacity, isActive }: Props) {
  const [state, formAction, pending] = useActionState(updateBatchAction, initial);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteBatchAction, initial);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Batch details</h2>
      <form action={formAction} className="grid gap-5 md:grid-cols-2">
        <input type="hidden" name="id" value={id} />

        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium text-foreground">Name</label>
          <Input id="name" name="name" defaultValue={name} aria-invalid={state.fieldErrors?.name ? "true" : undefined} />
          {state.fieldErrors?.name ? <p className="text-xs text-destructive">{state.fieldErrors.name}</p> : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="capacity" className="text-sm font-medium text-foreground">Capacity</label>
          <Input id="capacity" name="capacity" type="number" defaultValue={capacity} min={1} max={10000} />
        </div>

        <div className="space-y-2">
          <label htmlFor="starts_on" className="text-sm font-medium text-foreground">Starts on</label>
          <Input id="starts_on" name="starts_on" type="date" defaultValue={startsOn} />
        </div>

        <div className="space-y-2">
          <label htmlFor="ends_on" className="text-sm font-medium text-foreground">Ends on</label>
          <Input id="ends_on" name="ends_on" type="date" defaultValue={endsOn ?? ""} />
        </div>

        <div className="space-y-2">
          <label htmlFor="is_active" className="text-sm font-medium text-foreground">Status</label>
          <select
            id="is_active"
            name="is_active"
            defaultValue={isActive ? "true" : "false"}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>

        <div className="md:col-span-2">
          {state.error ? (
            <div className="rounded-md border border-destructive bg-destructive/15 px-3 py-2 text-sm text-destructive">{state.error}</div>
          ) : state.ok ? (
            <div className="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">Saved.</div>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-border pt-5 md:col-span-2">
          <Button type="button" variant="outline" onClick={() => setConfirmDelete(true)}>Delete batch</Button>
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
        </div>
      </form>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this batch?</DialogTitle>
            <DialogDescription>
              Only possible if no students or schedule rows reference it. If
              they do, the delete will fail with a 409 error — transfer the
              students out first or use the inactive toggle to soft-disable.
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
              <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)} disabled={deletePending}>
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
