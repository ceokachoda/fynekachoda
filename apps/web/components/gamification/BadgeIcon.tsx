"use client";

import { memo } from "react";
import { Award, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface BadgeIconProps {
  uri: string | null | undefined;
  size?: number;
  locked?: boolean;
  className?: string;
}

export const BadgeIcon = memo(function BadgeIcon({
  uri,
  size = 64,
  locked = false,
  className,
}: BadgeIconProps) {
  const containerStyle = { width: size, height: size };
  const inner = uri ? (
    // Signed SVG URL — img src is fine on web (mobile uses SvgUri).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={uri}
      alt=""
      style={{ width: size, height: size }}
      className="object-contain"
    />
  ) : (
    <div
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className="flex items-center justify-center bg-slate-200"
    >
      <Award style={{ width: size * 0.5, height: size * 0.5 }} className="text-slate-400" />
    </div>
  );
  return (
    <div
      style={containerStyle}
      className={cn("relative flex items-center justify-center", locked && "opacity-30", className)}
    >
      {inner}
      {locked ? (
        <div className="absolute -bottom-0.5 -right-0.5 flex size-6 items-center justify-center rounded-full border-2 border-white bg-slate-200">
          <Lock className="size-3 text-slate-600" />
        </div>
      ) : null}
    </div>
  );
});
