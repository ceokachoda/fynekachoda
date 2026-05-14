"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { forcePasswordChangeAction, type ChangeState } from "./actions";

const initial: ChangeState = {};

export function ForcePasswordChangeForm() {
  const [state, formAction, pending] = useActionState(
    forcePasswordChangeAction,
    initial,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium text-slate-700">
          New password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
        {state.fieldErrors?.password ? (
          <p className="text-xs text-red-600">{state.fieldErrors.password}</p>
        ) : (
          <p className="text-xs text-slate-500">
            At least 10 characters, including upper, lower, and a digit. No
            spaces. Cannot match your email.
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="confirm" className="text-sm font-medium text-slate-700">
          Confirm new password
        </label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
        />
        {state.fieldErrors?.confirm ? (
          <p className="text-xs text-red-600">{state.fieldErrors.confirm}</p>
        ) : null}
      </div>

      {state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save and continue"}
      </Button>
    </form>
  );
}
