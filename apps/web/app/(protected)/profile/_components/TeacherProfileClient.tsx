"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, Mail, Phone, Cake, LogOut, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/SessionProvider";
import { ChangePasswordDialog } from "@/components/profile/ChangePasswordDialog";
import { signOutAction } from "@/app/actions/sign-out";

interface IdentityRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function IdentityRow({ icon, label, value }: IdentityRowProps) {
  return (
    <div className="flex items-center gap-3 py-3.5">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
          {value || "—"}
        </p>
      </div>
      <Lock
        aria-label="Read-only — contact admin to update"
        className="size-4 text-slate-300"
      />
    </div>
  );
}

interface Props {
  fullName: string;
  email: string;
}

export function TeacherProfileClient({ fullName, email }: Props) {
  const { appUser } = useSession();
  const [pwOpen, setPwOpen] = useState(false);

  const initials = fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n.charAt(0).toUpperCase())
    .join("");

  return (
    <div className="space-y-6">
      <div className="rounded-sheet border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-blue-200 text-xl font-extrabold text-primary ring-1 ring-blue-200/50">
            {initials || "T"}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-extrabold text-slate-900">
              {fullName}
            </h1>
            <p className="truncate text-sm text-slate-500">{email}</p>
            <span className="mt-1 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-primary">
              Teacher
            </span>
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm">
        <IdentityRow
          icon={<Mail className="size-4" />}
          label="Email"
          value={email}
        />
        <IdentityRow
          icon={<Phone className="size-4" />}
          label="Phone"
          value={appUser?.phone ?? ""}
        />
        <IdentityRow
          icon={<Cake className="size-4" />}
          label="Date of birth"
          value={appUser?.dob ?? ""}
        />
      </div>

      <div className="flex gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <Lock className="mt-0.5 size-4 shrink-0 text-slate-400" />
        <p className="text-xs leading-relaxed text-slate-600">
          Identity details are managed by your institute admin. Contact them for
          any updates.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="lg"
          className="h-11 font-semibold"
          onClick={() => setPwOpen(true)}
          data-testid="open-change-password"
        >
          Change password
        </Button>
        <Button asChild size="lg" variant="outline" className="h-11 font-semibold">
          <a href="mailto:admin@fynestudy.example.com">Contact admin</a>
        </Button>
      </div>

      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} email={email} />

      <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <Link
          href="/privacy"
          className="flex items-center gap-3 px-4 py-3.5 text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
            <FileText className="size-4" />
          </div>
          <span className="flex-1 text-sm font-semibold">Terms &amp; privacy</span>
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-red-600 transition-colors hover:bg-red-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-400"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <LogOut className="size-4" />
            </div>
            <span className="flex-1 text-sm font-semibold">Sign out</span>
          </button>
        </form>
      </div>
    </div>
  );
}
