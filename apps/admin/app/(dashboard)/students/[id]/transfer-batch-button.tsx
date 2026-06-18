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
  transferStudentAction,
  type BatchMutateState,
} from "../../batches/actions";

const initial: BatchMutateState = {};

interface BatchOption {
  id: string;
  name: string;
  course: string;
}

export function TransferBatchButton({
  studentId,
  currentBatchName,
  otherBatches,
}: {
  studentId: string;
  currentBatchName: string;
  otherBatches: BatchOption[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(transferStudentAction, initial);

  const disabled = otherBatches.length === 0;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-7 text-xs"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={disabled ? "No other active batches" : ""}
      >
        Transfer batch
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer to a different batch</DialogTitle>
            <DialogDescription>
              Moving the student out of <strong>{currentBatchName}</strong>.
              Past attendance and scores stay attached.
            </DialogDescription>
          </DialogHeader>

          <form action={formAction} className="space-y-4">
            <input type="hidden" name="student_id" value={studentId} />
            <div className="space-y-1.5">
              <label htmlFor="to_batch_id" className="text-sm font-medium text-foreground">Target batch</label>
              <select
                id="to_batch_id"
                name="to_batch_id"
                required
                defaultValue=""
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
              >
                <option value="" disabled>Pick a batch</option>
                {otherBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} — {b.course}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="reason" className="text-sm font-medium text-foreground">Reason</label>
              <Input id="reason" name="reason" minLength={3} required placeholder="e.g. schedule clash" />
              {state.fieldErrors?.reason ? (
                <p className="text-xs text-destructive">{state.fieldErrors.reason}</p>
              ) : null}
            </div>
            {state.error ? (
              <div className="rounded-md border border-destructive bg-destructive/15 px-3 py-2 text-sm text-destructive">{state.error}</div>
            ) : state.ok ? (
              <div className="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">Transferred. Close to refresh.</div>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Close</Button>
              <Button type="submit" disabled={pending}>{pending ? "Transferring…" : "Transfer"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
