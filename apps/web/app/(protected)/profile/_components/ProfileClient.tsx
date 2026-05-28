"use client";

import { useState } from "react";
import { Lock, Mail, Phone, Cake, GraduationCap, Award } from "lucide-react";
import { Segmented } from "@/components/fyne/Segmented";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
    <div className="flex items-center gap-3 py-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <p className="truncate text-sm font-semibold text-slate-900">
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
      <div className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm shadow-slate-200/40">
        <div className="flex items-center gap-4">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-blue-100 text-xl font-extrabold text-primary">
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
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white px-4">
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
          <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
            Identity details are managed by your institute admin. Contact them
            for any updates.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setPwOpen(true)} data-testid="open-change-password">
              Change password
            </Button>
            <Button
              asChild
              variant="outline"
            >
              <a href="mailto:admin@fynestudy.example.com">Contact admin</a>
            </Button>
          </div>
          <ChangePasswordDialog
            open={pwOpen}
            onOpenChange={setPwOpen}
            email={email}
          />
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
            <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
              Couldn&apos;t load your mastery.
            </p>
          ) : (mastery.data ?? []).length === 0 ? (
            <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">
              Finish a quiz or exam and your per-topic mastery shows up here.
            </p>
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
            <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
              Couldn&apos;t load your badges.
            </p>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3">
                <Award className="size-5 text-violet-500" />
                <p className="text-sm font-semibold text-slate-700">
                  {badges.data?.earnedCount ?? 0} earned ·{" "}
                  {(badges.data?.items.length ?? 0) - (badges.data?.earnedCount ?? 0)}{" "}
                  to go
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
