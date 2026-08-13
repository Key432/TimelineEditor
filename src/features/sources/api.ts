import type { MissingSourceEntity, Source } from "@/features/sources/types";
import type { SourceInput } from "@/features/sources/validation";
import { requestJson } from "@/lib/api-client";

export async function listSources(projectId: string) {
  return requestJson<{
    sources: Source[];
    missingEntities: MissingSourceEntity[];
  }>(
    `/api/projects/${projectId}/sources`,
    undefined,
    "出典の処理に失敗しました。",
  );
}

export async function createSource(projectId: string, input: SourceInput) {
  const result = await requestJson<{ source: Source }>(
    `/api/projects/${projectId}/sources`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    "出典の処理に失敗しました。",
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
    "出典の処理に失敗しました。",
  );
  return result.source;
}

export async function deleteSource(projectId: string, sourceId: string) {
  await requestJson<Record<string, never>>(
    `/api/projects/${projectId}/sources/${sourceId}`,
    { method: "DELETE" },
    "出典の処理に失敗しました。",
  );
}

export const sourceKeys = {
  list: (projectId: string) => ["projects", projectId, "sources"] as const,
};
