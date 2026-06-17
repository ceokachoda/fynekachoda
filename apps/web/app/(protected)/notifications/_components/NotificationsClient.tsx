"use client";

// Web notifications hub — parity with the mobile `notifications.tsx` screen.
// Push is dispatch-only (no stored feed), so this surfaces the browser
// permission state, a one-tap enable, and a "what you'll get" explainer.

import {
  BellRing,
  CalendarClock,
  Check,
  ClipboardCheck,
  FileText,
  ListChecks,
  Radio,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/fyne/PageHeader";
import { Button } from "@/components/ui/button";
import { useWebPushStatus } from "@/features/notifications/useWebPushStatus";
import { cn } from "@/lib/utils";

interface Category {
  icon: LucideIcon;
  color: string;
  bg: string;
  title: string;
  desc: string;
}

const CATEGORIES: readonly Category[] = [
  {
    icon: Radio,
    color: "text-red-600",
    bg: "bg-red-50",
    title: "Live classes",
    desc: "The moment one of your classes goes live.",
  },
  {
    icon: CalendarClock,
    color: "text-primary",
    bg: "bg-blue-50",
    title: "Scheduled classes",
    desc: "When a class is scheduled, plus a reminder ~10 min before it starts.",
  },
  {
    icon: FileText,
    color: "text-violet-600",
    bg: "bg-violet-50",
    title: "Study material",
    desc: "When new videos or notes land in your library.",
  },
  {
    icon: ListChecks,
    color: "text-cyan-600",
    bg: "bg-cyan-50",
    title: "Quizzes",
    desc: "When a new practice quiz is published for your batch.",
  },
  {
    icon: ClipboardCheck,
    color: "text-orange-600",
    bg: "bg-orange-50",
    title: "Exams & results",
    desc: "New graded exams, and the moment your results are released.",
  },
] as const;

export function NotificationsClient() {
  const { permission, busy, supported, enable } = useWebPushStatus();

  const granted = permission === "granted";
  const denied = permission === "denied";

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Stay in the loop on live classes, new material, quizzes and your results."
      />

      {/* Status card */}
      <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
        <div
          className={cn(
            "flex size-12 items-center justify-center rounded-2xl",
            granted ? "bg-emerald-50" : "bg-blue-50",
          )}
        >
          {granted ? (
            <Check className="size-6 text-emerald-600" />
          ) : (
            <BellRing className="size-6 text-primary" />
          )}
        </div>

        <h2 className="mt-3 text-lg font-extrabold text-slate-900">
          {granted ? "Notifications are on" : "Turn on notifications"}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          {granted
            ? "You're all set — we'll alert you about everything below."
            : !supported
              ? "This browser can't show notifications. On iPhone, open this site in Safari, tap Share → Add to Home Screen, then open it from your home screen and try again."
              : denied
                ? "Notifications are blocked for this site. Turn them on from your browser's site settings (tap the lock icon in the address bar → Notifications → Allow), then reload."
                : "Get a heads-up the second a class goes live or new material drops."}
        </p>

        {supported && !granted && !denied ? (
          <Button
            type="button"
            className="mt-4 h-11 w-full sm:w-auto"
            disabled={busy}
            onClick={() => void enable()}
          >
            {busy ? "Enabling…" : "Enable notifications"}
          </Button>
        ) : null}

        {denied ? (
          <p
            className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700"
            role="status"
          >
            Already blocked? You must re-allow it from the browser, not here.
          </p>
        ) : null}
      </div>

      {/* What you'll get */}
      <h3 className="mx-1 mt-7 mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
        What you&apos;ll get
      </h3>
      <ul className="divide-y divide-slate-50 overflow-hidden rounded-3xl border border-slate-100 bg-white">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          return (
            <li key={c.title} className="flex items-center gap-3 p-4">
              <span
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-2xl",
                  c.bg,
                )}
              >
                <Icon className={cn("size-5", c.color)} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">{c.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                  {c.desc}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mx-1 mt-4 text-xs leading-relaxed text-slate-400">
        Tap a notification to jump straight to the class, material or result it&apos;s
        about. Tip: on your phone, &ldquo;Add to Home Screen&rdquo; so alerts arrive
        even when the tab is closed.
      </p>
    </div>
  );
}
