"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { callEdgeFn, requireAdmin } from "@/lib/auth";

export interface AttendanceCorrectState {
  error?: string;
  ok?: boolean;
}

const CorrectForm = z.object({
  attendance_id: z.string().uuid(),
  new_status: z.enum(["present", "late", "absent"]),
  reason: z.string().trim().min(3).max(500),
  from: z.string().optional(),
  to: z.string().optional(),
  batch: z.string().uuid().optional(),
});

export async function correctAttendanceAction(
  _prev: AttendanceCorrectState,
  formData: FormData,
): Promise<AttendanceCorrectState> {
  const parsed = CorrectForm.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: "Pick a new status and add a reason (3+ chars)." };
  }
  const session = await requireAdmin();
  const result = await callEdgeFn<{ error?: string }>(
    "attendance-correct",
    {
      attendance_id: parsed.data.attendance_id,
      new_status: parsed.data.new_status,
      reason: parsed.data.reason,
    },
    session.access_token,
  );
  if (result.status !== 200) {
    const data = result.data as { error?: string };
    if (result.status === 409) return { error: "Status already matches." };
    if (result.status === 404) return { error: "Attendance row not found." };
    if (result.status === 403) return { error: "Not allowed to correct this row." };
    return { error: data?.error ?? `Failed (status ${result.status}).` };
  }
  revalidatePath("/attendance");
  return { ok: true };
}
