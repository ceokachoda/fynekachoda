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
  dob: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
    .optional()
    .or(z.literal("")),
  gender: z
    .enum(["male", "female", "other", "prefer_not"])
    .optional()
    .or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  school_name: z.string().trim().max(200).optional().or(z.literal("")),
  board: z.string().trim().max(50).optional().or(z.literal("")),
  current_class: z.string().trim().max(50).optional().or(z.literal("")),
  parent_phone_1: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s\-()]{7,20}$/, "Invalid phone number")
    .optional()
    .or(z.literal("")),
  parent_phone_2: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s\-()]{7,20}$/, "Invalid phone number")
    .optional()
    .or(z.literal("")),
  parent_consent_method: z
    .enum(["verbal", "written", "form"])
    .optional()
    .or(z.literal("")),
});

export interface CreateStudentState {
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

export async function createStudentAction(
  _prev: CreateStudentState,
  formData: FormData,
): Promise<CreateStudentState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = FormSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    return { error: "Check the form below.", fieldErrors };
  }

  const session = await requireAdmin();

  const payload = {
    role: "student" as const,
    full_name: parsed.data.full_name,
    email: parsed.data.email,
    phone: nilIfBlank(parsed.data.phone),
    dob: nilIfBlank(parsed.data.dob),
    gender: nilIfBlank(parsed.data.gender),
    address: nilIfBlank(parsed.data.address),
    school_name: nilIfBlank(parsed.data.school_name),
    board: nilIfBlank(parsed.data.board),
    current_class: nilIfBlank(parsed.data.current_class),
    parent_phone_1: nilIfBlank(parsed.data.parent_phone_1),
    parent_phone_2: nilIfBlank(parsed.data.parent_phone_2),
    parent_consent_method: nilIfBlank(parsed.data.parent_consent_method),
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
    return { error: `Could not create student: ${detail}` };
  }

  const created = result.data as {
    user_id: string;
    email: string;
    initial_password: string;
  };

  revalidatePath("/students");
  return {
    created: {
      user_id: created.user_id,
      email: created.email,
      initial_password: created.initial_password,
    },
  };
}
