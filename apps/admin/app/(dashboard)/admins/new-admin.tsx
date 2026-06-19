"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createAdminAction, type CreateAdminState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const INITIAL: CreateAdminState = {};

export function NewAdmin() {
  const [show, setShow] = useState(false);

  return (
    <div className="space-y-3">
      <Button
        variant={show ? "outline" : "default"}
        onClick={() => setShow((s) => !s)}
      >
        {show ? "Cancel" : "+ New admin"}
      </Button>
      {/* Conditional mount resets the form + action state each time it opens. */}
      {show ? <NewAdminForm onClose={() => setShow(false)} /> : null}
    </div>
  );
}

function NewAdminForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createAdminAction, INITIAL);

  useEffect(() => {
    if (state.created) router.refresh();
  }, [state.created, router]);

  if (state.created) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-5">
        <p className="text-sm font-semibold text-emerald-600">
          Admin created — share these credentials securely
        </p>
        <p className="mt-1 text-xs text-emerald-500">
          The temporary password is shown only once. The new admin must change
          it at first login.
        </p>
        <dl className="mt-3 space-y-2 text-sm">
          <CredRow label="Email" value={state.created.email} />
          <CredRow label="Temp password" value={state.created.initial_password} mono />
          <CredRow label="Role" value={state.created.role.replace(/_/g, " ")} />
        </dl>
        <Button variant="outline" className="mt-4" onClick={onClose}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border border-border bg-card p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" error={state.fieldErrors?.full_name}>
          <Input name="full_name" placeholder="Jane Doe" required />
        </Field>
        <Field label="Email" error={state.fieldErrors?.email}>
          <Input name="email" type="email" placeholder="jane@institute.in" required />
        </Field>
        <Field label="Phone (optional)" error={state.fieldErrors?.phone}>
          <Input name="phone" placeholder="+91…" />
        </Field>
        <Field label="Role" error={state.fieldErrors?.role}>
          <select
            name="role"
            defaultValue="staff_admin"
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
          >
            <option value="staff_admin">Staff admin</option>
            <option value="owner_admin">Owner admin</option>
          </select>
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">
        Staff admins run day-to-day operations. Owner admins can additionally
        manage admins and institute settings.
      </p>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create admin"}
      </Button>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      {children}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </label>
  );
}

function CredRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2">
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd
          className={`truncate text-foreground ${mono ? "font-mono" : ""}`}
        >
          {value}
        </dd>
      </div>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
