"use client";

import Link from "next/link";
import { Calendar, GraduationCap, Trophy, QrCode, PlayCircle } from "lucide-react";
import type { NextCard as NextCardType } from "@/features/dashboard/types";

interface Spec {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  cta: string;
  href: string;
}

function specFor(card: NextCardType): Spec {
  if (card.type === "live_class" && card.session_id) {
    return {
      icon: <PlayCircle className="size-6 text-white" />,
      title: card.subject ?? "Live class",
      subtitle: "A live class is happening now. Tap to join.",
      cta: "Join live class",
      href: `/live/${card.session_id}`,
    };
  }
  if (card.type === "exam" && card.exam_id) {
    return {
      icon: <Trophy className="size-6 text-white" />,
      title: card.title ?? "Examination",
      subtitle:
        card.starts_in_sec != null && card.starts_in_sec > 0
          ? `Starts in ${Math.round(card.starts_in_sec / 60)} min`
          : "Available now",
      cta: "Open Classes",
      href: "/classes",
    };
  }
  if (card.type === "upcoming_session" && card.session_id) {
    return {
      icon: <Calendar className="size-6 text-white" />,
      title: card.subject ?? "Upcoming class",
      subtitle:
        card.starts_in_sec != null && card.starts_in_sec > 0
          ? `Starts in ${Math.round(card.starts_in_sec / 60)} min`
          : "Coming up",
      cta: "See schedule",
      href: "/classes",
    };
  }
  if (card.type === "attendance" && card.session_id) {
    return {
      icon: <QrCode className="size-6 text-white" />,
      title: card.subject ?? "Mark attendance",
      subtitle: "Class window is open. Show your QR to the teacher.",
      cta: "Show QR",
      href: "/attendance",
    };
  }
  if (card.type === "continue_quiz" && card.quiz_id) {
    return {
      icon: <GraduationCap className="size-6 text-white" />,
      title: card.title ?? "Continue practice",
      subtitle: "You have an unfinished quiz.",
      cta: "Resume",
      href: "/library",
    };
  }
  return {
    icon: <Calendar className="size-6 text-white" />,
    title: "All caught up",
    subtitle: "Nothing scheduled right now. Check the library.",
    cta: "Open library",
    href: "/library",
  };
}

export function NextCard({ card }: { card: NextCardType }) {
  const spec = specFor(card);
  return (
    <div className="rounded-sheet bg-gradient-to-br from-primary to-blue-700 p-5 text-white shadow-lg shadow-blue-500/20">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/30">
          {spec.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-white/80">
            Up next
          </p>
          <h3 className="truncate text-lg font-extrabold">{spec.title}</h3>
        </div>
      </div>
      <p className="mb-4 text-sm leading-5 text-white/85">{spec.subtitle}</p>
      <Link
        href={spec.href}
        className="block rounded-xl bg-white py-3 text-center text-base font-bold text-primary shadow-sm transition-colors hover:bg-white/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
      >
        {spec.cta}
      </Link>
    </div>
  );
}
