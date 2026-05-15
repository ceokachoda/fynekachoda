"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { callEdgeFn, requireAdmin } from "@/lib/auth";

export interface BatchMutateState {
  error?: string;
  fieldErrors?: Record<string, string>;
  ok?: boolean;
  createdId?: string;
}

const BatchName = z.string().trim().min(2).max(120);
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const TimeHHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected HH:MM");
const Capacity = z.coerce.number().int().min(1).max(10_000);
const Weekday = z.coerce.number().int().min(0).max(6);
const TransferReason = z.string().trim().min(3).max(500);

function pickError(parsed: z.SafeParseError<unknown>): BatchMutateState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const field = String(issue.path[0] ?? "");
    if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
  }
  return { error: "Check the form.", fieldErrors };
}

async function callMutate(body: unknown): Promise<{ status: number; data: { ok?: boolean; row?: { id?: string }; error?: string; detail?: unknown } }> {
  const session = await requireAdmin();
  return await callEdgeFn<{ ok: boolean; row?: { id?: string } }>("batch-mutate", body, session.access_token);
}

async function callTransfer(body: unknown): Promise<{ status: number; data: { error?: string; detail?: unknown } }> {
  const session = await requireAdmin();
  return await callEdgeFn<{ error?: string }>("batch-transfer", body, session.access_token);
}

function failureFor(result: { status: number; data: { error?: string; detail?: unknown } }): BatchMutateState {
  if (result.status === 409) return { error: result.data?.error ?? "Conflict." };
  if (result.status === 404) return { error: result.data?.error ?? "Not found." };
  if (result.status === 400 && result.data?.detail) {
    return { error: `Validation failed: ${JSON.stringify(result.data.detail)}` };
  }
  return { error: `Failed (status ${result.status}): ${result.data?.error ?? "unknown"}` };
}

const CreateBatchForm = z.object({
  course_id: z.string().uuid(),
  name: BatchName,
  starts_on: IsoDate,
  ends_on: z.string().optional().or(z.literal("")),
  capacity: Capacity.default(80),
});

export async function createBatchAction(
  _prev: BatchMutateState,
  formData: FormData,
): Promise<BatchMutateState> {
  const parsed = CreateBatchForm.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return pickError(parsed);

  const payload: Record<string, unknown> = {
    course_id: parsed.data.course_id,
    name: parsed.data.name,
    starts_on: parsed.data.starts_on,
    capacity: parsed.data.capacity,
  };
  if (parsed.data.ends_on) payload.ends_on = parsed.data.ends_on;

  const result = await callMutate({ op: "create_batch", payload });
  if (result.status !== 200) return failureFor(result);
  revalidatePath("/batches");
  return { ok: true, createdId: result.data.row?.id };
}

const UpdateBatchForm = z.object({
  id: z.string().uuid(),
  name: BatchName.optional(),
  starts_on: IsoDate.optional().or(z.literal("")),
  ends_on: z.string().optional().or(z.literal("")),
  capacity: Capacity.optional(),
  is_active: z.enum(["true", "false"]).optional(),
});

export async function updateBatchAction(
  _prev: BatchMutateState,
  formData: FormData,
): Promise<BatchMutateState> {
  const parsed = UpdateBatchForm.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return pickError(parsed);

  const patch: Record<string, unknown> = {};
  if (parsed.data.name) patch.name = parsed.data.name;
  if (parsed.data.starts_on) patch.starts_on = parsed.data.starts_on;
  if (parsed.data.ends_on !== undefined && parsed.data.ends_on !== "") {
    patch.ends_on = parsed.data.ends_on;
  } else if (parsed.data.ends_on === "") {
    patch.ends_on = null;
  }
  if (parsed.data.capacity !== undefined) patch.capacity = parsed.data.capacity;
  if (parsed.data.is_active !== undefined) patch.is_active = parsed.data.is_active === "true";

  if (Object.keys(patch).length === 0) return { error: "Nothing to update." };

  const result = await callMutate({ op: "update_batch", id: parsed.data.id, patch });
  if (result.status !== 200) return failureFor(result);
  revalidatePath("/batches");
  revalidatePath(`/batches/${parsed.data.id}`);
  return { ok: true };
}

const IdOnly = z.object({ id: z.string().uuid() });

export async function deleteBatchAction(
  _prev: BatchMutateState,
  formData: FormData,
): Promise<BatchMutateState> {
  const parsed = IdOnly.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Bad request." };
  const result = await callMutate({ op: "delete_batch", id: parsed.data.id });
  if (result.status !== 200) return failureFor(result);
  revalidatePath("/batches");
  redirect("/batches");
}

const AssignTeacherForm = z.object({
  batch_id: z.string().uuid(),
  teacher_id: z.string().uuid(),
});

export async function assignTeacherAction(
  _prev: BatchMutateState,
  formData: FormData,
): Promise<BatchMutateState> {
  const parsed = AssignTeacherForm.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return pickError(parsed);
  const result = await callMutate({ op: "assign_teacher", batch_id: parsed.data.batch_id, teacher_id: parsed.data.teacher_id });
  if (result.status !== 200) return failureFor(result);
  revalidatePath(`/batches/${parsed.data.batch_id}`);
  return { ok: true };
}

export async function unassignTeacherAction(formData: FormData): Promise<void> {
  const parsed = AssignTeacherForm.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return;
  await callMutate({ op: "unassign_teacher", batch_id: parsed.data.batch_id, teacher_id: parsed.data.teacher_id });
  revalidatePath(`/batches/${parsed.data.batch_id}`);
}

const ScheduleRowForm = z.object({
  batch_id: z.string().uuid(),
  weekday: Weekday,
  start_time: TimeHHMM,
  end_time: TimeHHMM,
  subject_id: z.string().uuid().optional().or(z.literal("")),
});

export async function addScheduleRowAction(
  _prev: BatchMutateState,
  formData: FormData,
): Promise<BatchMutateState> {
  const parsed = ScheduleRowForm.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return pickError(parsed);
  const payload: Record<string, unknown> = {
    batch_id: parsed.data.batch_id,
    weekday: parsed.data.weekday,
    start_time: parsed.data.start_time,
    end_time: parsed.data.end_time,
  };
  if (parsed.data.subject_id && parsed.data.subject_id !== "") {
    payload.subject_id = parsed.data.subject_id;
  }
  const result = await callMutate({ op: "create_schedule_row", payload });
  if (result.status !== 200) return failureFor(result);
  revalidatePath(`/batches/${parsed.data.batch_id}`);
  return { ok: true };
}

const ScheduleRowDeleteForm = z.object({
  id: z.string().uuid(),
  batch_id: z.string().uuid(),
});

export async function deleteScheduleRowAction(formData: FormData): Promise<void> {
  const parsed = ScheduleRowDeleteForm.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return;
  await callMutate({ op: "delete_schedule_row", id: parsed.data.id });
  revalidatePath(`/batches/${parsed.data.batch_id}`);
}

const TransferForm = z.object({
  student_id: z.string().uuid(),
  to_batch_id: z.string().uuid(),
  reason: TransferReason,
  // optional return-path hint for revalidation
  origin_path: z.string().optional(),
});

export async function transferStudentAction(
  _prev: BatchMutateState,
  formData: FormData,
): Promise<BatchMutateState> {
  const parsed = TransferForm.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return pickError(parsed);
  const result = await callTransfer({
    student_id: parsed.data.student_id,
    to_batch_id: parsed.data.to_batch_id,
    reason: parsed.data.reason,
  });
  if (result.status !== 200) return failureFor(result);
  revalidatePath("/students");
  revalidatePath(`/students/${parsed.data.student_id}`);
  revalidatePath("/batches");
  revalidatePath(`/batches/${parsed.data.to_batch_id}`);
  return { ok: true };
}
