"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, Mail, Phone, Cake, GraduationCap, Award, LogOut, FileText } from "lucide-react";
import { Segmented } from "@/components/fyne/Segmented";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { signOutAction } from "@/app/actions/sign-out";
import { useSession } from "@/features/auth/SessionProvider";
import { useMyBatch } from "@/features/org/useMyBatch";
import { useMastery } from "@/features/dashboard/useMastery";
import { useBadgesCollection } from "@/features/gamification/useBadgesCollection";
import { MasteryCard } from "@/components/dashboard/MasteryCard";
import { BadgeShowcase } from "@/components/gamification/BadgeShowcase";
import { ChangePasswordDialog } from "@/components/profile/ChangePasswordDialog";

type Tab = "profile" | "mastery" | "badges";

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
  initialTab: Tab;
}

export function ProfileClient({ fullName, email, initialTab }: Props) {
  const { appUser } = useSession();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [pwOpen, setPwOpen] = useState(false);
  const batch = useMyBatch();
  const mastery = useMastery();
  const badges = useBadgesCollection();

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
            {initials || "S"}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-extrabold text-slate-900">
              {fullName}
            </h1>
            <p className="truncate text-sm text-slate-500">{email}</p>
          </div>
        </div>
      </div>

      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: "profile", label: "Profile" },
          { value: "mastery", label: "Mastery" },
          { value: "badges", label: "Badges" },
        ]}
        ariaLabel="Profile sections"
      />

      {tab === "profile" ? (
        <div className="space-y-4">
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
            <IdentityRow
              icon={<GraduationCap className="size-4" />}
              label="Batch"
              value={batch.data?.batch_name ?? ""}
            />
            <IdentityRow
              icon={<GraduationCap className="size-4" />}
              label="Course"
              value={
                batch.data
                  ? `${batch.data.course_code} · ${batch.data.course_name}`
                  : ""
              }
            />
          </div>
          <div className="flex gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <Lock className="mt-0.5 size-4 shrink-0 text-slate-400" />
            <p className="text-xs leading-relaxed text-slate-600">
              Identity details are managed by your institute admin. Contact them
              for any updates.
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
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-11 font-semibold"
            >
              <a href="mailto:admin@fynestudy.example.com">Contact admin</a>
            </Button>
          </div>
          <ChangePasswordDialog
            open={pwOpen}
            onOpenChange={setPwOpen}
            email={email}
          />

          <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <Link
              href="/privacy"
              className="flex items-center gap-3 px-4 py-3.5 text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <FileText className="size-4" />
              </div>
              <span className="flex-1 text-sm font-semibold">
                Terms &amp; privacy
              </span>
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
      ) : null}

      {tab === "mastery" ? (
        <div className="space-y-2">
          {mastery.isLoading ? (
            <>
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-20 w-full rounded-2xl" />
            </>
          ) : mastery.error ? (
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Couldn&apos;t load your mastery.
            </div>
          ) : (mastery.data ?? []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center">
              <GraduationCap className="mx-auto mb-3 size-8 text-slate-400" />
              <p className="text-sm font-semibold text-slate-700">No mastery data yet</p>
              <p className="mt-1 text-xs text-slate-500">
                Finish a quiz or exam and your per-topic mastery shows up here.
              </p>
            </div>
          ) : (
            (mastery.data ?? []).map((row) => (
              <MasteryCard key={row.topic_id} row={row} />
            ))
          )}
        </div>
      ) : null}

      {tab === "badges" ? (
        <div>
          {badges.isLoading ? (
            <Skeleton className="h-64 w-full rounded-2xl" />
          ) : badges.error ? (
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Couldn&apos;t load your badges.
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-3 rounded-2xl border border-violet-100 bg-violet-50/60 px-4 py-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-violet-100">
                  <Award className="size-5 text-violet-600" />
                </div>
                <p className="text-sm font-semibold text-slate-700">
                  <span className="text-violet-700">{badges.data?.earnedCount ?? 0} earned</span> ·{" "}
                  <span className="text-slate-500">
                    {(badges.data?.items.length ?? 0) - (badges.data?.earnedCount ?? 0)}{" "}
                    to go
                  </span>
                </p>
              </div>
              <BadgeShowcase items={badges.data?.items ?? []} />
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
