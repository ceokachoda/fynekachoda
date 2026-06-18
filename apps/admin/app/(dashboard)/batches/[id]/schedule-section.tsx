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
    <section className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
        Schedule ({rows.length} rows)
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No schedule entries yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted border-b border-border text-left text-[11px] uppercase text-muted-foreground tracking-wide">
            <tr>
              <th className="px-3 py-2">Day</th>
              <th className="px-3 py-2">Start</th>
              <th className="px-3 py-2">End</th>
              <th className="px-3 py-2">Subject</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-3 py-3 font-medium text-foreground">{WEEKDAYS[r.weekday]}</td>
                <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{r.start_time}</td>
                <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{r.end_time}</td>
                <td className="px-3 py-3 text-foreground">{r.subjects?.name ?? "—"}</td>
                <td className="px-3 py-3 text-right">
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

      <form action={formAction} className="grid items-end gap-3 border-t border-border pt-4 md:grid-cols-5">
        <input type="hidden" name="batch_id" value={batchId} />
        <div className="space-y-2">
          <label htmlFor="weekday" className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Day</label>
          <select id="weekday" name="weekday" defaultValue="1" required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm">
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={i}>{d}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="start_time" className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Start</label>
          <Input id="start_time" name="start_time" type="time" required />
        </div>
        <div className="space-y-2">
          <label htmlFor="end_time" className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">End</label>
          <Input id="end_time" name="end_time" type="time" required />
        </div>
        <div className="space-y-2">
          <label htmlFor="subject_id" className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Subject (optional)</label>
          <select id="subject_id" name="subject_id" defaultValue="" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm">
            <option value="">—</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={pending} className="h-9">{pending ? "Adding…" : "Add row"}</Button>
      </form>
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </section>
  );
}
