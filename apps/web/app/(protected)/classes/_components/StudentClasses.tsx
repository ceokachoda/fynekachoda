"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, Video, Clock, ChevronRight } from "lucide-react";
import { Segmented } from "@/components/fyne/Segmented";
import { EmptyState } from "@/components/fyne/EmptyState";
import { Pill } from "@/components/fyne/Pill";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudentSchedule } from "@/features/dashboard/useStudentSchedule";
import { useStudentExams } from "@/features/exams/useStudentExams";
import { formatIstDay, formatIstTime } from "@/lib/ist";
import type { ExamStatus } from "@/features/exams/useStudentExams";

type Segment = "live" | "upcoming" | "recorded";

function examPill(status: ExamStatus): { tone: "primary" | "neutral" | "success" | "warning" | "error"; label: string } {
  switch (status) {
    case "live":
      return { tone: "error", label: "Live now" };
    case "scheduled":
      return { tone: "warning", label: "Scheduled" };
    case "results_pending":
      return { tone: "primary", label: "Results pending" };
    case "results_released":
      return { tone: "success", label: "Results out" };
    case "ended":
      return { tone: "neutral", label: "Ended" };
    default:
      return { tone: "neutral", label: status };
  }
}

export function StudentClasses() {
  const schedule = useStudentSchedule();
  const exams = useStudentExams();
  const [seg, setSeg] = useState<Segment>("upcoming");

  const sessions = schedule.data ?? [];
  const live = sessions.filter((s) => s.status === "live");
  const upcoming = sessions.filter((s) => s.bucket === "upcoming");
  const recorded = sessions
    .filter((s) => s.status === "ended" && s.is_live_class && !!s.yt_video_id)
    .reverse();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-100">
          <Video className="size-6 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold text-slate-900">My Classes</h1>
          <p className="text-sm text-slate-500">
            Live, upcoming and recorded sessions plus exams.
          </p>
        </div>
      </div>

      <Segmented<Segment>
        value={seg}
        onChange={setSeg}
        options={[
          { value: "live", label: `Live${live.length ? ` (${live.length})` : ""}` },
          { value: "upcoming", label: `Upcoming${upcoming.length ? ` (${upcoming.length})` : ""}` },
          { value: "recorded", label: `Recorded${recorded.length ? ` (${recorded.length})` : ""}` },
        ]}
        ariaLabel="Classes filter"
      />

      <section>
        {schedule.isLoading ? (
          <Skeleton className="h-32 w-full rounded-2xl" />
        ) : seg === "live" ? (
          live.length === 0 ? (
            <EmptyState
              title="No live class right now"
              description="When a class starts, it will appear here. Live playback ships in Phase 4."
            />
          ) : (
            <ul className="space-y-2">
              {live.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center rounded-2xl border border-red-200 bg-red-50 p-4"
                >
                  <Video className="mr-3 size-5 text-red-600" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {s.subject_name}
                    </p>
                    <p className="text-xs text-red-700">
                      Live now · {formatIstTime(s.scheduled_start)}
                    </p>
                  </div>
                  <Pill tone="error">LIVE</Pill>
                </li>
              ))}
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-center text-xs text-slate-500">
                Live class playback lands in Phase 4 — for now, this list shows the
                session as live.
              </p>
            </ul>
          )
        ) : seg === "upcoming" ? (
          upcoming.length === 0 ? (
            <EmptyState
              title="No upcoming sessions"
              description="Your schedule for the next 14 days is clear."
            />
          ) : (
            <ul className="space-y-2">
              {upcoming.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center rounded-2xl border border-slate-100 bg-white p-4"
                >
                  <Clock className="mr-3 size-4 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {s.subject_name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatIstDay(s.scheduled_start)} ·{" "}
                      {formatIstTime(s.scheduled_start)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : recorded.length === 0 ? (
          <EmptyState
            title="No recordings yet"
            description="When a live class ends and the recording is ready, it'll appear here. Playback ships in Phase 4."
          />
        ) : (
          <ul className="space-y-2">
            {recorded.map((s) => (
              <li
                key={s.id}
                className="flex items-center rounded-2xl border border-slate-100 bg-white p-4 opacity-70"
              >
                <Video className="mr-3 size-4 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">
                    {s.subject_name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatIstDay(s.scheduled_start)} · recording available
                  </p>
                </div>
                <Pill tone="neutral">Phase 4</Pill>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          Examinations
        </h2>
        {exams.isLoading ? (
          <Skeleton className="h-24 w-full rounded-2xl" />
        ) : (exams.data ?? []).length === 0 ? (
          <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            No examinations scheduled.
          </p>
        ) : (
          <ul className="space-y-2">
            {(exams.data ?? []).map((e) => {
              const p = examPill(e.status);
              // D-181: re-open routing. ANY status routes to /exam/[id];
              // the ExamClient figures out which stage to render
              // (instant + submitted → result, manual + submitted → submitted
              // → result once released, live → attempt entry, scheduled → pre).
              return (
                <li key={e.id}>
                  <Link
                    href={`/exam/${e.id}`}
                    data-testid="exam-link"
                    className="flex items-center rounded-2xl border border-slate-100 bg-white p-4 transition hover:border-slate-200"
                  >
                    <Calendar className="mr-3 size-4 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {e.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatIstDay(e.starts_at)} ·{" "}
                        {formatIstTime(e.starts_at)} · {e.duration_min} min
                      </p>
                    </div>
                    <Pill tone={p.tone}>{p.label}</Pill>
                    <ChevronRight className="ml-2 size-4 text-slate-400" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
