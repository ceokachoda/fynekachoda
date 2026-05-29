"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { makeNewPasswordSchema } from "@/features/auth/schemas";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { invokeEdgeFn } from "@/lib/edge-fn";

// The Supabase email link returns to `${origin}/reset#access_token=…`. The
// browser client's detectSessionInUrl (on by default in @supabase/ssr) parses
// the hash + writes the session cookie. We wait for the session to land then
// show the new-password form.

export function ResetForm() {
  const router = useRouter();
  const [stage, setStage] = useState<"waiting" | "ready" | "no-session">("waiting");
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let active = true;

    async function check() {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) {
        setEmail(data.session.user.email ?? null);
        setStage("ready");
        return;
      }
      // No session yet — listen briefly for the PASSWORD_RECOVERY event the
      // hash-detect emits after parsing.
    }

    const { data: sub } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (!active) return;
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
          if (session) {
            setEmail(session.user.email ?? null);
            setStage("ready");
          }
        }
      },
    );
    check();

    const timeoutId = setTimeout(() => {
      if (active) setStage((s) => (s === "waiting" ? "no-session" : s));
    }, 4000);

    return () => {
      active = false;
      clearTimeout(timeoutId);
      sub.subscription.unsubscribe();
    };
  }, []);

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

  if (stage === "waiting") {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500" role="status">
        <span className="inline-block size-4 animate-spin rounded-full border-2 border-slate-300 border-t-primary" />
        Verifying reset link…
      </div>
    );
  }

  if (stage === "no-session") {
    return (
      <div className="space-y-4">
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          This reset link is invalid or has expired. Request a new one.
        </div>
        <Link
          href="/forgot-password"
          className="inline-flex rounded text-sm font-semibold text-primary transition-colors hover:text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
        >
          Request a new link →
        </Link>
      </div>
    );
  }

  return (
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
          At least 10 characters with upper, lower, and a digit. No spaces. Cannot
          match your email.
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
        {pending ? "Saving…" : "Save and sign in"}
      </Button>
    </form>
  );
}
