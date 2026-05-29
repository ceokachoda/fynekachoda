"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Minus, Plus } from "lucide-react";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

// Bundle the pdf.js worker locally. `new URL(..., import.meta.url)` is the
// react-pdf-recommended pattern that webpack 5 (Next 15) handles natively —
// emits the worker file and rewrites the URL.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.25;

interface PdfViewerProps {
  url: string;
  startPage?: number;
  onPageChange?: (page: number, totalPages: number) => void;
}

export function PdfViewer({ url, startPage = 1, onPageChange }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(startPage);
  const [scale, setScale] = useState<number>(1);
  const [baseWidth, setBaseWidth] = useState<number>(900);
  const [error, setError] = useState<string | null>(null);

  // Until we've scrolled to the saved page, suppress observer-driven progress
  // writes — otherwise the page-1 IntersectionObserver hit on mount overwrites
  // the saved `last_page` with 1 and resume is lost.
  const seekedRef = useRef(false);
  const pageNodes = useRef<Map<number, HTMLDivElement>>(new Map());

  // Responsive page width (recomputed on resize); zoom multiplies it.
  useEffect(() => {
    const compute = () =>
      setBaseWidth(Math.min(900, Math.max(280, window.innerWidth - 40)));
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  const onLoadSuccess = useCallback((info: { numPages: number }) => {
    setNumPages(info.numPages);
  }, []);

  const onLoadError = useCallback((err: Error) => {
    setError(err.message || "Could not load PDF.");
  }, []);

  const registerNode = useCallback((page: number, node: HTMLDivElement) => {
    pageNodes.current.set(page, node);
  }, []);

  // Scroll to the saved page once IT has rendered (canvas has real height).
  const onPageRendered = useCallback(
    (page: number) => {
      if (seekedRef.current || numPages === 0) return;
      const target = Math.min(Math.max(startPage, 1), numPages);
      if (page !== target) return;
      if (target > 1) {
        pageNodes.current.get(target)?.scrollIntoView({ block: "start" });
      }
      seekedRef.current = true;
      setCurrentPage(target);
      onPageChange?.(target, numPages);
    },
    [numPages, startPage, onPageChange],
  );

  const onPageVisible = useCallback(
    (page: number) => {
      if (!seekedRef.current) return; // ignore the initial page-1 hit
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
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-700 bg-slate-900/95 px-4 py-2 text-slate-200 backdrop-blur">
        <span className="text-sm font-semibold tabular-nums">
          Page {currentPage} / {numPages || "…"}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Zoom out"
            disabled={scale <= MIN_SCALE}
            onClick={() => setScale((s) => Math.max(MIN_SCALE, s - SCALE_STEP))}
            className="flex size-8 items-center justify-center rounded-md border border-slate-600 text-slate-200 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-40"
          >
            <Minus className="size-4" />
          </button>
          <span className="w-12 text-center text-xs tabular-nums text-slate-300">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            aria-label="Zoom in"
            disabled={scale >= MAX_SCALE}
            onClick={() => setScale((s) => Math.min(MAX_SCALE, s + SCALE_STEP))}
            className="flex size-8 items-center justify-center rounded-md border border-slate-600 text-slate-200 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-40"
          >
            <Plus className="size-4" />
          </button>
        </div>
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
          className="mx-auto flex flex-col items-center"
        >
          {Array.from({ length: numPages }, (_, i) => (
            <PageWithObserver
              key={i + 1}
              pageNumber={i + 1}
              width={Math.round(baseWidth * scale)}
              onVisible={onPageVisible}
              onRendered={onPageRendered}
              registerNode={registerNode}
            />
          ))}
        </Document>
      </div>
    </div>
  );
}

function PageWithObserver({
  pageNumber,
  width,
  onVisible,
  onRendered,
  registerNode,
}: {
  pageNumber: number;
  width: number;
  onVisible: (page: number) => void;
  onRendered: (page: number) => void;
  registerNode: (page: number, node: HTMLDivElement) => void;
}) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!node) return;
    registerNode(pageNumber, node);
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
  }, [node, onVisible, pageNumber, registerNode]);
  return (
    <div ref={setNode} className="mb-3 shadow-2xl">
      <Page
        pageNumber={pageNumber}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        width={width}
        onRenderSuccess={() => onRendered(pageNumber)}
      />
    </div>
  );
}
