"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { loginAction, type LoginState } from "./actions";

const initial: LoginState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <form action={formAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="h-11 bg-transparent"
          aria-invalid={state.fieldErrors?.email ? "true" : undefined}
        />
        {state.fieldErrors?.email ? (
          <p className="text-xs text-red-600 dark:text-red-400">{state.fieldErrors.email}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Password
        </label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          className="h-11 bg-transparent"
          aria-invalid={state.fieldErrors?.password ? "true" : undefined}
        />
        {state.fieldErrors?.password ? (
          <p className="text-xs text-red-600 dark:text-red-400">{state.fieldErrors.password}</p>
        ) : null}
      </div>

      {state.error ? (
        <div className="rounded-md border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          {state.error}
        </div>
      ) : null}

      <Button type="submit" className="h-11 w-full text-sm" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
