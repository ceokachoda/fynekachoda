import {
  BookOpen,
  ClipboardCheck,
  Home,
  ListChecks,
  type LucideIcon,
  QrCode,
  Trophy,
  User,
  Users,
  Video,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const STUDENT_NAV: readonly NavItem[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "Classes", href: "/classes", icon: Video },
  { label: "Library", href: "/library", icon: BookOpen },
  { label: "Quiz", href: "/practice", icon: ListChecks },
  { label: "Attendance", href: "/attendance", icon: QrCode },
  { label: "Ranks", href: "/leaderboard", icon: Trophy },
  { label: "Profile", href: "/profile", icon: User },
] as const;

export const TEACHER_NAV: readonly NavItem[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "Scan", href: "/scan", icon: QrCode },
  { label: "Classes", href: "/classes", icon: Video },
  { label: "Library", href: "/content", icon: BookOpen },
  { label: "Quizzes", href: "/quizzes", icon: ListChecks },
  { label: "Exams", href: "/exams", icon: ClipboardCheck },
  { label: "Batch", href: "/batch", icon: Users },
  { label: "Profile", href: "/profile", icon: User },
] as const;
