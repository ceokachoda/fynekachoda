// Shape of the public.student_dashboard(p_student) JSON return (Phase 8).
// Mirrors supabase/migrations/20260521132000_student_dashboard_fn.sql.

export type NextCardType =
  | "live_class"
  | "exam"
  | "upcoming_session"
  | "attendance"
  | "recording"
  | "weak_topic"
  | "browse";

export interface NextCard {
  type: NextCardType;
  priority: number;
  action: string;
  session_id?: string;
  exam_id?: string;
  content_id?: string;
  topic_id?: string;
  quiz_id?: string | null;
  subject?: string;
  title?: string;
  topic_name?: string;
  mastery?: number;
  starts_in_sec?: number;
  ends_in_sec?: number;
}

export interface DashboardStats {
  attendance_pct: number;
  mastery_pct: number;
  rank: number | null;
}

export type TodayStatus =
  | "present"
  | "late"
  | "absent"
  | "live"
  | "missed"
  | "upcoming"
  | "cancelled";

export interface TodayItem {
  session_id: string;
  subject: string;
  start: string;
  end: string;
  status: TodayStatus;
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
  watched_pct: number;
  position_sec: number;
}

export interface StreakInfo {
  current_days: number;
  best_days: number;
}

export interface RecentBadge {
  code: string;
  name: string;
  icon_path: string;
  earned_at: string;
}

export interface StudentDashboard {
  next_card: NextCard;
  stats: DashboardStats;
  today: TodayItem[];
  weak_topics: WeakTopicItem[];
  continue: ContinueItem[];
  streak: StreakInfo;
  recent_badges: RecentBadge[];
}
