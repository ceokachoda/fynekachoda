"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  assignTeacherAction,
  type BatchMutateState,
} from "../../batches/actions";

const initial: BatchMutateState = {};

interface BatchOption {
  id: string;
  name: string;
  course: string;
}

export function AssignBatchButton({
  teacherId,
  available,
}: {
  teacherId: string;
  available: BatchOption[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(assignTeacherAction, initial);

  const disabled = available.length === 0;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-7 text-xs"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={disabled ? "All active batches already assigned" : ""}
      >
        + Assign batch
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign to a batch</DialogTitle>
            <DialogDescription>
              The teacher gets read access to that batch&apos;s students (RLS
              policy). Multiple batches are fine; an MVP teacher can teach
              several cohorts.
            </DialogDescription>
          </DialogHeader>

          <form action={formAction} className="space-y-4">
            <input type="hidden" name="teacher_id" value={teacherId} />
            <div className="space-y-1">
              <label htmlFor="batch_id" className="text-sm font-medium text-slate-700">Batch</label>
              <select
                id="batch_id"
                name="batch_id"
                required
                defaultValue=""
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
              >
                <option value="" disabled>Pick a batch</option>
                {available.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} — {b.course}</option>
                ))}
              </select>
            </div>
            {state.error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>
            ) : state.ok ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Assigned. Close to refresh.</div>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Close</Button>
              <Button type="submit" disabled={pending}>{pending ? "Assigning…" : "Assign"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
