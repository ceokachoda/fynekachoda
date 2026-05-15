"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { consumeRecoveryAction, type RecoveryState } from "./actions";

const initial: RecoveryState = {};

export function RecoveryForm() {
  const [state, formAction, pending] = useActionState(consumeRecoveryAction, initial);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="code" className="text-sm font-medium text-slate-700">
          Recovery code
        </label>
        <Input
          id="code"
          name="code"
          autoComplete="one-time-code"
          inputMode="text"
          placeholder="XXXXX-XXXXX"
          autoFocus
          required
        />
        {state.fieldError ? (
          <p className="text-xs text-red-600">{state.fieldError}</p>
        ) : null}
        <p className="text-xs text-slate-500">
          Enter one of the 10 codes you saved when you set up 2FA. Hyphens and
          spaces are optional.
        </p>
      </div>
      {state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Verifying…" : "Use recovery code"}
      </Button>
    </form>
  );
}
