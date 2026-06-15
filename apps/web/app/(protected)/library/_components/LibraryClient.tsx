"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useDebouncedCallback } from "use-debounce";
import {
  Search,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  PlayCircle,
  FileText,
  StickyNote,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useLibraryTree } from "@/features/library/useLibraryTree";
import type { Subject, Chapter, Topic, ContentItem } from "@/features/library/types";

interface Props {
  initialSubject: string | null;
  initialChapter: string | null;
  initialTopic: string | null;
  initialQuery: string;
}

function iconForKind(kind: ContentItem["kind"]) {
  if (kind === "video") return <PlayCircle className="size-5 text-primary" />;
  if (kind === "pdf") return <FileText className="size-5 text-red-500" />;
  return <StickyNote className="size-5 text-slate-500" />;
}

// URL is the source of truth for drill-down (subject/chapter/topic). This lets
// the browser back button move back up the tree (router.push, NOT replace),
// and lets the user share a deep link. Search debounces into ?q= with
// router.replace (no history bloat per keystroke).
export function LibraryClient({
  initialSubject,
  initialChapter,
  initialTopic,
  initialQuery,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read drill-down state from the URL on every render — this is what makes
  // the browser back button work (popstate updates searchParams).
  const subjectId = searchParams.get("subject") ?? initialSubject;
  const chapterId = searchParams.get("chapter") ?? initialChapter;
  const topicId = searchParams.get("topic") ?? initialTopic;

  // Search input is local + debounced; only the URL persists the committed
  // query (?q=).
  const urlQuery = searchParams.get("q") ?? initialQuery;
  const [searchInput, setSearchInput] = useState(urlQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(urlQuery);

  // If the URL q= changes from outside (browser back), sync local input.
  useEffect(() => {
    setSearchInput(urlQuery);
    setDebouncedQuery(urlQuery);
  }, [urlQuery]);

  const tree = useLibraryTree(debouncedQuery);

  const syncDebounced = useDebouncedCallback((v: string) => {
    setDebouncedQuery(v);
    const params = new URLSearchParams(searchParams.toString());
    if (v) params.set("q", v);
    else params.delete("q");
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, 300);

  const onSearchChange = (v: string) => {
    setSearchInput(v);
    syncDebounced(v);
  };

  // setNav uses router.push so each drill-down is a separate history entry.
  // Browser back unwinds one level at a time. The first `null,null,null` push
  // gets the user back to the subjects view; another back leaves the library.
  const setNav = useCallback(
    (subject: string | null, chapter: string | null, topic: string | null) => {
      const params = new URLSearchParams();
      if (subject) params.set("subject", subject);
      if (chapter) params.set("chapter", chapter);
      if (topic) params.set("topic", topic);
      if (debouncedQuery) params.set("q", debouncedQuery);
      const qs = params.toString();
      router.push(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [debouncedQuery, pathname, router],
  );

  const subjects: Subject[] = tree.data?.subjects ?? [];
  const subject: Subject | null =
    subjects.find((s) => s.id === subjectId) ?? null;
  const chapter: Chapter | null =
    subject?.chapters.find((c) => c.id === chapterId) ?? null;
  const topic: Topic | null = chapter?.topics.find((t) => t.id === topicId) ?? null;

  const view = topic ? "items" : chapter ? "topics" : subject ? "chapters" : "subjects";
  const breadcrumbBack = useMemo(() => {
    if (topic) return () => setNav(subjectId, chapterId, null);
    if (chapter) return () => setNav(subjectId, null, null);
    if (subject) return () => setNav(null, null, null);
    return null;
  }, [topic, chapter, subject, subjectId, chapterId, setNav]);

  const title = topic?.name ?? chapter?.name ?? subject?.name ?? "Library";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        {breadcrumbBack ? (
          <button
            type="button"
            aria-label="Back"
            onClick={breadcrumbBack}
            className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          >
            <ChevronLeft className="size-4" />
          </button>
        ) : (
          <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-blue-200 ring-1 ring-blue-200/50">
            <BookOpen className="size-6 text-primary" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-extrabold text-slate-900">
            {title}
          </h1>
          <p className="text-sm text-slate-500">
            {view === "subjects"
              ? "Subjects → Chapters → Topics → Items"
              : view === "chapters"
                ? "Chapters"
                : view === "topics"
                  ? "Topics"
                  : "Content"}
          </p>
        </div>
      </div>

      {view === "subjects" ? (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search content…"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
            data-testid="library-search"
          />
        </div>
      ) : null}

      {tree.isLoading ? (
        <>
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </>
      ) : view === "subjects" ? (
        subjects.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-500">
            No content available yet.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {subjects.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setNav(s.id, null, null)}
                className="flex items-center rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
              >
                <div className="mr-3 flex size-12 items-center justify-center rounded-2xl bg-blue-50">
                  <BookOpen className="size-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">
                    {s.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {s.item_count} item{s.item_count === 1 ? "" : "s"}
                  </p>
                </div>
                <ChevronRight className="size-4 text-slate-400" />
              </button>
            ))}
          </div>
        )
      ) : view === "chapters" ? (
        subject!.chapters.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-500">
            No chapters yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {subject!.chapters.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setNav(subjectId, c.id, null)}
                  disabled={c.item_count === 0}
                  className="flex w-full items-center rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:opacity-50 disabled:hover:bg-white"
                >
                  <div className="mr-3 flex size-10 items-center justify-center rounded-2xl bg-blue-50">
                    <BookOpen className="size-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {c.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {c.item_count} item{c.item_count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <ChevronRight className="size-4 text-slate-400" />
                </button>
              </li>
            ))}
          </ul>
        )
      ) : view === "topics" ? (
        chapter!.topics.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-500">
            No topics yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {chapter!.topics.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setNav(subjectId, chapterId, t.id)}
                  disabled={t.items.length === 0}
                  className="flex w-full items-center rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:opacity-50 disabled:hover:bg-white"
                >
                  <div className="mr-3 flex size-10 items-center justify-center rounded-2xl bg-blue-50">
                    <BookOpen className="size-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {t.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t.items.length} item{t.items.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <ChevronRight className="size-4 text-slate-400" />
                </button>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="space-y-2">
          {topic!.items.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-500">
              No content for this topic yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {topic!.items.map((item) => {
                const href = item.kind === "pdf" ? `/pdf/${item.id}` : `/video/${item.id}`;
                if (item.kind === "note") {
                  return (
                    <li
                      key={item.id}
                      className="flex items-center rounded-2xl border border-slate-100 bg-white p-4 opacity-70"
                    >
                      <div className="mr-3 flex size-10 items-center justify-center rounded-2xl bg-slate-100">
                        {iconForKind(item.kind)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {item.title}
                        </p>
                        <p className="text-xs text-slate-500">Note · coming soon</p>
                      </div>
                    </li>
                  );
                }
                return (
                  <li key={item.id}>
                    <Link
                      href={href}
                      className="flex items-center rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
                    >
                      <div className="mr-3 flex size-10 items-center justify-center rounded-2xl bg-blue-50">
                        {iconForKind(item.kind)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {item.title}
                        </p>
                        <p className="text-xs text-slate-500 capitalize">
                          {item.kind}
                          {item.duration_sec
                            ? ` · ${Math.round(item.duration_sec / 60)} min`
                            : ""}
                        </p>
                      </div>
                      <ChevronRight className="size-4 text-slate-400" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
