import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/features/auth/useSession";
import {
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  withTimeout,
} from "@/features/auth/network-errors";

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

interface State {
  data: TeacherDashboard | null;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useTeacherDashboard(): State {
  const { appUser } = useSession();
  const teacherId = appUser?.id;
  const [data, setData] = useState<TeacherDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!teacherId) {
      setData(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await withTimeout(
        supabase.rpc("teacher_dashboard", { p_teacher: teacherId }),
      );
      if (res.error) {
        setError(res.error.message);
        return;
      }
      setData(res.data as unknown as TeacherDashboard);
    } catch (err) {
      setError(
        isNetworkError(err) ? NETWORK_ERROR_MESSAGE : "Couldn't load your dashboard.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [teacherId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, isLoading, error, reload };
}
