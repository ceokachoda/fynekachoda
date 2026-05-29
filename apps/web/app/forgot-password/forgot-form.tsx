"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmailSchema } from "@/features/auth/schemas";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const parsed = EmailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid email.");
      return;
    }
    setPending(true);
    const supabase = createSupabaseBrowserClient();
    // Always present success to avoid email-enumeration leakage (matches mobile
    // behavior in requestPasswordReset).
    try {
      await supabase.auth.resetPasswordForEmail(parsed.data, {
        redirectTo: `${window.location.origin}/reset`,
      });
    } catch {
      // Swallow non-network errors — success message is the user contract.
    }
    setPending(false);
    setDone(true);
  }

  if (done) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-relaxed text-emerald-800"
      >
        If an account exists for <strong>{email}</strong>, we&apos;ve sent a reset
        link. It expires in 1 hour. Check your inbox (and spam folder).
        <div className="mt-4">
          <Link
            href="/login"
            className="inline-flex rounded text-sm font-semibold text-primary transition-colors hover:text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          >
            ← Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
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
        disabled={pending || !email.trim()}
      >
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <div className="text-center">
        <Link
          href="/login"
          className="inline-flex rounded text-sm font-semibold text-primary transition-colors hover:text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
        >
          ← Back to sign in
        </Link>
      </div>
    </form>
  );
}
