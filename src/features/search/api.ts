import type {
  SearchResponse,
  TimelineSearchMatches,
} from "@/features/search/types";

type ErrorPayload = { error?: { message?: string } };

async function requestJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ErrorPayload;
    throw new Error(payload.error?.message ?? "検索に失敗しました。");
  }
  return (await response.json()) as T;
}

export function searchGlobally(
  query: string,
  options: { type?: string; page?: number; pageSize?: number } = {},
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ q: query });
  if (options.type) params.set("type", options.type);
  if (options.page) params.set("page", String(options.page));
  if (options.pageSize) params.set("pageSize", String(options.pageSize));
  return requestJson<SearchResponse>(`/api/search?${params}`, signal);
}

export function searchTimeline(
  projectId: string,
  query: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ q: query });
  return requestJson<TimelineSearchMatches>(
    `/api/projects/${projectId}/timeline/search?${params}`,
    signal,
  );
}
