"use client";

// Phase 4 Track 4B — teacher home dashboard. Mirrors mobile
// (teacher)/index.tsx with a desktop-friendly multi-column layout (lg+).

import Link from "next/link";
import {
  BookOpenCheck,
  CalendarClock,
  ChevronRight,
  QrCode,
  Sparkles,
  Upload,
  Users,
  Video,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/fyne/PageHeader";
import { EmptyState } from "@/components/fyne/EmptyState";
import { Pill } from "@/components/fyne/Pill";
import { PendingList } from "@/components/teacher/PendingList";
import { useTeacherDashboard } from "@/features/teacher/useTeacherDashboard";
import { useAssignedBatches } from "@/features/teacher/useAssignedBatches";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function minsPhrase(sec: number): string {
  const m = Math.max(0, Math.round(sec / 60));
  if (m < 1) return "starting now";
  if (m < 60) return `in ${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `in ${h}h ${rem}m` : `in ${h}h`;
}

export function TeacherDashboard({ greeting }: { greeting: string }) {
  const dash = useTeacherDashboard();
  const batches = useAssignedBatches();
  const next = dash.data?.next ?? null;
  const today = dash.data?.today ?? [];
  const batchList = batches.data ?? [];

  return (
    <div className="space-y-6" data-testid="teacher-home">
      <PageHeader
        title={greeting}
        description={new Date().toLocaleDateString("en-IN", {
          timeZone: "Asia/Kolkata",
          weekday: "long",
          day: "2-digit",
          month: "short",
        })}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-2">
          {next ? (
            <div className="rounded-3xl bg-primary p-5 text-primary-foreground shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-white/70">
                Next
              </p>
              <p className="mt-1 truncate text-lg font-extrabold">
                {next.subject} · {next.batch}
              </p>
              <p className="mt-1 text-sm text-white/80">
                {next.status === "live"
                  ? "Live now"
                  : `${fmtTime(next.start)} · ${minsPhrase(next.starts_in_sec)}`}
              </p>
              <Link
                href="/scan"
                className="mt-4 inline-flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-primary transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <QrCode className="mr-2 size-4" />
                Take Attendance
              </Link>
            </div>
          ) : null}

          <section>
            <h2 className="mb-3 text-base font-bold text-slate-900">Pending</h2>
            {dash.isLoading && !dash.data ? (
              <Skeleton className="h-20 rounded-2xl" />
            ) : dash.data ? (
              <PendingList pending={dash.data.pending} />
            ) : null}
          </section>

          {today.length > 0 ? (
            <section>
              <h2 className="mb-3 text-base font-bold text-slate-900">
                Today&apos;s classes
              </h2>
              <ul className="space-y-2">
                {today.map((t) => (
                  <li key={t.session_id}>
                    <Link
                      href="/scan"
                      className="flex items-center rounded-2xl border border-slate-100 bg-white p-4 transition hover:border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <div className="w-14">
                        <p className="text-sm font-bold text-slate-900">
                          {fmtTime(t.start)}
                        </p>
                        <p className="text-xs text-slate-400">
                          {fmtTime(t.end)}
                        </p>
                      </div>
                      <div className="ml-2 min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {t.subject}
                        </p>
                        <p className="text-xs text-slate-500">{t.batch}</p>
                      </div>
                      {t.status === "live" ? (
                        <Pill tone="error">Live</Pill>
                      ) : (
                        <Video className="size-4 text-slate-300" />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </section>

        <aside className="space-y-6">
          <section>
            <h2 className="mb-3 text-base font-bold text-slate-900">
              Quick actions
            </h2>
            <div className="grid grid-cols-3 gap-2 lg:grid-cols-1 lg:gap-2">
              <ActionTile
                href="/scan"
                icon={<QrCode className="size-5 text-primary" />}
                label="Scan QR"
                tone="bg-blue-50"
              />
              <ActionTile
                href="/exams"
                icon={<BookOpenCheck className="size-5 text-amber-600" />}
                label="New exam"
                tone="bg-amber-50"
              />
              <ActionTile
                href="/content"
                icon={<Upload className="size-5 text-emerald-600" />}
                label="Upload"
                tone="bg-emerald-50"
              />
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-end justify-between">
              <h2 className="text-base font-bold text-slate-900">My batches</h2>
              <p className="text-xs font-medium text-slate-500">
                {batches.isLoading && !batches.data
                  ? "Loading…"
                  : `${batchList.length} assigned`}
              </p>
            </div>
            {batches.isLoading && !batches.data ? (
              <Skeleton className="h-20 rounded-2xl" />
            ) : batchList.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="No batches yet"
                description="Ask the admin to assign you to a batch — your roster + schedule will appear here."
              />
            ) : (
              <ul className="space-y-2">
                {batchList.map((b) => (
                  <li key={b.batch_id}>
                    <Link
                      href={`/batch/${b.batch_id}`}
                      className="block rounded-2xl border border-slate-100 bg-white p-4 transition hover:border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1 pr-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-primary">
                            {b.course_code}
                          </p>
                          <p className="mt-1 truncate text-base font-extrabold text-slate-900">
                            {b.batch_name}
                          </p>
                          <p className="text-xs font-medium text-slate-500">
                            {b.course_name}
                          </p>
                        </div>
                        <ChevronRight className="size-4 text-slate-300" />
                      </div>
                      <div className="mt-3 flex items-center gap-4 text-xs font-semibold text-slate-700">
                        <span className="flex items-center">
                          <Users className="mr-1.5 size-3.5 text-slate-500" />
                          {b.student_count}{" "}
                          <span className="ml-1 font-medium text-slate-500">
                            student{b.student_count === 1 ? "" : "s"}
                          </span>
                        </span>
                        <span className="flex items-center">
                          <CalendarClock className="mr-1.5 size-3.5 text-slate-500" />
                          {b.next_session?.label ?? (
                            <span className="font-medium text-slate-400">
                              No schedule set
                            </span>
                          )}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function ActionTile({
  href,
  label,
  icon,
  tone,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-start rounded-2xl border border-slate-100 bg-white p-4 transition hover:border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div className={`mb-3 flex size-10 items-center justify-center rounded-xl ${tone}`}>
        {icon}
      </div>
      <p className="text-sm font-bold text-slate-700">{label}</p>
    </Link>
  );
}
