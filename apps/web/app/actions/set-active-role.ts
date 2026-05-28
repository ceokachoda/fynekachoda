"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { ACTIVE_ROLE_COOKIE, type ActiveRole } from "@/lib/auth";

const Input = z.object({
  role: z.union([z.literal("student"), z.literal("teacher")]),
});

export async function setActiveRoleAction(formData: FormData): Promise<void> {
  const parsed = Input.safeParse({ role: formData.get("role") });
  if (!parsed.success) redirect("/role-chooser");

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ROLE_COOKIE, parsed.data.role as ActiveRole, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
  revalidatePath("/", "layout");
  redirect("/");
}
