"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { callEdgeFn, requireAdmin } from "@/lib/auth";

export interface ContentActionState {
  error?: string;
  ok?: boolean;
}

const TogglePublishForm = z.object({
  content_id: z.string().uuid(),
  next: z.enum(["publish", "unpublish"]),
});

export async function togglePublishAction(
  _prev: ContentActionState,
  formData: FormData,
): Promise<ContentActionState> {
  const parsed = TogglePublishForm.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Invalid request." };
  const session = await requireAdmin();
  const result = await callEdgeFn<{ error?: string }>(
    "content-toggle-publish",
    {
      content_id: parsed.data.content_id,
      is_published: parsed.data.next === "publish",
    },
    session.access_token,
  );
  if (result.status !== 200) {
    const d = result.data as { error?: string };
    return { error: d?.error ?? `Failed (status ${result.status}).` };
  }
  revalidatePath("/content");
  return { ok: true };
}

const PromoteForm = z.object({
  content_id: z.string().uuid(),
  action: z.enum(["promote", "unpromote"]),
  batch_id: z.string().uuid().optional(),
});

export async function promoteAction(
  _prev: ContentActionState,
  formData: FormData,
): Promise<ContentActionState> {
  const parsed = PromoteForm.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Invalid request." };
  const session = await requireAdmin();
  const result = await callEdgeFn<{ error?: string }>(
    "content-promote-coursewide",
    {
      content_id: parsed.data.content_id,
      promote: parsed.data.action === "promote",
      batch_id: parsed.data.batch_id,
    },
    session.access_token,
  );
  if (result.status !== 200) {
    const d = result.data as { error?: string };
    return { error: d?.error ?? `Failed (status ${result.status}).` };
  }
  revalidatePath("/content");
  return { ok: true };
}

const DeleteForm = z.object({
  content_id: z.string().uuid(),
});

export async function deleteContentAction(
  _prev: ContentActionState,
  formData: FormData,
): Promise<ContentActionState> {
  const parsed = DeleteForm.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Invalid request." };
  const session = await requireAdmin();
  // Per CLAUDE.md: every admin write through an edge fn so audit_log captures
  // before/after. content-delete snapshots the row before deletion.
  const result = await callEdgeFn<{ error?: string }>(
    "content-delete",
    { content_id: parsed.data.content_id },
    session.access_token,
  );
  if (result.status !== 200) {
    const d = result.data as { error?: string };
    return { error: d?.error ?? `Failed (status ${result.status}).` };
  }
  revalidatePath("/content");
  return { ok: true };
}
