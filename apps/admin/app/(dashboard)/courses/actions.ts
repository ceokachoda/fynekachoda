"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { callEdgeFn, requireAdmin } from "@/lib/auth";

export interface MutateState {
  error?: string;
  fieldErrors?: Record<string, string>;
  ok?: boolean;
  createdId?: string;
}

const Code = z.string().trim().min(2).max(30).regex(/^[A-Z][A-Z0-9_]*$/, "code must be UPPER_SNAKE_CASE");
const CourseName = z.string().trim().min(2).max(120);
const NodeName = z.string().trim().min(1).max(120);
const SortOrder = z.coerce.number().int().min(0).max(10_000);

function pickError(parsed: z.SafeParseError<unknown>): MutateState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const field = String(issue.path[0] ?? "");
    if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
  }
  return { error: "Check the form.", fieldErrors };
}

async function callMutate(body: unknown): Promise<{ status: number; data: { ok?: boolean; row?: { id?: string }; error?: string; detail?: unknown } }> {
  const session = await requireAdmin();
  const result = await callEdgeFn<{ ok: boolean; row?: { id?: string } }>(
    "curriculum-mutate",
    body,
    session.access_token,
  );
  return result;
}

function failureFor(result: { status: number; data: { error?: string; detail?: unknown } }): MutateState {
  if (result.status === 409) {
    return {
      error: "Already exists. Pick a different code/name.",
      fieldErrors: { code: "Already used" },
    };
  }
  if (result.status === 400 && result.data?.detail) {
    return { error: `Validation failed: ${JSON.stringify(result.data.detail)}` };
  }
  return { error: `Failed (status ${result.status}): ${result.data?.error ?? "unknown"}` };
}

const CreateCourseForm = z.object({
  code: Code,
  name: CourseName,
  description: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function createCourseAction(
  _prev: MutateState,
  formData: FormData,
): Promise<MutateState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = CreateCourseForm.safeParse(raw);
  if (!parsed.success) return pickError(parsed);

  const result = await callMutate({
    op: "create_course",
    payload: {
      code: parsed.data.code,
      name: parsed.data.name,
      description: parsed.data.description || undefined,
    },
  });
  if (result.status !== 200) return failureFor(result);

  revalidatePath("/courses");
  return { ok: true, createdId: result.data.row?.id };
}

const UpdateCourseForm = z.object({
  id: z.string().uuid(),
  name: CourseName.optional(),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  is_active: z.enum(["true", "false"]).optional(),
});

export async function updateCourseAction(
  _prev: MutateState,
  formData: FormData,
): Promise<MutateState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = UpdateCourseForm.safeParse(raw);
  if (!parsed.success) return pickError(parsed);

  const patch: Record<string, unknown> = {};
  if (parsed.data.name) patch.name = parsed.data.name;
  if (parsed.data.description !== undefined) {
    patch.description = parsed.data.description === "" ? null : parsed.data.description;
  }
  if (parsed.data.is_active !== undefined) {
    patch.is_active = parsed.data.is_active === "true";
  }

  if (Object.keys(patch).length === 0) {
    return { error: "Nothing to update." };
  }

  const result = await callMutate({ op: "update_course", id: parsed.data.id, patch });
  if (result.status !== 200) return failureFor(result);

  revalidatePath("/courses");
  revalidatePath(`/courses/${parsed.data.id}`);
  return { ok: true };
}

const IdOnly = z.object({ id: z.string().uuid() });

export async function deleteCourseAction(
  _prev: MutateState,
  formData: FormData,
): Promise<MutateState> {
  const parsed = IdOnly.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Bad request." };
  const result = await callMutate({ op: "delete_course", id: parsed.data.id });
  if (result.status !== 200) return failureFor(result);
  revalidatePath("/courses");
  redirect("/courses");
}

const NodeCreateForm = z.object({
  parent_id: z.string().uuid(),
  name: NodeName,
  sort_order: SortOrder.default(0),
});

export async function createSubjectAction(
  _prev: MutateState,
  formData: FormData,
): Promise<MutateState> {
  const parsed = NodeCreateForm.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return pickError(parsed);
  const result = await callMutate({
    op: "create_subject",
    payload: { course_id: parsed.data.parent_id, name: parsed.data.name, sort_order: parsed.data.sort_order },
  });
  if (result.status !== 200) return failureFor(result);
  revalidatePath(`/courses/${parsed.data.parent_id}`);
  return { ok: true, createdId: result.data.row?.id };
}

export async function createChapterAction(
  _prev: MutateState,
  formData: FormData,
): Promise<MutateState> {
  const parsed = NodeCreateForm.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return pickError(parsed);
  const result = await callMutate({
    op: "create_chapter",
    payload: { subject_id: parsed.data.parent_id, name: parsed.data.name, sort_order: parsed.data.sort_order },
  });
  if (result.status !== 200) return failureFor(result);
  const courseId = formData.get("course_id");
  if (typeof courseId === "string") revalidatePath(`/courses/${courseId}`);
  return { ok: true, createdId: result.data.row?.id };
}

export async function createTopicAction(
  _prev: MutateState,
  formData: FormData,
): Promise<MutateState> {
  const parsed = NodeCreateForm.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return pickError(parsed);
  const result = await callMutate({
    op: "create_topic",
    payload: { chapter_id: parsed.data.parent_id, name: parsed.data.name, sort_order: parsed.data.sort_order },
  });
  if (result.status !== 200) return failureFor(result);
  const courseId = formData.get("course_id");
  if (typeof courseId === "string") revalidatePath(`/courses/${courseId}`);
  return { ok: true, createdId: result.data.row?.id };
}

const NodeUpdateForm = z.object({
  id: z.string().uuid(),
  name: NodeName.optional(),
  sort_order: SortOrder.optional(),
  course_id: z.string().uuid(),
});

export async function renameSubjectAction(formData: FormData): Promise<void> {
  const parsed = NodeUpdateForm.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return;
  const patch: Record<string, unknown> = {};
  if (parsed.data.name) patch.name = parsed.data.name;
  if (parsed.data.sort_order !== undefined) patch.sort_order = parsed.data.sort_order;
  if (Object.keys(patch).length === 0) return;
  await callMutate({ op: "update_subject", id: parsed.data.id, patch });
  revalidatePath(`/courses/${parsed.data.course_id}`);
}

export async function renameChapterAction(formData: FormData): Promise<void> {
  const parsed = NodeUpdateForm.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return;
  const patch: Record<string, unknown> = {};
  if (parsed.data.name) patch.name = parsed.data.name;
  if (parsed.data.sort_order !== undefined) patch.sort_order = parsed.data.sort_order;
  if (Object.keys(patch).length === 0) return;
  await callMutate({ op: "update_chapter", id: parsed.data.id, patch });
  revalidatePath(`/courses/${parsed.data.course_id}`);
}

export async function renameTopicAction(formData: FormData): Promise<void> {
  const parsed = NodeUpdateForm.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return;
  const patch: Record<string, unknown> = {};
  if (parsed.data.name) patch.name = parsed.data.name;
  if (parsed.data.sort_order !== undefined) patch.sort_order = parsed.data.sort_order;
  if (Object.keys(patch).length === 0) return;
  await callMutate({ op: "update_topic", id: parsed.data.id, patch });
  revalidatePath(`/courses/${parsed.data.course_id}`);
}

const NodeDeleteForm = z.object({
  id: z.string().uuid(),
  course_id: z.string().uuid(),
});

export async function deleteSubjectAction(formData: FormData): Promise<void> {
  const parsed = NodeDeleteForm.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return;
  await callMutate({ op: "delete_subject", id: parsed.data.id });
  revalidatePath(`/courses/${parsed.data.course_id}`);
}

export async function deleteChapterAction(formData: FormData): Promise<void> {
  const parsed = NodeDeleteForm.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return;
  await callMutate({ op: "delete_chapter", id: parsed.data.id });
  revalidatePath(`/courses/${parsed.data.course_id}`);
}

export async function deleteTopicAction(formData: FormData): Promise<void> {
  const parsed = NodeDeleteForm.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return;
  await callMutate({ op: "delete_topic", id: parsed.data.id });
  revalidatePath(`/courses/${parsed.data.course_id}`);
}
