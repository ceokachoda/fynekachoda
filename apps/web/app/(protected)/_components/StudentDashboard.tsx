"use client";

import { useState, useEffect } from "react";
import { useStudentDashboard } from "@/features/dashboard/useStudentDashboard";
import { useUnseenBadges } from "@/features/gamification/useUnseenBadges";
import { useAttendanceRealtime } from "@/features/attendance/useAttendanceRealtime";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/SessionProvider";
import { NextCard } from "@/components/dashboard/NextCard";
import { StatsStrip } from "@/components/dashboard/StatsStrip";
import { TodayScheduleStrip } from "@/components/dashboard/TodayScheduleStrip";
import { WeakTopicsList } from "@/components/dashboard/WeakTopicsList";
import { ContinueStrip } from "@/components/dashboard/ContinueStrip";
import { RecentBadgesStrip } from "@/components/dashboard/RecentBadgesStrip";
import { StreakFlame } from "@/components/dashboard/StreakFlame";
import { StreakModal } from "@/components/dashboard/StreakModal";
import { BadgeEarnedModal } from "@/components/gamification/BadgeEarnedModal";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  greeting: string;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-44 w-full rounded-[28px]" />
      <Skeleton className="h-20 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
  );
}

export function StudentDashboard({ greeting }: Props) {
  const { appUser } = useSession();
  const dash = useStudentDashboard();
  const unseen = useUnseenBadges();
  const qc = useQueryClient();
  const [streakOpen, setStreakOpen] = useState(false);

  // When attendance changes (a teacher scan, a correction), invalidate the
  // dashboard query so stats + today's strip refresh.
  useAttendanceRealtime(() => {
    qc.invalidateQueries({ queryKey: ["student-dashboard", appUser?.id] });
    qc.invalidateQueries({ queryKey: ["today-sessions"] });
  });

  // Re-fetch dashboard data when window regains focus.
  useEffect(() => {
    const handler = () => {
      qc.invalidateQueries({ queryKey: ["student-dashboard", appUser?.id] });
    };
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, [qc, appUser?.id]);

  const data = dash.data;

  return (
    <div className="space-y-6" data-testid="student-dashboard">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold text-slate-900">{greeting}</h1>
        {data?.streak ? (
          <StreakFlame
            currentDays={data.streak.current_days}
            onClick={() => setStreakOpen(true)}
          />
        ) : null}
      </div>

      {dash.isLoading ? (
        <DashboardSkeleton />
      ) : dash.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load your dashboard.{" "}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => dash.refetch()}
          >
            Tap to retry
          </button>
        </div>
      ) : data ? (
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <div className="space-y-6">
            {data.next_card ? <NextCard card={data.next_card} /> : null}
            <StatsStrip stats={data.stats} />
            <section>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                Today&apos;s schedule
              </h2>
              <TodayScheduleStrip items={data.today} />
            </section>
            {data.continue.length > 0 ? (
              <section>
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                  Continue learning
                </h2>
                <ContinueStrip items={data.continue} />
              </section>
            ) : null}
          </div>
          <div className="space-y-6">
            <section>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                Weak topics
              </h2>
              <WeakTopicsList items={data.weak_topics} />
            </section>
            <section>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                Recent badges
              </h2>
              <RecentBadgesStrip badges={data.recent_badges} />
            </section>
          </div>
        </div>
      ) : null}

      <StreakModal open={streakOpen} onOpenChange={setStreakOpen} />

      {unseen.current ? (
        <BadgeEarnedModal
          badge={unseen.current}
          iconUrl={unseen.iconUrls[unseen.current.code] ?? null}
          open={!!unseen.current}
          onDismiss={() => unseen.dismiss(unseen.current!.earning_id)}
        />
      ) : null}
    </div>
  );
}
