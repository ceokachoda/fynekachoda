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
import { createCourseAction, type MutateState } from "./actions";

const initial: MutateState = {};

export function NewCourseButton() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createCourseAction, initial);
  const router = useRouter();

  useEffect(() => {
    if (state.ok && state.createdId) {
      setOpen(false);
      router.push(`/courses/${state.createdId}`);
    }
  }, [state.ok, state.createdId, router]);

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ New course</Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New course</DialogTitle>
            <DialogDescription>
              The code is the institute-internal identifier (e.g.{" "}
              <code className="rounded bg-slate-100 px-1">JEE_MAIN</code>).
              Uppercase, underscores allowed. Name is the human-readable label.
            </DialogDescription>
          </DialogHeader>

          <form action={formAction} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="code" className="text-sm font-medium text-slate-700">
                Code
              </label>
              <Input
                id="code"
                name="code"
                placeholder="JEE_MAIN"
                required
                aria-invalid={state.fieldErrors?.code ? "true" : undefined}
              />
              {state.fieldErrors?.code ? (
                <p className="text-xs text-red-600">{state.fieldErrors.code}</p>
              ) : (
                <p className="text-xs text-slate-500">
                  UPPER_SNAKE_CASE, 2–30 chars.
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="name" className="text-sm font-medium text-slate-700">
                Name
              </label>
              <Input
                id="name"
                name="name"
                placeholder="JEE Main"
                required
                aria-invalid={state.fieldErrors?.name ? "true" : undefined}
              />
              {state.fieldErrors?.name ? (
                <p className="text-xs text-red-600">{state.fieldErrors.name}</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <label
                htmlFor="description"
                className="text-sm font-medium text-slate-700"
              >
                Description{" "}
                <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <Input id="description" name="description" />
            </div>

            {state.error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {state.error}
              </div>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Creating…" : "Create course"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
