"use client";

// Phase 4 Track 4B — teacher batch analytics: Risk / Mastery / Attendance
// tabs (mirrors mobile (teacher)/batch/[id].tsx). Stays inside `(protected)`
// per the locked decision so the side-rail remains visible.

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTeacherBatchOverview } from "@/features/teacher/useTeacherBatchOverview";
import { AtRiskList } from "@/components/teacher/AtRiskList";
import { TopicMasteryBars } from "@/components/teacher/TopicMasteryBars";
import { BatchHeatmap } from "@/components/teacher/BatchHeatmap";

export function TeacherBatchOverviewClient({ batchId }: { batchId: string }) {
  const overview = useTeacherBatchOverview(batchId);
  const data = overview.data;
  const batch = data?.batch;

  return (
    <div className="space-y-6">
      <Link
        href="/batch"
        className="inline-flex items-center text-sm font-semibold text-slate-600 hover:text-slate-900"
      >
        <ChevronLeft className="mr-1 size-4" />
        Back to batches
      </Link>

      {overview.isLoading && !data ? (
        <Skeleton className="h-32 w-full rounded-2xl" />
      ) : !data ? (
        <p className="text-sm text-red-600">Couldn&apos;t load this batch.</p>
      ) : (
        <>
          <div className="rounded-2xl border border-slate-100 bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
              {batch?.course_code ?? "Batch"}
            </p>
            <h1 className="mt-1 text-2xl font-extrabold text-slate-900">
              {batch?.name ?? "—"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {batch?.course_name ?? ""} · {batch?.student_count ?? 0} student
              {(batch?.student_count ?? 0) === 1 ? "" : "s"}
            </p>
          </div>

          <Tabs defaultValue="risk">
            <TabsList>
              <TabsTrigger value="risk">Risk</TabsTrigger>
              <TabsTrigger value="mastery">Mastery</TabsTrigger>
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
            </TabsList>
            <TabsContent value="risk">
              <AtRiskList students={data.at_risk} />
            </TabsContent>
            <TabsContent value="mastery">
              <TopicMasteryBars topics={data.topic_mastery} />
            </TabsContent>
            <TabsContent value="attendance">
              <BatchHeatmap days={data.attendance} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
