"use client";

// Phase 4 Track 4B — roster + corrections (FocusLayout). Mirrors mobile
// app/roster/[sessionId].tsx with realtime sync via teacher-roster-{id}.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Pill } from "@/components/fyne/Pill";
import { FocusLayout } from "@/components/fyne/FocusLayout";
import { QueryProvider } from "@/lib/query";
import { SessionProvider } from "@/features/auth/SessionProvider";
import {
  useRoster,
  type AttendanceStatus,
  type RosterStudent,
} from "@/features/teacher/useRoster";
import {
  useAttendanceBulkMark,
  useAttendanceCorrect,
  useAttendanceManualMark,
  useAttendanceUnmark,
} from "@/features/teacher/mutations";
import { RosterRow } from "@/components/teacher/RosterRow";
import { CorrectionDialog } from "@/components/teacher/CorrectionDialog";
import { ConfirmDialog } from "@/components/teacher/ConfirmDialog";
import { nextRosterAction } from "@/features/teacher/roster-pill-state";
import { sessionDisplayName } from "@/lib/session-name";

interface Props {
  sessionId: string;
}

function fmtTimeRange(startIso: string, endIso: string): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
    });
  return `${fmt(startIso)} – ${fmt(endIso)}`;
}

export function RosterClient({ sessionId }: Props) {
  return (
    <FocusLayout className="bg-slate-50">
      <QueryProvider>
        <SessionProvider>
          <RosterInner sessionId={sessionId} />
        </SessionProvider>
      </QueryProvider>
    </FocusLayout>
  );
}

function RosterInner({ sessionId }: Props) {
  const router = useRouter();
  const roster = useRoster(sessionId);
  const correct = useAttendanceCorrect();
  const manual = useAttendanceManualMark();
  const unmark = useAttendanceUnmark();
  const bulk = useAttendanceBulkMark();

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [correctionTarget, setCorrectionTarget] = useState<{
    student: RosterStudent;
    preselectStatus: AttendanceStatus | null;
  } | null>(null);
  const [bulkOpen, setBulkOpen] = useState<"present" | "absent" | null>(null);
  const [confirmUnmark, setConfirmUnmark] = useState<{
    student: RosterStudent;
  } | null>(null);

  const counts = useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;
    let unmarked = 0;
    for (const s of roster.students) {
      if (s.status === "present") present++;
      else if (s.status === "late") late++;
      else if (s.status === "absent") absent++;
      else unmarked++;
    }
    return { present, late, absent, unmarked, total: roster.students.length };
  }, [roster.students]);

  const handlePillTap = async (
    student: RosterStudent,
    status: AttendanceStatus,
  ) => {
    const action = nextRosterAction(student.status, status);
    if (action.kind === "noop") return;
    if (action.kind === "manual-mark") {
      setPendingId(student.user_id);
      try {
        await manual.mutateAsync({
          session_id: sessionId,
          student_id: student.user_id,
          status: action.status,
        });
        await roster.refresh();
      } catch (e) {
        if (typeof window !== "undefined") {
          window.alert(e instanceof Error ? e.message : "Couldn't mark.");
        }
      } finally {
        setPendingId(null);
      }
      return;
    }
    if (action.kind === "unmark") {
      setConfirmUnmark({ student });
      return;
    }
    // correction
    setCorrectionTarget({ student, preselectStatus: action.to });
  };

  const performUnmark = async () => {
    if (!confirmUnmark) return;
    const student = confirmUnmark.student;
    setPendingId(student.user_id);
    try {
      await unmark.mutateAsync({
        session_id: sessionId,
        student_id: student.user_id,
      });
      await roster.refresh();
    } catch (e) {
      if (typeof window !== "undefined") {
        window.alert(e instanceof Error ? e.message : "Couldn't un-mark.");
      }
    } finally {
      setPendingId(null);
      setConfirmUnmark(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 pb-24">
      <header className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Back"
          onClick={() => router.back()}
        >
          <ChevronLeft />
        </Button>
        <h1 className="text-lg font-bold text-slate-900">Roster</h1>
      </header>

      <section className="rounded-3xl border border-slate-100 bg-white p-5">
        {roster.isLoading && !roster.meta ? (
          <Skeleton className="h-20 rounded-2xl" />
        ) : roster.error ? (
          <p className="text-sm text-red-600">{roster.error}</p>
        ) : roster.meta ? (
          <>
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
              {roster.meta.batch_name}
              {roster.meta.is_ad_hoc ? (
                <span className="ml-1 text-amber-600">· ad-hoc</span>
              ) : null}
            </p>
            <p className="mt-1 text-xl font-extrabold text-slate-900">
              {sessionDisplayName(roster.meta.title, roster.meta.subject_name)}
            </p>
            <p className="mt-0.5 text-sm font-medium text-slate-500">
              {fmtTimeRange(
                roster.meta.scheduled_start,
                roster.meta.scheduled_end,
              )}
            </p>
            <div className="mt-4 grid grid-cols-4 gap-2 text-center">
              <Chip label="Present" value={counts.present} tone="emerald" />
              <Chip label="Late" value={counts.late} tone="amber" />
              <Chip label="Absent" value={counts.absent} tone="red" />
              <Chip label="Pending" value={counts.unmarked} tone="slate" />
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                variant="default"
                disabled={counts.unmarked === 0 || bulk.isPending}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => setBulkOpen("present")}
              >
                All Present
              </Button>
              <Button
                variant="destructive"
                disabled={counts.unmarked === 0 || bulk.isPending}
                className="flex-1 bg-red-600 text-white hover:bg-red-700"
                onClick={() => setBulkOpen("absent")}
              >
                All Absent
              </Button>
            </div>
          </>
        ) : null}
      </section>

      <section>
        <div className="mb-2 flex items-end justify-between">
          <h2 className="text-base font-bold text-slate-900">Students</h2>
          <p className="text-xs font-medium text-slate-500">
            Tap a pill to set, tap again to un-mark.
          </p>
        </div>
        {roster.students.length === 0 && !roster.isLoading ? (
          <div className="flex flex-col items-center rounded-3xl border border-slate-100 bg-white p-6 text-center">
            <Users className="size-7 text-slate-400" />
            <p className="mt-3 text-sm font-bold text-slate-900">
              No students in this batch yet
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {roster.students.map((s) => (
              <li key={s.user_id}>
                <RosterRow
                  student={s}
                  busy={pendingId === s.user_id}
                  onPillTap={(status) => void handlePillTap(s, status)}
                  onOpenCorrection={() =>
                    setCorrectionTarget({ student: s, preselectStatus: null })
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <CorrectionDialog
        open={!!correctionTarget}
        onOpenChange={(v) => {
          if (!v) setCorrectionTarget(null);
        }}
        target={correctionTarget}
        submitting={correct.isPending}
        onSubmit={async (input) => {
          await correct.mutateAsync(input);
          setCorrectionTarget(null);
          await roster.refresh();
        }}
      />

      <ConfirmDialog
        open={!!bulkOpen}
        onOpenChange={(v) => {
          if (!v) setBulkOpen(null);
        }}
        title={
          bulkOpen === "absent"
            ? "Mark all remaining absent?"
            : "Mark all remaining present?"
        }
        description={`Will mark ${counts.unmarked} unmarked student${counts.unmarked === 1 ? "" : "s"} as ${bulkOpen ?? ""}. Existing marks are not changed.`}
        confirmLabel="Confirm"
        pending={bulk.isPending}
        destructive={bulkOpen === "absent"}
        onConfirm={async () => {
          if (!bulkOpen) return;
          await bulk.mutateAsync({
            session_id: sessionId,
            mark_remaining: bulkOpen,
          });
          setBulkOpen(null);
          await roster.refresh();
        }}
      />

      <ConfirmDialog
        open={!!confirmUnmark}
        onOpenChange={(v) => {
          if (!v) setConfirmUnmark(null);
        }}
        title="Un-mark this student?"
        description={`Remove the ${confirmUnmark?.student.status ?? ""} mark for ${confirmUnmark?.student.full_name ?? ""}. The audit log keeps a record.`}
        confirmLabel={pendingId ? "Working…" : "Un-mark"}
        pending={pendingId === confirmUnmark?.student.user_id}
        destructive
        onConfirm={() => void performUnmark()}
      />

      {roster.isLoading ? (
        <p className="fixed bottom-4 right-4 flex items-center rounded-full bg-white px-3 py-1.5 text-xs shadow">
          <Loader2 className="mr-1 size-3 animate-spin" />
          Refreshing…
        </p>
      ) : null}
    </div>
  );
}

function Chip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "amber" | "red" | "slate";
}) {
  const map = {
    emerald: { bg: "bg-emerald-50", text: "text-emerald-700" },
    amber: { bg: "bg-amber-50", text: "text-amber-700" },
    red: { bg: "bg-red-50", text: "text-red-700" },
    slate: { bg: "bg-slate-100", text: "text-slate-600" },
  } as const;
  const t = map[tone];
  return (
    <Pill tone="neutral" className={`flex-col py-2 ${t.bg} ${t.text}`}>
      <span className="text-base font-extrabold">{value}</span>
      <span className="text-[10px] font-semibold uppercase">{label}</span>
    </Pill>
  );
}
