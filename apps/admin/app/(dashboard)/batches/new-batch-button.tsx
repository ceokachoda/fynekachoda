"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { createBatchAction, type BatchMutateState } from "./actions";

const initial: BatchMutateState = {};

interface CourseOption {
  id: string;
  code: string;
  name: string;
}

export function NewBatchButton({ courses }: { courses: CourseOption[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createBatchAction, initial);
  const router = useRouter();

  useEffect(() => {
    if (state.ok && state.createdId) {
      setOpen(false);
      router.push(`/batches/${state.createdId}`);
    }
  }, [state.ok, state.createdId, router]);

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ New batch</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New batch</DialogTitle>
            <DialogDescription>
              A batch belongs to exactly one course (D-013). Students and
              schedule rows are added on the batch detail page.
            </DialogDescription>
          </DialogHeader>

          <form action={formAction} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="course_id" className="text-sm font-medium text-slate-700">Course</label>
              <select
                id="course_id"
                name="course_id"
                required
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
                defaultValue=""
              >
                <option value="" disabled>Pick a course</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                ))}
              </select>
              {state.fieldErrors?.course_id ? (
                <p className="text-xs text-red-600">{state.fieldErrors.course_id}</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <label htmlFor="name" className="text-sm font-medium text-slate-700">Name</label>
              <Input id="name" name="name" placeholder="e.g. NEET 2027 Morning" required aria-invalid={state.fieldErrors?.name ? "true" : undefined} />
              {state.fieldErrors?.name ? (
                <p className="text-xs text-red-600">{state.fieldErrors.name}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="starts_on" className="text-sm font-medium text-slate-700">Starts on</label>
                <Input id="starts_on" name="starts_on" type="date" required />
                {state.fieldErrors?.starts_on ? (
                  <p className="text-xs text-red-600">{state.fieldErrors.starts_on}</p>
                ) : null}
              </div>
              <div className="space-y-1">
                <label htmlFor="ends_on" className="text-sm font-medium text-slate-700">Ends on (optional)</label>
                <Input id="ends_on" name="ends_on" type="date" />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="capacity" className="text-sm font-medium text-slate-700">Capacity</label>
              <Input id="capacity" name="capacity" type="number" defaultValue={80} min={1} max={10000} />
            </div>

            {state.error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {state.error}
              </div>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
              <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create batch"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
