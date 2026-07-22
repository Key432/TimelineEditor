import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatHistoricalDate } from "@/features/timeline-items/historical-date";
import type { SearchEntityType, SearchResult } from "@/features/search/types";
import { SearchService } from "@/lib/services/search-service";
import { createClient } from "@/lib/supabase/server";

const LABELS: Record<SearchEntityType, string> = {
  project: "プロジェクト",
  timeline_item: "タイムラインアイテム",
  timeline_event: "イベントアイテム",
};

function resultDate(result: SearchResult) {
  if (!result.start) return null;
  if (result.entityType === "timeline_event") {
    return `${result.isStartApproximate ? "約 " : ""}${formatHistoricalDate(result.start)}`;
  }
  if (!result.endDateStatus) {
    return `${result.isStartApproximate ? "約 " : ""}${formatHistoricalDate(result.start)}`;
  }
  const end =
    result.endDateStatus === "ongoing"
      ? "継続中"
      : result.endDateStatus === "unknown"
        ? "終了不明"
        : `${result.isEndApproximate ? "約 " : ""}${formatHistoricalDate(result.end)}`;
  return `${result.isStartApproximate ? "約 " : ""}${formatHistoricalDate(result.start)} — ${end}`;
}

function typeHref(query: string, type?: SearchEntityType) {
  const params = new URLSearchParams({ q: query });
  if (type) params.set("type", type);
  return `/search?${params}`;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    type?: string | string[];
    page?: string | string[];
  }>;
}) {
  const raw = await searchParams;
  const query = typeof raw.q === "string" ? raw.q.trim() : "";
  const type =
    typeof raw.type === "string" && raw.type in LABELS
      ? (raw.type as SearchEntityType)
      : undefined;
  const page =
    typeof raw.page === "string" && /^\d+$/.test(raw.page)
      ? Math.max(1, Number(raw.page))
      : 1;

  if (!query) {
    return (
      <div className="rounded-xl border border-dashed bg-card px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">全体検索</h1>
        <p className="mt-2 text-muted-foreground">
          ヘッダーの検索窓からプロジェクト、タイムライン、イベントを検索できます。
        </p>
      </div>
    );
  }

  const response = await new SearchService(await createClient()).global({
    q: query,
    type,
    page,
    pageSize: 12,
  });
  const pageCount = Math.max(1, Math.ceil(response.total / response.pageSize));
  const grouped = new Map<SearchEntityType, SearchResult[]>();
  for (const result of response.results) {
    const current = grouped.get(result.entityType) ?? [];
    current.push(result);
    grouped.set(result.entityType, current);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">全体検索</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          「{query}」の検索結果 {response.total}件
        </p>
      </header>

      <nav aria-label="検索結果の種類" className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant={!type ? "default" : "outline"}>
          <Link href={typeHref(query)}>すべて</Link>
        </Button>
        {(Object.keys(LABELS) as SearchEntityType[]).map((entityType) => (
          <Button
            key={entityType}
            asChild
            size="sm"
            variant={type === entityType ? "default" : "outline"}
          >
            <Link href={typeHref(query, entityType)}>{LABELS[entityType]}</Link>
          </Button>
        ))}
      </nav>

      {response.results.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-12 text-center text-muted-foreground">
          一致するデータはありません。
        </div>
      ) : (
        <div className="space-y-8">
          {(Object.keys(LABELS) as SearchEntityType[]).map((entityType) => {
            const results = grouped.get(entityType);
            if (!results?.length) return null;
            return (
              <section
                key={entityType}
                aria-labelledby={`results-${entityType}`}
              >
                <h2
                  id={`results-${entityType}`}
                  className="mb-3 text-lg font-semibold"
                >
                  {LABELS[entityType]}
                </h2>
                <div className="divide-y overflow-hidden rounded-xl border bg-card">
                  {results.map((result) => (
                    <a
                      key={`${result.entityType}:${result.entityId}`}
                      className="block px-5 py-4 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                      href={result.detailPath}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="font-medium">{result.title}</h3>
                          <p className="text-xs text-muted-foreground">
                            {result.projectName}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {LABELS[result.entityType]}
                          </Badge>
                          {resultDate(result) ? (
                            <span className="text-xs text-muted-foreground">
                              {resultDate(result)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {result.excerpt}
                      </p>
                    </a>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {pageCount > 1 ? (
        <nav
          aria-label="検索結果ページ"
          className="flex items-center justify-center gap-3"
        >
          <Button asChild={page > 1} disabled={page <= 1} variant="outline">
            {page > 1 ? (
              <Link href={`${typeHref(query, type)}&page=${page - 1}`}>
                前へ
              </Link>
            ) : (
              "前へ"
            )}
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {pageCount}
          </span>
          <Button
            asChild={page < pageCount}
            disabled={page >= pageCount}
            variant="outline"
          >
            {page < pageCount ? (
              <Link href={`${typeHref(query, type)}&page=${page + 1}`}>
                次へ
              </Link>
            ) : (
              "次へ"
            )}
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
