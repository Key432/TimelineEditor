import type {
  SearchResponse,
  TimelineSearchMatches,
} from "@/features/search/types";
import { requestJson } from "@/lib/api-client";

export function searchGlobally(
  query: string,
  options: { type?: string; page?: number; pageSize?: number } = {},
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ q: query });
  if (options.type) params.set("type", options.type);
  if (options.page) params.set("page", String(options.page));
  if (options.pageSize) params.set("pageSize", String(options.pageSize));
  return requestJson<SearchResponse>(
    `/api/search?${params}`,
    { signal },
    "検索に失敗しました。",
  );
}

export function searchTimeline(
  projectId: string,
  query: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ q: query });
  return requestJson<TimelineSearchMatches>(
    `/api/projects/${projectId}/timeline/search?${params}`,
    { signal },
    "検索に失敗しました。",
  );
}
