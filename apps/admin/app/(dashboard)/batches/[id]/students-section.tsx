"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
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
import { transferStudentAction, type BatchMutateState } from "../actions";
import { StatusBadge } from "@/components/status-badge";

const initial: BatchMutateState = {};

interface StudentRow {
  user_id: string;
  app_users: { id: string; full_name: string; email: string; is_active: boolean } | null;
}
interface BatchOption { id: string; name: string }

export function StudentsSection({
  batchName,
  students,
  otherBatches,
}: {
  batchId: string;
  batchName: string;
  students: StudentRow[];
  otherBatches: BatchOption[];
}) {
  const [transferFor, setTransferFor] = useState<StudentRow | null>(null);
  const [state, formAction, pending] = useActionState(transferStudentAction, initial);

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Students ({students.length})</h2>
      {students.length === 0 ? (
        <p className="text-sm text-muted-foreground">No students assigned to this batch.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted border-b border-border text-left text-[11px] uppercase text-muted-foreground tracking-wide">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {students.map((s) => (
              <tr key={s.user_id} className="hover:bg-muted/30 transition-colors">
                <td className="px-3 py-3">
                  {s.app_users ? (
                    <Link href={`/students/${s.app_users.id}`} className="font-medium text-foreground hover:text-primary hover:underline transition-colors">
                      {s.app_users.full_name}
                    </Link>
                  ) : "(unknown)"}
                </td>
                <td className="px-3 py-3 text-muted-foreground">{s.app_users?.email ?? ""}</td>
                <td className="px-3 py-3">
                  <StatusBadge 
                    status={s.app_users?.is_active ? "Active" : "Suspended"} 
                    variant={s.app_users?.is_active ? "success" : "destructive"} 
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setTransferFor(s)}
                    disabled={otherBatches.length === 0}
                  >
                    Transfer
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Dialog open={transferFor !== null} onOpenChange={(open) => { if (!open) setTransferFor(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer student</DialogTitle>
            <DialogDescription>
              Moving <strong className="text-foreground font-medium">{transferFor?.app_users?.full_name}</strong> out of
              <strong className="text-foreground font-medium"> {batchName}</strong>. Past attendance and scores stay
              attached to the student.
            </DialogDescription>
          </DialogHeader>

          {transferFor ? (
            <form action={formAction} className="space-y-4 pt-2">
              <input type="hidden" name="student_id" value={transferFor.user_id} />
              <div className="space-y-2">
                <label htmlFor="to_batch_id" className="text-sm font-medium text-foreground">Target batch</label>
                <select id="to_batch_id" name="to_batch_id" required defaultValue="" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm">
                  <option value="" disabled>Pick a batch</option>
                  {otherBatches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="reason" className="text-sm font-medium text-foreground">Reason</label>
                <Input id="reason" name="reason" required minLength={3} placeholder="e.g. schedule clash" />
              </div>
              {state.error ? (
                <div className="rounded-md border border-destructive bg-destructive/15 px-3 py-2 text-sm text-destructive">{state.error}</div>
              ) : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setTransferFor(null)}>Cancel</Button>
                <Button type="submit" disabled={pending}>{pending ? "Transferring…" : "Transfer"}</Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
