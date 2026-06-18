import Image from "next/image";
import { cn } from "@/lib/utils";

interface FyneLogoProps {
  variant?: "large" | "header";
  className?: string;
}

// The official FyneStudy shield mark (public/brand/fyne-mark.png — cropped from
// the brand logo) followed by the wordmark. The source art's wordmark is white
// and reserved for dark surfaces, so on the light admin chrome we render the
// name as text to keep it legible. Mirrors apps/web FyneLogo for cross-surface
// brand consistency.
export function FyneLogo({ variant = "header", className }: FyneLogoProps) {
  const isLarge = variant === "large";
  const size = isLarge ? 40 : 30;

  return (
    <div className={cn("flex flex-row items-center", className)}>
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
          "font-semibold tracking-tight text-slate-900 dark:text-slate-50",
          isLarge ? "ml-2.5 text-2xl" : "ml-2 text-lg",
        )}
      >
        fynestudy
      </span>
    </div>
  );
}
