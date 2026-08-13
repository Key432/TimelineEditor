import type {
  EntityHistoryEntry,
  HistoryEntityType,
  TrashEntry,
} from "@/features/history/types";
import { requestJson } from "@/lib/api-client";

export async function listEntityHistory(
  projectId: string,
  entityType: HistoryEntityType,
  entityId: string,
) {
  const query = new URLSearchParams({ entityType, entityId });
  const data = await requestJson<{ history: EntityHistoryEntry[] }>(
    `/api/projects/${projectId}/history?${query}`,
  );
  return data.history;
}

export async function createCheckpoint(
  projectId: string,
  entityType: HistoryEntityType,
  entityId: string,
) {
  const data = await requestJson<{ history: EntityHistoryEntry }>(
    `/api/projects/${projectId}/history`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType, entityId }),
    },
  );
  return data.history;
}

export async function restoreHistory(projectId: string, historyId: string) {
  return requestJson<{ restored: true }>(
    `/api/projects/${projectId}/history/${historyId}/restore`,
    { method: "POST" },
  );
}

export async function listTrash(projectId: string) {
  const data = await requestJson<{ trash: TrashEntry[] }>(
    `/api/projects/${projectId}/trash`,
  );
  return data.trash;
}

export async function restoreTrashEntry(
  projectId: string,
  entityType: HistoryEntityType,
  entityId: string,
) {
  return requestJson<{ restored: true }>(
    `/api/projects/${projectId}/trash/${entityType}/${entityId}/restore`,
    { method: "POST" },
  );
}

export async function purgeTrashEntry(
  projectId: string,
  entityType: HistoryEntityType,
  entityId: string,
) {
  await requestJson<void>(
    `/api/projects/${projectId}/trash/${entityType}/${entityId}`,
    { method: "DELETE" },
    "完全削除に失敗しました。",
  );
}

export const historyKeys = {
  entity: (
    projectId: string,
    entityType: HistoryEntityType,
    entityId: string,
  ) => ["projects", projectId, "history", entityType, entityId] as const,
  trash: (projectId: string) => ["projects", projectId, "trash"] as const,
};
