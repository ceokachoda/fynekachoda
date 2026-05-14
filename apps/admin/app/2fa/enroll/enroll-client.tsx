"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { verifyEnrollmentAction, type EnrollSetup, type VerifyEnrollState } from "./actions";

const initial: VerifyEnrollState = {};

export function EnrollClient({ setup }: { setup: EnrollSetup }) {
  const [state, formAction, pending] = useActionState(verifyEnrollmentAction, initial);
  const [showSecret, setShowSecret] = useState(false);

  return (
    <div className="space-y-5">
      <ol className="space-y-2 text-sm text-slate-700">
        <li>
          <span className="font-medium">1.</span> Install an authenticator app
          (Google Authenticator, Authy, 1Password) on your phone.
        </li>
        <li>
          <span className="font-medium">2.</span> Scan the QR code below.
        </li>
        <li>
          <span className="font-medium">3.</span> Enter the 6-digit code from
          the app to confirm.
        </li>
      </ol>

      <div className="grid place-items-center rounded-md border border-slate-200 bg-white p-4">
        {/* Supabase returns the QR as an inline SVG data URL; render via <img>
            rather than next/image because the asset is short-lived per-session. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={setup.qrSvg}
          alt="TOTP enrollment QR"
          width={196}
          height={196}
        />
      </div>

      <button
        type="button"
        onClick={() => setShowSecret((s) => !s)}
        className="text-xs text-slate-500 underline-offset-2 hover:underline"
      >
        {showSecret ? "Hide" : "Can't scan? Show"} the secret to enter manually
      </button>
      {showSecret ? (
        <code className="block break-all rounded bg-slate-100 px-3 py-2 text-xs text-slate-800">
          {setup.secret}
        </code>
      ) : null}

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="factor_id" value={setup.factorId} />
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
          {pending ? "Verifying…" : "Verify and continue"}
        </Button>
      </form>

      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <strong className="block">Save your TOTP secret.</strong>
        If you lose access to your authenticator, you will need an admin to
        reset 2FA. Backup-code recovery ships in a future update.
      </div>
    </div>
  );
}
