// Mirrors apps/mobile/features/dashboard/types.ts — single canonical shape
// returned by the `public.student_dashboard(p_student)` SQL fn.

export type NextCardType =
  | "live_class"
  | "exam"
  | "upcoming_session"
  | "attendance"
  | "continue_quiz"
  | null;

export interface NextCard {
  type: NextCardType;
  priority?: number;
  session_id?: string;
  exam_id?: string;
  quiz_id?: string;
  content_id?: string;
  subject?: string;
  title?: string;
  action?: string;
  starts_in_sec?: number;
  ends_in_sec?: number;
  yt_video_id?: string;
}

export interface DashboardStats {
  attendance_pct: number;
  mastery_pct: number;
  rank_this_week: number | null;
}

export interface TodayItem {
  session_id: string;
  subject: string;
  start: string;
  end: string;
  status: "scheduled" | "live" | "ended" | "cancelled";
  attendance_status: "present" | "late" | "absent" | null;
}

export interface WeakTopicItem {
  topic_id: string;
  topic_name: string;
  mastery: number;
  quiz_id: string | null;
}

export interface ContinueItem {
  content_id: string;
  title: string;
  kind: "video" | "pdf";
  watched_pct: number;
}

export interface StreakInfo {
  current_days: number;
  best_days: number;
}

export interface RecentBadge {
  code: string;
  name: string;
  earned_at: string;
}

export interface StudentDashboard {
  next_card: NextCard | null;
  stats: DashboardStats;
  today: TodayItem[];
  weak_topics: WeakTopicItem[];
  continue: ContinueItem[];
  streak: StreakInfo;
  recent_badges: RecentBadge[];
}
