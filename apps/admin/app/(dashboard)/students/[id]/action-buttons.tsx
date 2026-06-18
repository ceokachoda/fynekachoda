"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  forceResetStudentAction,
  suspendStudentAction,
  unsuspendStudentAction,
} from "./actions";

export function ActionButtons({
  userId,
  isActive,
}: {
  userId: string;
  isActive: boolean;
}) {
  const [openSuspend, setOpenSuspend] = useState(false);
  const [openReset, setOpenReset] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState<string | null>(null);

  function doUnsuspend() {
    setError(null);
    const fd = new FormData();
    fd.set("user_id", userId);
    startTransition(async () => {
      const res = await unsuspendStudentAction(fd);
      if (!res.ok) setError(res.error ?? "Failed");
    });
  }

  return (
    <div className="flex items-center gap-2">
      {isActive ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpenSuspend(true)}
          disabled={pending}
        >
          Suspend
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={doUnsuspend}
          disabled={pending}
        >
          {pending ? "Reactivating…" : "Reactivate"}
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpenReset(true)}
        disabled={pending}
      >
        Reset password
      </Button>

      {error ? (
        <span className="text-xs text-destructive">{error}</span>
      ) : null}

      <SuspendDialog
        open={openSuspend}
        onOpenChange={setOpenSuspend}
        userId={userId}
      />
      <ResetDialog
        open={openReset}
        onOpenChange={(open) => {
          setOpenReset(open);
          if (!open) setNewPassword(null);
        }}
        userId={userId}
        newPassword={newPassword}
        onNewPassword={setNewPassword}
      />
    </div>
  );
}

function SuspendDialog({
  open,
  onOpenChange,
  userId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suspend student?</DialogTitle>
          <DialogDescription>
            They&apos;ll be signed out of every device on their next
            background refresh, and won&apos;t be able to log back in until
            reactivated.
          </DialogDescription>
        </DialogHeader>
        <form
          action={(formData) => {
            startTransition(async () => {
              setError(null);
              formData.set("user_id", userId);
              const res = await suspendStudentAction(formData);
              if (!res.ok) {
                setError(res.error ?? "Failed");
                return;
              }
              onOpenChange(false);
            });
          }}
          className="space-y-3"
        >
          <div className="space-y-1">
            <label
              htmlFor="reason"
              className="text-sm font-medium text-foreground"
            >
              Reason{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Input id="reason" name="reason" maxLength={500} />
          </div>
          {error ? (
            <div className="rounded-md border border-destructive bg-destructive/15 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Suspending…" : "Suspend"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetDialog({
  open,
  onOpenChange,
  userId,
  newPassword,
  onNewPassword,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  newPassword: string | null;
  onNewPassword: (pw: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function trigger() {
    startTransition(async () => {
      setError(null);
      const fd = new FormData();
      fd.set("user_id", userId);
      const res = await forceResetStudentAction(fd);
      if (!res.ok) {
        setError(res.error ?? "Failed");
        return;
      }
      onNewPassword(res.initial_password ?? null);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {newPassword ? "Password reset" : "Reset password?"}
          </DialogTitle>
          <DialogDescription>
            {newPassword
              ? "Share the new temporary password with the student. They'll be required to change it on next login."
              : "A new temporary password will be generated. The student's existing sessions are signed out."}
          </DialogDescription>
        </DialogHeader>

        {newPassword ? (
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              New initial password
            </span>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded-md border border-border bg-muted/50 px-3 py-2 font-mono text-sm text-foreground">
                {newPassword}
              </code>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(newPassword);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="shrink-0 rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-md border border-destructive bg-destructive/15 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}

        <DialogFooter>
          {newPassword ? (
            <Button type="button" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="button" onClick={trigger} disabled={pending}>
                {pending ? "Resetting…" : "Reset password"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
