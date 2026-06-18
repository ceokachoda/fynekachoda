"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
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
        <label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-200">
          New password
        </label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          minLength={10}
          required
          className="bg-transparent"
        />
        {state.fieldErrors?.password ? (
          <p className="text-xs text-red-600 dark:text-red-400">{state.fieldErrors.password}</p>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            At least 10 characters, including upper, lower, and a digit. No
            spaces. Cannot match your email.
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="confirm" className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Confirm new password
        </label>
        <PasswordInput
          id="confirm"
          name="confirm"
          autoComplete="new-password"
          required
          className="bg-transparent"
        />
        {state.fieldErrors?.confirm ? (
          <p className="text-xs text-red-600 dark:text-red-400">{state.fieldErrors.confirm}</p>
        ) : null}
      </div>

      {state.error ? (
        <div className="rounded-md border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          {state.error}
        </div>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save and continue"}
      </Button>
    </form>
  );
}
