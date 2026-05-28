"use client";

import { useCallback, useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

// Bundle the pdf.js worker locally. `new URL(..., import.meta.url)` is the
// react-pdf-recommended pattern that webpack 5 (Next 15) handles natively —
// emits the worker file and rewrites the URL.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

interface PdfViewerProps {
  url: string;
  startPage?: number;
  onPageChange?: (page: number, totalPages: number) => void;
}

export function PdfViewer({ url, startPage = 1, onPageChange }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(startPage);
  const [error, setError] = useState<string | null>(null);

  // Notify on initial load (so progress hook can seek to startPage).
  useEffect(() => {
    if (numPages > 0) {
      onPageChange?.(currentPage, numPages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numPages]);

  const onLoadSuccess = useCallback((info: { numPages: number }) => {
    setNumPages(info.numPages);
  }, []);

  const onLoadError = useCallback((err: Error) => {
    setError(err.message || "Could not load PDF.");
  }, []);

  // Track which page is most visible via IntersectionObserver.
  const onPageVisible = useCallback(
    (page: number) => {
      setCurrentPage(page);
      onPageChange?.(page, numPages);
    },
    [onPageChange, numPages],
  );

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-900 p-8 text-center text-red-300">
        {error}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-700 bg-slate-900/95 px-4 py-2 text-slate-200 backdrop-blur">
        <span className="text-sm font-semibold">
          Page {currentPage} / {numPages || "…"}
        </span>
      </div>
      <div className="flex-1 overflow-auto bg-slate-800 px-2 py-4">
        <Document
          file={url}
          onLoadSuccess={onLoadSuccess}
          onLoadError={onLoadError}
          loading={
            <div className="py-16 text-center text-sm text-slate-300">
              Loading PDF…
            </div>
          }
          className="mx-auto flex max-w-[920px] flex-col items-center"
        >
          {Array.from({ length: numPages }, (_, i) => (
            <PageWithObserver
              key={i + 1}
              pageNumber={i + 1}
              onVisible={onPageVisible}
            />
          ))}
        </Document>
      </div>
    </div>
  );
}

function PageWithObserver({
  pageNumber,
  onVisible,
}: {
  pageNumber: number;
  onVisible: (page: number) => void;
}) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio > 0.5) {
            onVisible(pageNumber);
          }
        }
      },
      { threshold: [0, 0.5, 1] },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [node, onVisible, pageNumber]);
  return (
    <div ref={setNode} className="mb-3 shadow-2xl">
      <Page
        pageNumber={pageNumber}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        width={Math.min(900, typeof window !== "undefined" ? window.innerWidth - 40 : 900)}
      />
    </div>
  );
}
