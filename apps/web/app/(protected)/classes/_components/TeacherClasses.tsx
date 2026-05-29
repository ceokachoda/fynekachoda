"use client";

// Phase 4 Track 4B — teacher Classes screen. Today / Upcoming / Past
// segmented, per-row Scan/Roster/Live-control actions, Schedule-Live + Ad-hoc
// FABs. Mirrors mobile (teacher)/classes.tsx.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  Camera,
  ListChecks,
  Plus,
  Radio,
  Sparkles,
} from "lucide-react";
import { Segmented } from "@/components/fyne/Segmented";
import { EmptyState } from "@/components/fyne/EmptyState";
import { Pill } from "@/components/fyne/Pill";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { SessionCreateSheet } from "@/components/teacher/SessionCreateSheet";
import {
  useTeacherSessions,
  type SessionBucket,
  type TeacherSession,
} from "@/features/teacher/useTeacherSessions";
import { useAssignedBatches } from "@/features/teacher/useAssignedBatches";
import { formatIstDay, formatIstTime } from "@/lib/ist";

function statusPill(s: TeacherSession): {
  tone: "neutral" | "warning" | "success" | "error" | "primary";
  label: string;
} {
  if (s.status === "live") return { tone: "error", label: "Live" };
  if (s.status === "ended") return { tone: "neutral", label: "Ended" };
  if (s.status === "cancelled") return { tone: "neutral", label: "Cancelled" };
  return { tone: "primary", label: "Scheduled" };
}

export function TeacherClasses() {
  const router = useRouter();
  const sessions = useTeacherSessions();
  const batches = useAssignedBatches();
  const [bucket, setBucket] = useState<SessionBucket>("today");
  const [sheet, setSheet] = useState<"live" | "adhoc" | null>(null);

  const list = sessions.buckets[bucket];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">Classes</h1>
        <p className="text-sm text-slate-500">Today, upcoming and past sessions.</p>
      </div>

      <Segmented<SessionBucket>
        value={bucket}
        onChange={setBucket}
        options={[
          { value: "today", label: `Today (${sessions.buckets.today.length})` },
          { value: "upcoming", label: `Upcoming (${sessions.buckets.upcoming.length})` },
          { value: "past", label: `Past (${sessions.buckets.past.length})` },
        ]}
        ariaLabel="Class filter"
      />

      {sessions.isLoading && !sessions.data ? (
        <Skeleton className="h-32 w-full rounded-2xl" />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title={
            bucket === "today"
              ? "No classes scheduled today"
              : bucket === "upcoming"
                ? "Nothing on the calendar yet"
                : "No recent classes"
          }
          description={
            bucket === "past"
              ? "Past classes from the last 30 days will appear here."
              : "Use the buttons below to schedule a live class or create an ad-hoc session."
          }
        />
      ) : (
        <ul className="space-y-2">
          {list.map((s) => (
            <ClassRow
              key={s.id}
              session={s}
              onScan={() => router.push("/scan")}
              onRoster={() => router.push(`/roster/${s.id}`)}
              onLiveControl={() => router.push(`/live-control/${s.id}`)}
            />
          ))}
        </ul>
      )}

      <div className="fixed bottom-24 right-5 z-30 flex flex-col gap-3 lg:bottom-8">
        <Button
          variant="destructive"
          aria-label="Schedule live class"
          onClick={() => setSheet("live")}
          className="size-14 rounded-full bg-red-600 p-0 text-white shadow-xl shadow-red-600/30 transition-all hover:bg-red-700 hover:shadow-2xl hover:shadow-red-600/40"
        >
          <Radio className="size-5" />
        </Button>
        <Button
          aria-label="New ad-hoc class"
          onClick={() => setSheet("adhoc")}
          className="size-14 rounded-full p-0 shadow-xl shadow-blue-600/30 transition-all hover:shadow-2xl hover:shadow-blue-600/40"
        >
          <Plus className="size-5" />
        </Button>
      </div>

      <SessionCreateSheet
        open={sheet === "live"}
        onOpenChange={(v) => setSheet(v ? "live" : null)}
        mode="live"
        batches={batches.data ?? []}
        onCreated={(sessionId) => router.push(`/live-control/${sessionId}`)}
      />
      <SessionCreateSheet
        open={sheet === "adhoc"}
        onOpenChange={(v) => setSheet(v ? "adhoc" : null)}
        mode="adhoc"
        batches={batches.data ?? []}
        onCreated={(sessionId) => router.push(`/roster/${sessionId}`)}
      />
    </div>
  );
}

function ClassRow({
  session,
  onScan,
  onRoster,
  onLiveControl,
}: {
  session: TeacherSession;
  onScan: () => void;
  onRoster: () => void;
  onLiveControl: () => void;
}) {
  const pill = statusPill(session);
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-300">
      <div className="flex items-start">
        <div className={`mr-3 flex size-10 items-center justify-center rounded-2xl ${session.status === "live" ? "bg-red-50 ring-1 ring-red-100" : "bg-blue-50"}`}>
          {session.is_live_class ? (
            <Radio className={`size-5 ${session.status === "live" ? "text-red-600" : "text-primary"}`} />
          ) : (
            <Calendar className="size-5 text-primary" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-slate-900">
            {session.subject_name ?? "Class"}
            {session.is_ad_hoc ? (
              <span className="ml-1 text-xs font-semibold text-amber-600">· ad-hoc</span>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {session.batch_name} · {session.course_code}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {formatIstDay(session.scheduled_start)} ·{" "}
            {formatIstTime(session.scheduled_start)} –{" "}
            {formatIstTime(session.scheduled_end)}
          </p>
        </div>
        <Pill tone={pill.tone}>{pill.label}</Pill>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <p className="flex-1 text-xs font-medium text-slate-500 tabular-nums">
          {session.attendance_count} / {session.batch_student_count} marked
        </p>
        {session.is_live_class ? (
          <button
            type="button"
            onClick={onLiveControl}
            className="flex items-center rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 transition-colors hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1"
          >
            <Radio className="mr-1 size-3.5" />
            {session.status === "live" ? "Live control" : "Go live"}
          </button>
        ) : (
          <button
            type="button"
            onClick={onScan}
            className="flex items-center rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1"
          >
            <Camera className="mr-1 size-3.5" />
            Scan
          </button>
        )}
        <Link
          href={`/roster/${session.id}`}
          onClick={(e) => {
            // Defer to onRoster (which may do router.push) for tests/instrumentation.
            e.preventDefault();
            onRoster();
          }}
          className="flex items-center rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-800 transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1"
        >
          <ListChecks className="mr-1 size-3.5" />
          Roster
        </Link>
      </div>
    </li>
  );
}
