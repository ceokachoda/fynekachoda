"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { callEdgeFn, requireAdmin } from "@/lib/auth";

const FormSchema = z.object({
  full_name: z.string().trim().min(2, "Enter a name").max(100),
  email: z.string().email("Enter a valid email").toLowerCase().trim(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s\-()]{7,20}$/, "Invalid phone number")
    .optional()
    .or(z.literal("")),
  subjects: z.string().trim().max(500).optional().or(z.literal("")),
  bio: z.string().trim().max(2000).optional().or(z.literal("")),
});

export interface CreateTeacherState {
  error?: string;
  fieldErrors?: Record<string, string>;
  created?: {
    user_id: string;
    email: string;
    initial_password: string;
  };
}

function nilIfBlank<T extends string | undefined>(v: T): T | undefined {
  return v === "" || v === undefined ? undefined : v;
}

function parseSubjects(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 20);
}

export async function createTeacherAction(
  _prev: CreateTeacherState,
  formData: FormData,
): Promise<CreateTeacherState> {
  const parsed = FormSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const f = String(issue.path[0] ?? "");
      if (f && !fieldErrors[f]) fieldErrors[f] = issue.message;
    }
    return { error: "Check the form below.", fieldErrors };
  }

  const session = await requireAdmin();
  const payload = {
    role: "teacher" as const,
    full_name: parsed.data.full_name,
    email: parsed.data.email,
    phone: nilIfBlank(parsed.data.phone),
    subjects: parseSubjects(parsed.data.subjects),
    bio: nilIfBlank(parsed.data.bio),
  };

  const result = await callEdgeFn<{
    user_id: string;
    email: string;
    initial_password: string;
  }>("auth-bootstrap", payload, session.access_token);

  if (result.status === 409) {
    return {
      error: "That email is already in use by another account.",
      fieldErrors: { email: "Email already in use" },
    };
  }
  if (result.status !== 200) {
    const detail =
      typeof result.data === "object" && result.data && "error" in result.data
        ? String((result.data as { error: unknown }).error)
        : `status ${result.status}`;
    return { error: `Could not create teacher: ${detail}` };
  }

  const created = result.data as {
    user_id: string;
    email: string;
    initial_password: string;
  };

  revalidatePath("/teachers");
  return {
    created: {
      user_id: created.user_id,
      email: created.email,
      initial_password: created.initial_password,
    },
  };
}
