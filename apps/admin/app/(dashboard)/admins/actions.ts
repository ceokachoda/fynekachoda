"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { callEdgeFn, requireOwnerAdmin } from "@/lib/auth";

const FormSchema = z.object({
  full_name: z.string().trim().min(2, "Enter a name").max(100),
  email: z.string().email("Enter a valid email").toLowerCase().trim(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s\-()]{7,20}$/, "Invalid phone number")
    .optional()
    .or(z.literal("")),
  role: z.enum(["staff_admin", "owner_admin"]),
});

export interface CreateAdminState {
  error?: string;
  fieldErrors?: Record<string, string>;
  created?: { email: string; role: string; initial_password: string };
}

export async function createAdminAction(
  _prev: CreateAdminState,
  formData: FormData,
): Promise<CreateAdminState> {
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

  // Owner-only: auth-bootstrap also enforces this server-side, but we gate here
  // so a staff_admin never even reaches the edge function.
  const session = await requireOwnerAdmin();

  const result = await callEdgeFn<{
    email: string;
    role: string;
    initial_password: string;
  }>(
    "auth-bootstrap",
    {
      role: parsed.data.role,
      full_name: parsed.data.full_name,
      email: parsed.data.email,
      phone: parsed.data.phone === "" ? undefined : parsed.data.phone,
    },
    session.access_token,
  );

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
    return { error: `Could not create admin: ${detail}` };
  }

  const created = result.data as {
    email: string;
    role: string;
    initial_password: string;
  };

  revalidatePath("/admins");
  return {
    created: {
      email: created.email,
      role: created.role,
      initial_password: created.initial_password,
    },
  };
}
