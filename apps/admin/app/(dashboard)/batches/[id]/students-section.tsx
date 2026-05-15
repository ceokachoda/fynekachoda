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
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-xs uppercase tracking-wide text-slate-500">Students ({students.length})</h2>
      {students.length === 0 ? (
        <p className="text-sm text-slate-500">No students assigned to this batch.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {students.map((s) => (
              <tr key={s.user_id}>
                <td className="px-3 py-2">
                  {s.app_users ? (
                    <Link href={`/students/${s.app_users.id}`} className="font-medium text-slate-900 hover:text-blue-600 hover:underline">
                      {s.app_users.full_name}
                    </Link>
                  ) : "(unknown)"}
                </td>
                <td className="px-3 py-2 text-slate-600">{s.app_users?.email ?? ""}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${s.app_users?.is_active ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                    {s.app_users?.is_active ? "Active" : "Suspended"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-7 text-xs"
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
              Moving <strong>{transferFor?.app_users?.full_name}</strong> out of
              <strong> {batchName}</strong>. Past attendance and scores stay
              attached to the student.
            </DialogDescription>
          </DialogHeader>

          {transferFor ? (
            <form action={formAction} className="space-y-4">
              <input type="hidden" name="student_id" value={transferFor.user_id} />
              <div className="space-y-1">
                <label htmlFor="to_batch_id" className="text-sm font-medium text-slate-700">Target batch</label>
                <select id="to_batch_id" name="to_batch_id" required defaultValue="" className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm">
                  <option value="" disabled>Pick a batch</option>
                  {otherBatches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="reason" className="text-sm font-medium text-slate-700">Reason</label>
                <Input id="reason" name="reason" required minLength={3} placeholder="e.g. schedule clash" />
              </div>
              {state.error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>
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
