"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useChangePassword } from "@/features/profile/useChangePassword";
import { makeNewPasswordSchema } from "@/features/auth/schemas";

function buildSchema(email: string) {
  return z
    .object({
      password: makeNewPasswordSchema(email),
      confirm: z.string(),
    })
    .superRefine((vals, ctx) => {
      if (vals.password !== vals.confirm) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["confirm"],
          message: "Passwords do not match.",
        });
      }
    });
}

type FormShape = { password: string; confirm: string };

export function ChangePasswordDialog({
  open,
  onOpenChange,
  email,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  email: string;
}) {
  const form = useForm<FormShape>({
    resolver: zodResolver(buildSchema(email)),
    defaultValues: { password: "", confirm: "" },
    mode: "onSubmit",
  });
  const mutation = useChangePassword();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await mutation.mutateAsync(values.password);
      setSuccess(true);
      form.reset();
      setTimeout(() => {
        setSuccess(false);
        onOpenChange(false);
      }, 1200);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Could not change password.");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-[28px] p-6">
        <DialogTitle className="text-lg font-extrabold text-slate-900">
          Change password
        </DialogTitle>
        <DialogDescription className="mb-4">
          At least 10 characters, with upper case, lower case, and a digit.
          Cannot match your email.
        </DialogDescription>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label htmlFor="new-pw">New password</Label>
            <Input
              id="new-pw"
              type="password"
              autoComplete="new-password"
              {...form.register("password")}
              data-testid="new-password-input"
            />
            {form.formState.errors.password ? (
              <p className="mt-1 text-xs text-red-600">
                {form.formState.errors.password.message}
              </p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="confirm-pw">Confirm new password</Label>
            <Input
              id="confirm-pw"
              type="password"
              autoComplete="new-password"
              {...form.register("confirm")}
              data-testid="confirm-password-input"
            />
            {form.formState.errors.confirm ? (
              <p className="mt-1 text-xs text-red-600">
                {form.formState.errors.confirm.message}
              </p>
            ) : null}
          </div>
          {serverError ? (
            <p className="text-xs text-red-600">{serverError}</p>
          ) : null}
          {success ? (
            <p className="text-xs text-emerald-600">Password changed.</p>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              data-testid="change-password-submit"
            >
              {mutation.isPending ? "Changing…" : "Change password"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
