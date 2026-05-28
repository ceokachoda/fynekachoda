"use client";

import { Pin } from "lucide-react";

interface PinnedBannerProps {
  text: string;
  byName?: string;
}

export function PinnedBanner({ text, byName }: PinnedBannerProps) {
  return (
    <div
      data-testid="pinned-banner"
      className="border-b border-blue-100 bg-blue-50 px-4 py-3"
    >
      <div className="mb-1 flex items-center">
        <Pin className="mr-1.5 size-3 text-blue-700" aria-hidden />
        <span className="text-[10px] font-bold uppercase tracking-widest text-blue-800">
          {byName ? `Pinned by ${byName}` : "Pinned"}
        </span>
      </div>
      <p className="text-sm leading-5 text-blue-900">{text}</p>
    </div>
  );
}
