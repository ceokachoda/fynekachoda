"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addScheduleRowAction,
  deleteScheduleRowAction,
  type BatchMutateState,
} from "../actions";

const initial: BatchMutateState = {};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

interface ScheduleRow {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  subject_id: string | null;
  subjects: { name: string } | null;
}
interface SubjectOption { id: string; name: string }

export function ScheduleSection({
  batchId,
  rows,
  subjects,
}: {
  batchId: string;
  rows: ScheduleRow[];
  subjects: SubjectOption[];
}) {
  const [state, formAction, pending] = useActionState(addScheduleRowAction, initial);
  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-xs uppercase tracking-wide text-slate-500">
        Schedule ({rows.length} rows)
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No schedule entries yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Day</th>
              <th className="px-3 py-2 font-medium">Start</th>
              <th className="px-3 py-2 font-medium">End</th>
              <th className="px-3 py-2 font-medium">Subject</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 text-slate-700">{WEEKDAYS[r.weekday]}</td>
                <td className="px-3 py-2 font-mono text-xs text-slate-700">{r.start_time}</td>
                <td className="px-3 py-2 font-mono text-xs text-slate-700">{r.end_time}</td>
                <td className="px-3 py-2 text-slate-700">{r.subjects?.name ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  <form action={deleteScheduleRowAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="batch_id" value={batchId} />
                    <Button type="submit" variant="outline" className="h-7 text-xs">Remove</Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form action={formAction} className="grid items-end gap-2 border-t border-slate-100 pt-3 md:grid-cols-5">
        <input type="hidden" name="batch_id" value={batchId} />
        <div className="space-y-1">
          <label htmlFor="weekday" className="text-xs uppercase tracking-wide text-slate-500">Day</label>
          <select id="weekday" name="weekday" defaultValue="1" required className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm">
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={i}>{d}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="start_time" className="text-xs uppercase tracking-wide text-slate-500">Start</label>
          <Input id="start_time" name="start_time" type="time" required />
        </div>
        <div className="space-y-1">
          <label htmlFor="end_time" className="text-xs uppercase tracking-wide text-slate-500">End</label>
          <Input id="end_time" name="end_time" type="time" required />
        </div>
        <div className="space-y-1">
          <label htmlFor="subject_id" className="text-xs uppercase tracking-wide text-slate-500">Subject (optional)</label>
          <select id="subject_id" name="subject_id" defaultValue="" className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm">
            <option value="">—</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add row"}</Button>
      </form>
      {state.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
    </section>
  );
}
