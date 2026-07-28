import type {
  EntityHistoryEntry,
  HistoryEntityType,
  TrashEntry,
} from "@/features/history/types";

type ApiErrorPayload = { error?: { message?: string } };

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const payload = (await response
      .json()
      .catch(() => ({}))) as ApiErrorPayload;
    throw new Error(payload.error?.message ?? "処理に失敗しました。");
  }
  return (await response.json()) as T;
}

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
  const response = await fetch(
    `/api/projects/${projectId}/trash/${entityType}/${entityId}`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    const payload = (await response
      .json()
      .catch(() => ({}))) as ApiErrorPayload;
    throw new Error(payload.error?.message ?? "完全削除に失敗しました。");
  }
}

export const historyKeys = {
  entity: (
    projectId: string,
    entityType: HistoryEntityType,
    entityId: string,
  ) => ["projects", projectId, "history", entityType, entityId] as const,
  trash: (projectId: string) => ["projects", projectId, "trash"] as const,
};
