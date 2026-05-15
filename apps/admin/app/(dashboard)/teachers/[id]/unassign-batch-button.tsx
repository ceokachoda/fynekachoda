"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { unassignTeacherAction } from "../../batches/actions";

export function UnassignBatchButton({
  batchId,
  teacherId,
  batchName,
}: {
  batchId: string;
  teacherId: string;
  batchName: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-7 text-xs"
        onClick={() => setOpen(true)}
      >
        Unassign
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unassign from {batchName}?</DialogTitle>
            <DialogDescription>
              The teacher will lose RLS access to that batch&apos;s students
              going forward. Past attendance / sessions remain intact.
            </DialogDescription>
          </DialogHeader>
          <form action={unassignTeacherAction}>
            <input type="hidden" name="batch_id" value={batchId} />
            <input type="hidden" name="teacher_id" value={teacherId} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" variant="destructive">Unassign</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
