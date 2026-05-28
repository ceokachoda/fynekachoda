"use client";

// Phase 4 Track 4B — teacher home dashboard (RPC `teacher_dashboard`).
// Mirrors mobile features/dashboard/useTeacherDashboard.ts. Re-fetches on
// window focus so a teacher hopping between scan / classes sees a fresh
// "next" + pending list.

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useSession } from "@/features/auth/SessionProvider";

export interface TeacherNext {
  session_id: string;
  subject: string;
  batch: string;
  start: string;
  status: "scheduled" | "live";
  starts_in_sec: number;
}

export interface PendingExam {
  exam_id: string;
  title: string;
  batch: string;
  submitted_count: number;
}

export interface TeacherPending {
  exams_awaiting_release: PendingExam[];
  raised_hands: number;
}

export interface TeacherTodayItem {
  session_id: string;
  subject: string;
  batch: string;
  start: string;
  end: string;
  status: "scheduled" | "live" | "ended" | "cancelled";
}

export interface TeacherDashboard {
  next: TeacherNext | null;
  pending: TeacherPending;
  today: TeacherTodayItem[];
}

export function useTeacherDashboard() {
  const { appUser } = useSession();
  const teacherId = appUser?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["teacher-dashboard", teacherId],
    enabled: !!teacherId,
    queryFn: async (): Promise<TeacherDashboard> => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("teacher_dashboard", {
        p_teacher: teacherId,
      });
      if (error) throw new Error(error.message);
      return data as unknown as TeacherDashboard;
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!teacherId) return;
    const onFocus = () => {
      void qc.invalidateQueries({ queryKey: ["teacher-dashboard", teacherId] });
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [teacherId, qc]);

  return query;
}
