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
    <div className="space-y-1">
      <label htmlFor={name} className="text-sm font-medium text-slate-700">
        {label}{" "}
        {required ? null : (
          <span className="font-normal text-slate-400">(optional)</span>
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
        <p className="text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
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

        <div className="space-y-1">
          <label htmlFor="bio" className="text-sm font-medium text-slate-700">
            Bio{" "}
            <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            id="bio"
            name="bio"
            rows={4}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            placeholder="Brief teaching background"
          />
        </div>

        {state.error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
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
    <div className="space-y-1">
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <div className="flex items-center gap-2">
        <code
          className={`flex-1 break-all rounded bg-slate-100 px-3 py-2 ${
            mono ? "font-mono" : ""
          } text-sm text-slate-800`}
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
          className="shrink-0 rounded border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
