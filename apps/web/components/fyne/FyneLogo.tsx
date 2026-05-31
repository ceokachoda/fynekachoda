import Image from "next/image";
import { cn } from "@/lib/utils";

interface FyneLogoProps {
  variant?: "large" | "header";
  className?: string;
}

// The official FyneStudy shield mark (public/brand/fyne-mark.png — cropped from the
// brand logo) followed by the lowercase wordmark. The source art's wordmark is white
// and reserved for dark surfaces (see public/og.png); on light app chrome we render
// the name as text so it stays legible.
export function FyneLogo({ variant = "large", className }: FyneLogoProps) {
  const isLarge = variant === "large";
  const size = isLarge ? 46 : 28;

  return (
    <div className={cn("flex flex-row items-center justify-center", className)}>
      <Image
        src="/brand/fyne-mark.png"
        alt=""
        width={size}
        height={size}
        priority
        className="select-none"
        aria-hidden
      />
      <span
        className={cn(
          "font-bold tracking-tighter text-slate-900",
          isLarge ? "ml-3 text-[32px]" : "ml-2 text-xl",
        )}
      >
        fynestudy
      </span>
    </div>
  );
}
