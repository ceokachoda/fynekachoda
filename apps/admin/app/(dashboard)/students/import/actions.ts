"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { callEdgeFn, requireAdmin } from "@/lib/auth";

const RowSchema = z.object({
  full_name: z.string().trim().min(2),
  email: z.string().email().toLowerCase().trim(),
  phone: z.string().trim().optional(),
  dob: z.string().trim().optional(),
  gender: z.string().trim().optional(),
  address: z.string().trim().optional(),
  school_name: z.string().trim().optional(),
  board: z.string().trim().optional(),
  current_class: z.string().trim().optional(),
  parent_phone_1: z.string().trim().optional(),
  parent_phone_2: z.string().trim().optional(),
  parent_consent_method: z.string().trim().optional(),
});

const ImportSchema = z.object({
  batch_id: z.string().uuid(),
  rows: z.array(RowSchema).min(1).max(100),
});

export interface ImportResult {
  error?: string;
  report?: {
    created: { email: string; initial_password: string }[];
    failed: { email: string; reason: string }[];
    total: number;
  };
}

function blank(v?: string): string | undefined {
  return v && v.trim() !== "" ? v.trim() : undefined;
}

// Reuses the audited `auth-bootstrap` edge fn per row. Sequential on purpose:
// keeps us under the public rate limit and well within the 60s action budget
// at the 100-row cap.
export async function importStudentsAction(
  payload: unknown,
): Promise<ImportResult> {
  const parsed = ImportSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: "Invalid import payload. Re-check the file and try again." };
  }
  const session = await requireAdmin();
  const { batch_id, rows } = parsed.data;

  const created: { email: string; initial_password: string }[] = [];
  const failed: { email: string; reason: string }[] = [];

  for (const row of rows) {
    const res = await callEdgeFn<{ email: string; initial_password: string }>(
      "auth-bootstrap",
      {
        role: "student",
        full_name: row.full_name,
        email: row.email,
        phone: blank(row.phone),
        dob: blank(row.dob),
        gender: blank(row.gender),
        address: blank(row.address),
        school_name: blank(row.school_name),
        board: blank(row.board),
        current_class: blank(row.current_class),
        parent_phone_1: blank(row.parent_phone_1),
        parent_phone_2: blank(row.parent_phone_2),
        parent_consent_method: blank(row.parent_consent_method),
        batch_id,
      },
      session.access_token,
    );

    if (res.status === 200) {
      const d = res.data as { email: string; initial_password: string };
      created.push({ email: d.email, initial_password: d.initial_password });
    } else if (res.status === 409) {
      failed.push({ email: row.email, reason: "Email already in use" });
    } else {
      const detail =
        typeof res.data === "object" && res.data && "error" in res.data
          ? String((res.data as { error: unknown }).error)
          : `status ${res.status}`;
      failed.push({ email: row.email, reason: detail });
    }
  }

  revalidatePath("/students");
  return { report: { created, failed, total: rows.length } };
}
