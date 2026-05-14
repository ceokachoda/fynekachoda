"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { verifyChallengeAction, type VerifyState } from "./actions";

const initial: VerifyState = {};

export function VerifyForm({ factorId }: { factorId: string }) {
  const [state, formAction, pending] = useActionState(verifyChallengeAction, initial);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="factor_id" value={factorId} />
      <div className="space-y-1">
        <label htmlFor="code" className="text-sm font-medium text-slate-700">
          6-digit code
        </label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          required
        />
        {state.fieldError ? (
          <p className="text-xs text-red-600">{state.fieldError}</p>
        ) : null}
      </div>
      {state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Checking…" : "Continue"}
      </Button>
    </form>
  );
}
