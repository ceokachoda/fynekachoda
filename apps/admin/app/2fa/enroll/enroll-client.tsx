"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { verifyEnrollmentAction, type EnrollSetup, type VerifyEnrollState } from "./actions";

const initial: VerifyEnrollState = {};

export function EnrollClient({ setup }: { setup: EnrollSetup }) {
  const [state, formAction, pending] = useActionState(verifyEnrollmentAction, initial);
  const [showSecret, setShowSecret] = useState(false);

  if (state.codes) {
    return <RecoveryCodesView codes={state.codes} />;
  }

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
        <strong className="block">After you verify the code,</strong>
        you&apos;ll receive 10 one-time recovery codes. Save them somewhere safe
        — they&apos;re your only way back in if you lose your authenticator
        app.
      </div>
    </div>
  );
}

function RecoveryCodesView({ codes }: { codes: string[] }) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);
  const allCodes = codes.join("\n");

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(allCodes);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be blocked (older browsers, http origins). Fall back
      // to selecting the textarea so the user can copy manually.
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
        <strong className="block">2FA enabled.</strong>
        These 10 recovery codes can be used <em>once each</em> if you lose
        access to your authenticator. Save them now — they are not stored in
        plaintext on the server and cannot be re-displayed.
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <ul className="grid grid-cols-2 gap-2 font-mono text-sm text-slate-900">
          {codes.map((c) => (
            <li
              key={c}
              className="rounded border border-slate-200 bg-white px-2 py-1.5 text-center tracking-wider"
            >
              {c}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={copyAll}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
          >
            {copied ? "Copied" : "Copy all"}
          </button>
          <span className="text-slate-500">
            Each code works once. After re-enrolling, you&apos;ll get 10 new ones.
          </span>
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        <span>
          I have saved these recovery codes somewhere safe (password manager,
          printed copy, etc.).
        </span>
      </label>

      <Link
        href="/"
        aria-disabled={!acknowledged}
        className={`block w-full rounded-md px-4 py-2 text-center text-sm font-medium ${
          acknowledged
            ? "bg-slate-900 text-white hover:bg-slate-800"
            : "pointer-events-none bg-slate-200 text-slate-400"
        }`}
      >
        Continue to dashboard
      </Link>
    </div>
  );
}
