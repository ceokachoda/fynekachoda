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
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-wide text-slate-500">
          Teachers ({assigned.length})
        </h2>
      </div>

      {assigned.length === 0 ? (
        <p className="text-sm text-slate-500">No teachers assigned yet.</p>
      ) : (
        <ul className="divide-y divide-slate-200">
          {assigned.map((t) => (
            <li key={t.user_id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-slate-900">{t.app_users?.full_name ?? "(unknown)"}</p>
                <p className="text-xs text-slate-500">
                  {t.app_users?.email ?? ""}
                  {t.subjects && t.subjects.length > 0 ? ` · ${t.subjects.join(", ")}` : ""}
                </p>
              </div>
              <form action={unassignTeacherAction}>
                <input type="hidden" name="batch_id" value={batchId} />
                <input type="hidden" name="teacher_id" value={t.user_id} />
                <Button type="submit" variant="outline" className="h-8 text-xs">Unassign</Button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="flex items-end gap-2 border-t border-slate-100 pt-3">
        <input type="hidden" name="batch_id" value={batchId} />
        <div className="flex-1 space-y-1">
          <label htmlFor="teacher_id" className="text-xs uppercase tracking-wide text-slate-500">Assign teacher</label>
          <select
            id="teacher_id"
            name="teacher_id"
            required
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
          >
            <option value="" disabled>{available.length === 0 ? "All teachers already assigned" : "Pick a teacher"}</option>
            {available.map((t) => (
              <option key={t.user_id} value={t.user_id}>{t.full_name}</option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={pending || picked === ""}>
          {pending ? "Assigning…" : "Assign"}
        </Button>
      </form>
      {state.error ? (
        <p className="text-xs text-red-600">{state.error}</p>
      ) : null}
    </section>
  );
}
