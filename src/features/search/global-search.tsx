"use client";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { searchGlobally } from "@/features/search/api";
import { withSearchReturn } from "@/lib/navigation";

const TYPE_LABELS = {
  project: "プロジェクト",
  timeline_item: "タイムライン",
  timeline_event: "イベント",
} as const;

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    const timer = window.setTimeout(() => setDebouncedQuery(trimmed), 300);
    return () => window.clearTimeout(timer);
  }, [query]);
  const suggestions = useQuery({
    queryKey: ["global-search", debouncedQuery],
    queryFn: ({ signal }) =>
      searchGlobally(debouncedQuery, { pageSize: 6 }, signal),
    enabled: debouncedQuery.length > 0,
    staleTime: 30_000,
  });
  const results = suggestions.data?.results ?? [];

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative mx-4 hidden w-full max-w-md md:block"
    >
      <form
        action="/search"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = query.trim();
          if (!trimmed) return;
          setOpen(false);
          window.location.assign(`/search?q=${encodeURIComponent(trimmed)}`);
        }}
      >
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          aria-autocomplete="list"
          aria-controls="global-search-suggestions"
          aria-expanded={open}
          aria-label="全体検索"
          className="h-9 bg-background pr-3 pl-9"
          name="q"
          placeholder="プロジェクト全体を検索"
          role="combobox"
          value={query}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            if (!value.trim()) {
              setOpen(false);
            } else {
              setOpen(true);
            }
          }}
          onFocus={() => query.trim() && setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
        />
      </form>
      {open ? (
        <div
          id="global-search-suggestions"
          className="absolute top-11 right-0 left-0 z-50 overflow-hidden rounded-lg border bg-popover shadow-lg"
          role="listbox"
        >
          {suggestions.isFetching || debouncedQuery !== query.trim() ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">検索中…</p>
          ) : results.length > 0 ? (
            <>
              {results.map((result) => (
                <Link
                  key={`${result.entityType}:${result.entityId}`}
                  className="block w-full border-b px-4 py-3 text-left last:border-b-0 hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                  href={
                    result.entityType === "project"
                      ? result.detailPath
                      : withSearchReturn(
                          result.detailPath,
                          `/search?q=${encodeURIComponent(query.trim())}`,
                        )
                  }
                  role="option"
                  onClick={() => setOpen(false)}
                >
                  <span className="block truncate text-sm font-medium">
                    {result.title}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {TYPE_LABELS[result.entityType]} · {result.projectName}
                  </span>
                </Link>
              ))}
              <Link
                className="block w-full bg-muted/40 px-4 py-2.5 text-left text-sm font-medium text-primary hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                href={`/search?q=${encodeURIComponent(query.trim())}`}
                onClick={() => setOpen(false)}
              >
                「{query.trim()}」の検索結果をすべて表示
              </Link>
            </>
          ) : (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              一致する候補はありません。
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
