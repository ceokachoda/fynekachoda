"use client";

import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { prefersReducedMotion } from "@/lib/motion";
import { BadgeIcon } from "./BadgeIcon";
import type { UnseenBadge } from "@/features/gamification/useUnseenBadges";

interface BadgeEarnedModalProps {
  badge: UnseenBadge;
  iconUrl: string | null;
  open: boolean;
  onDismiss: () => void;
}

export function BadgeEarnedModal({
  badge,
  iconUrl,
  open,
  onDismiss,
}: BadgeEarnedModalProps) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!open || firedRef.current) return;
    firedRef.current = true;
    if (prefersReducedMotion()) return; // a11y: no confetti when motion-reduced
    // Lazy-import canvas-confetti so it doesn't ship in the dashboard chunk.
    void import("canvas-confetti").then(({ default: confetti }) => {
      confetti({
        particleCount: 80,
        spread: 90,
        origin: { y: 0.4 },
        colors: ["#2563eb", "#10b981", "#f97316", "#eab308", "#a855f7", "#ef4444"],
      });
    });
  }, [open]);

  useEffect(() => {
    if (!open) firedRef.current = false;
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onDismiss(); }}>
      <DialogContent
        showCloseButton={false}
        className="max-w-sm rounded-[32px] p-8 text-center"
        // re-mount per badge so the confetti re-fires for each
        key={badge.earning_id}
      >
        <DialogTitle className="sr-only">
          Badge unlocked: {badge.name}
        </DialogTitle>
        <p className="text-xs font-bold uppercase tracking-widest text-violet-500">
          Badge unlocked!
        </p>
        <div className="my-4 flex justify-center">
          <BadgeIcon uri={iconUrl} size={104} />
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900">{badge.name}</h2>
        <p className="mt-2 text-sm leading-5 text-slate-500">{badge.description}</p>
        <div className="mt-7 flex gap-3">
          <div className="flex-1 rounded-2xl bg-slate-100 py-3.5 text-center text-sm font-bold text-slate-400 opacity-50">
            Share
          </div>
          <Button
            onClick={onDismiss}
            className="flex-1 rounded-2xl bg-primary py-3.5 text-sm font-bold text-white"
          >
            Awesome!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
