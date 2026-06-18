"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  assignTeacherAction,
  unassignTeacherAction,
  type BatchMutateState,
} from "../actions";

const initial: BatchMutateState = {};

interface TeacherAssigned {
  user_id: string;
  subjects: string[] | null;
  app_users: { full_name: string; email: string } | null;
}
interface TeacherOption {
  user_id: string;
  full_name: string;
}

interface Props {
  batchId: string;
  assigned: TeacherAssigned[];
  allTeachers: TeacherOption[];
}

export function TeachersSection({ batchId, assigned, allTeachers }: Props) {
  const [state, formAction, pending] = useActionState(assignTeacherAction, initial);
  const assignedIds = new Set(assigned.map((a) => a.user_id));
  const available = allTeachers.filter((t) => !assignedIds.has(t.user_id));
  const [picked, setPicked] = useState<string>("");

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
          Teachers ({assigned.length})
        </h2>
      </div>

      {assigned.length === 0 ? (
        <p className="text-sm text-muted-foreground">No teachers assigned yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {assigned.map((t) => (
            <li key={t.user_id} className="flex items-center justify-between py-3 hover:bg-muted/30 transition-colors -mx-2 px-2 rounded-md">
              <div>
                <p className="text-sm font-medium text-foreground">{t.app_users?.full_name ?? "(unknown)"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t.app_users?.email ?? ""}
                  {t.subjects && t.subjects.length > 0 ? ` · ${t.subjects.join(", ")}` : ""}
                </p>
              </div>
              <form action={unassignTeacherAction}>
                <input type="hidden" name="batch_id" value={batchId} />
                <input type="hidden" name="teacher_id" value={t.user_id} />
                <Button type="submit" variant="outline" size="sm" className="h-8 text-xs">Unassign</Button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="flex items-end gap-3 border-t border-border pt-4">
        <input type="hidden" name="batch_id" value={batchId} />
        <div className="flex-1 space-y-2">
          <label htmlFor="teacher_id" className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Assign teacher</label>
          <select
            id="teacher_id"
            name="teacher_id"
            required
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          >
            <option value="" disabled>{available.length === 0 ? "All teachers already assigned" : "Pick a teacher"}</option>
            {available.map((t) => (
              <option key={t.user_id} value={t.user_id}>{t.full_name}</option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={pending || picked === ""} className="h-9">
          {pending ? "Assigning…" : "Assign"}
        </Button>
      </form>
      {state.error ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}
    </section>
  );
}
