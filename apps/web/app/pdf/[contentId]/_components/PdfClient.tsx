"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ChevronLeft, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useContentItem } from "@/features/library/useContentItem";
import { usePdfSign } from "@/features/library/usePlaybackSign";
import { usePdfProgress } from "@/features/library/usePdfProgress";
import { PdfWatermark } from "@/components/player/PdfWatermark";
import { useSession } from "@/features/auth/SessionProvider";
import { formatWatermark } from "@/lib/watermark";

// react-pdf is window-only. Dynamic-import with ssr:false.
const PdfViewer = dynamic(
  () => import("@/components/player/PdfViewer").then((m) => m.PdfViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-slate-900 text-slate-300">
        Loading viewer…
      </div>
    ),
  },
);

interface Props {
  contentId: string;
  fullName: string;
}

export function PdfClient({ contentId, fullName }: Props) {
  const { appUser } = useSession();
  const item = useContentItem(contentId);
  const sign = usePdfSign(contentId);
  const progress = usePdfProgress(contentId);

  const watermarkText = formatWatermark(fullName, appUser?.phone ?? null);
  const startPage = progress.initial?.last_page ?? 1;

  return (
    <div className="-mx-4 -mt-4 flex h-[calc(100vh-2rem)] flex-col bg-slate-900 text-white sm:-mx-6 sm:-mt-6">
      <div className="flex items-center gap-3 border-b border-slate-700 px-4 py-3">
        <Link
          href="/library"
          aria-label="Back to library"
          className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">
          {item.data?.title ?? "Loading…"}
        </p>
      </div>
      <div className="relative flex-1">
        {item.isLoading || sign.isLoading || progress.isLoading ? (
          <Skeleton className="absolute inset-0 rounded-none" />
        ) : sign.error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <AlertCircle className="size-10 text-red-400" />
            <p className="font-semibold">Could not load PDF</p>
            <p className="max-w-sm text-sm text-white/70">
              {sign.error instanceof Error
                ? sign.error.message
                : "Please try again."}
            </p>
            <Button asChild variant="outline" className="bg-white/10 text-white">
              <Link href="/library">Back to library</Link>
            </Button>
          </div>
        ) : sign.data ? (
          <>
            <PdfViewer
              url={sign.data.signed_url}
              startPage={startPage}
              onPageChange={(page, total) => {
                void progress.setPage(page, total);
              }}
            />
            <PdfWatermark text={watermarkText} />
          </>
        ) : null}
      </div>
    </div>
  );
}
