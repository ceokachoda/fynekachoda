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
            <div className="space-y-1">
              <label htmlFor="to_batch_id" className="text-sm font-medium text-slate-700">Target batch</label>
              <select
                id="to_batch_id"
                name="to_batch_id"
                required
                defaultValue=""
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
              >
                <option value="" disabled>Pick a batch</option>
                {otherBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} — {b.course}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="reason" className="text-sm font-medium text-slate-700">Reason</label>
              <Input id="reason" name="reason" minLength={3} required placeholder="e.g. schedule clash" />
              {state.fieldErrors?.reason ? (
                <p className="text-xs text-red-600">{state.fieldErrors.reason}</p>
              ) : null}
            </div>
            {state.error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>
            ) : state.ok ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Transferred. Close to refresh.</div>
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
