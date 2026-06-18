"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createTeacherAction, type CreateTeacherState } from "./actions";

const initial: CreateTeacherState = {};

function Field({
  name,
  label,
  type = "text",
  required = false,
  placeholder,
  error,
  hint,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  error?: string;
  hint?: string;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium text-foreground">
        {label}{" "}
        {required ? null : (
          <span className="font-normal text-muted-foreground">(optional)</span>
        )}
      </label>
      <Input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        defaultValue={defaultValue}
        aria-invalid={error ? "true" : undefined}
      />
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function NewTeacherForm() {
  const [state, formAction, pending] = useActionState(createTeacherAction, initial);
  const [showCreds, setShowCreds] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (state.created) setShowCreds(true);
  }, [state.created]);

  return (
    <>
      <form action={formAction} className="space-y-6">
        <Field
          name="full_name"
          label="Full name"
          required
          error={state.fieldErrors?.full_name}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="email"
            label="Email"
            type="email"
            required
            placeholder="teacher@example.com"
            error={state.fieldErrors?.email}
            hint="Used as login + receives credentials"
          />
          <Field
            name="phone"
            label="Phone"
            placeholder="+91 98765 43210"
            error={state.fieldErrors?.phone}
          />
        </div>

        <Field
          name="subjects"
          label="Subjects"
          placeholder="Physics, Chemistry"
          hint="Comma-separated. Free-form for now; up to 20 entries."
          error={state.fieldErrors?.subjects}
        />

        <div className="space-y-1.5">
          <label htmlFor="bio" className="text-sm font-medium text-foreground">
            Bio{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <textarea
            id="bio"
            name="bio"
            rows={4}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Brief teaching background"
          />
        </div>

        {state.error ? (
          <div className="rounded-md border border-destructive bg-destructive/15 px-3 py-2 text-sm text-destructive">
            {state.error}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create teacher"}
          </Button>
        </div>
      </form>

      <Dialog open={showCreds} onOpenChange={setShowCreds}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Teacher created</DialogTitle>
            <DialogDescription>
              Copy the credentials below. The initial password is shown{" "}
              <strong>only once</strong>. Share it directly with the teacher;
              they&apos;ll be required to change it on first login.
            </DialogDescription>
          </DialogHeader>

          {state.created ? (
            <div className="space-y-3">
              <CopyRow label="Email" value={state.created.email} />
              <CopyRow
                label="Initial password"
                value={state.created.initial_password}
                mono
              />
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                setShowCreds(false);
                router.push(`/teachers/${state.created!.user_id}`);
              }}
            >
              I&apos;ve shared this. Open profile →
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CopyRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <code
          className={`flex-1 break-all rounded-md border border-border bg-muted/50 px-3 py-2 ${
            mono ? "font-mono" : ""
          } text-sm text-foreground`}
        >
          {value}
        </code>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="shrink-0 rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
