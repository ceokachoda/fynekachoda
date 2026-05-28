"use client";

import { useMutation } from "@tanstack/react-query";
import { invokeEdgeFn } from "@/lib/edge-fn";

// D-153: web NEVER calls supabase.auth.updateUser({ password }). The
// auth-change-own-password edge fn rotates the password + clears
// must_change_password + writes the audit row in one server-side call.
interface ChangePasswordResponse {
  user_id?: string;
  must_change_password?: boolean;
  error?: string;
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (newPassword: string) => {
      const res = await invokeEdgeFn<ChangePasswordResponse>(
        "auth-change-own-password",
        { new_password: newPassword },
      );
      if (res.status !== 200 || !res.body) {
        throw new Error(res.body?.error ?? `change password failed (${res.status})`);
      }
      return res.body;
    },
  });
}
