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
import { createStudentAction, type CreateStudentState } from "./actions";

const initial: CreateStudentState = {};

function Field({
  name,
  label,
  type = "text",
  required = false,
  placeholder,
  error,
  hint,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  error?: string;
  hint?: string;
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

interface BatchOption {
  id: string;
  name: string;
  course: string;
}

export function NewStudentForm({ batches }: { batches: BatchOption[] }) {
  const [state, formAction, pending] = useActionState(
    createStudentAction,
    initial,
  );
  const [showCreds, setShowCreds] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (state.created) setShowCreds(true);
  }, [state.created]);

  return (
    <>
      <form action={formAction} className="space-y-8">
        <Section title="Identity">
          <Field
            name="full_name"
            label="Full name"
            required
            error={state.fieldErrors?.full_name}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="dob"
              label="Date of birth"
              placeholder="YYYY-MM-DD"
              hint="Format: YYYY-MM-DD"
              error={state.fieldErrors?.dob}
            />
            <div className="space-y-1.5">
              <label
                htmlFor="gender"
                className="text-sm font-medium text-foreground"
              >
                Gender{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <select
                id="gender"
                name="gender"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                defaultValue=""
              >
                <option value="">—</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not">Prefer not to say</option>
              </select>
            </div>
          </div>
        </Section>

        <Section title="Contact">
          <Field
            name="email"
            label="Email"
            type="email"
            required
            placeholder="student@example.com"
            error={state.fieldErrors?.email}
            hint="Used as login + receives the welcome email"
          />
          <Field
            name="phone"
            label="Phone"
            placeholder="+91 98765 43210"
            error={state.fieldErrors?.phone}
          />
          <Field
            name="address"
            label="Address"
            error={state.fieldErrors?.address}
          />
        </Section>

        <Section title="Academic">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              name="school_name"
              label="School"
              error={state.fieldErrors?.school_name}
            />
            <Field
              name="board"
              label="Board"
              placeholder="CBSE / ICSE / State"
              error={state.fieldErrors?.board}
            />
            <Field
              name="current_class"
              label="Class"
              placeholder="11 / 12"
              error={state.fieldErrors?.current_class}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="batch_id" className="text-sm font-medium text-foreground">
              Batch
            </label>
            <select
              id="batch_id"
              name="batch_id"
              required
              defaultValue=""
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
              aria-invalid={state.fieldErrors?.batch_id ? "true" : undefined}
            >
              <option value="" disabled>
                {batches.length === 0 ? "No active batches — create one first" : "Pick a batch"}
              </option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} — {b.course}
                </option>
              ))}
            </select>
            {state.fieldErrors?.batch_id ? (
              <p className="text-xs text-destructive">{state.fieldErrors.batch_id}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                The student&apos;s course is derived from the batch (D-013).
              </p>
            )}
          </div>
        </Section>

        <Section title="Parents">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="parent_phone_1"
              label="Parent phone (primary)"
              placeholder="+91 …"
              error={state.fieldErrors?.parent_phone_1}
            />
            <Field
              name="parent_phone_2"
              label="Parent phone (secondary)"
              placeholder="+91 …"
              error={state.fieldErrors?.parent_phone_2}
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="parent_consent_method"
              className="text-sm font-medium text-foreground"
            >
              Parent consent captured via{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <select
              id="parent_consent_method"
              name="parent_consent_method"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm sm:max-w-xs"
              defaultValue=""
            >
              <option value="">—</option>
              <option value="verbal">Verbal</option>
              <option value="written">Written</option>
              <option value="form">Admission form</option>
            </select>
            <p className="text-xs text-muted-foreground">
              You attest that parent consent was obtained at admission (DPDP).
            </p>
          </div>
        </Section>

        {state.error ? (
          <div className="rounded-md border border-destructive bg-destructive/15 px-3 py-2 text-sm text-destructive">
            {state.error}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create student"}
          </Button>
        </div>
      </form>

      <Dialog open={showCreds} onOpenChange={setShowCreds}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Student created</DialogTitle>
            <DialogDescription>
              Copy the credentials below. The initial password is shown{" "}
              <strong>only once</strong>. Share it directly with the student;
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
                router.push(`/students/${state.created!.user_id}`);
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

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1 mb-4">{title}</h2>
      <div className="space-y-5">{children}</div>
    </section>
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
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
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
