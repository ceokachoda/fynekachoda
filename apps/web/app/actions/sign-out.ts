"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ACTIVE_ROLE_COOKIE } from "@/lib/auth";

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  // Drop the active-role cookie too so a multi-role user picks again next time.
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_ROLE_COOKIE);
  revalidatePath("/", "layout");
  redirect("/login");
}
