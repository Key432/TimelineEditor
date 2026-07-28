import type {
  MissingSourceEntity,
  Source,
  SourceCitation,
} from "@/features/sources/types";
import type { SourceInput } from "@/features/sources/validation";

type ErrorPayload = { error?: { message?: string } };

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ErrorPayload;
    throw new Error(payload.error?.message ?? "出典の処理に失敗しました。");
  }
  return (await response.json()) as T;
}

export async function listSources(projectId: string) {
  return requestJson<{
    sources: Source[];
    missingEntities: MissingSourceEntity[];
  }>(`/api/projects/${projectId}/sources`);
}

export async function createSource(projectId: string, input: SourceInput) {
  const result = await requestJson<{ source: Source }>(
    `/api/projects/${projectId}/sources`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return result.source;
}

export async function updateSource(
  projectId: string,
  sourceId: string,
  input: SourceInput,
) {
  const result = await requestJson<{ source: Source }>(
    `/api/projects/${projectId}/sources/${sourceId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return result.source;
}

export async function deleteSource(projectId: string, sourceId: string) {
  await requestJson<Record<string, never>>(
    `/api/projects/${projectId}/sources/${sourceId}`,
    { method: "DELETE" },
  );
}

export function citationInputs(citations: SourceCitation[]) {
  return citations.map(({ sourceId, pages, chapter, quote, notes }) => ({
    sourceId,
    pages,
    chapter,
    quote,
    notes,
  }));
}

export const sourceKeys = {
  list: (projectId: string) => ["projects", projectId, "sources"] as const,
};
