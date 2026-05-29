"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { makeNewPasswordSchema } from "@/features/auth/schemas";
import { invokeEdgeFn } from "@/lib/edge-fn";
import { signOutAction } from "@/app/actions/sign-out";

interface Props {
  email: string;
}

export function ForcePasswordForm({ email }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    const schema = makeNewPasswordSchema(email);
    const parsed = schema.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid password.");
      return;
    }

    setPending(true);
    // D-153: single edge-fn call clears must_change_password + rotates password
    // + writes audit row. We never call supabase.auth.updateUser ourselves.
    const result = await invokeEdgeFn("auth-change-own-password", {
      new_password: password,
    });
    setPending(false);

    if (result.status !== 200) {
      const detail =
        result.body && typeof result.body === "object" && "error" in result.body
          ? String((result.body as { error: unknown }).error)
          : result.error ?? `status ${result.status}`;
      setError(detail);
      return;
    }
    router.refresh();
    router.push("/");
  }

  // Sign-out is a sibling <form> (never nested inside the password form — nested
  // forms are invalid HTML and the browser drops the inner one).
  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            autoFocus
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
          />
          <p className="text-xs leading-relaxed text-slate-500">
            At least 10 characters with upper, lower, and a digit. No spaces.
            Cannot match your email.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm new password</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              setError(null);
            }}
          />
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </div>
        ) : null}

        <Button
          type="submit"
          size="lg"
          className="h-12 w-full text-base font-bold shadow-sm transition-all hover:shadow-md"
          disabled={pending || !password || !confirm}
        >
          {pending ? "Saving…" : "Save and continue"}
        </Button>
      </form>

      <form action={signOutAction}>
        <Button
          type="submit"
          variant="ghost"
          className="h-11 w-full text-sm text-slate-500 hover:text-slate-700"
          disabled={pending}
        >
          Sign out
        </Button>
      </form>
    </div>
  );
}
