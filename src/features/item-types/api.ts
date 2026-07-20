import type { TimelineItemType } from "@/features/item-types/types";
import type {
  CreateItemTypeInput,
  UpdateItemTypeInput,
} from "@/features/item-types/validation";

type ApiErrorPayload = { error?: { message?: string } };

export class ItemTypeApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ItemTypeApiError";
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const payload = (await response
      .json()
      .catch(() => ({}))) as ApiErrorPayload;
    throw new ItemTypeApiError(
      payload.error?.message ?? "処理に失敗しました。",
      response.status,
    );
  }
  return (await response.json()) as T;
}

export async function listItemTypes(projectId: string) {
  const data = await requestJson<{ itemTypes: TimelineItemType[] }>(
    `/api/projects/${projectId}/item-types`,
  );
  return data.itemTypes;
}

export async function createItemType(
  projectId: string,
  input: CreateItemTypeInput,
) {
  const data = await requestJson<{ itemType: TimelineItemType }>(
    `/api/projects/${projectId}/item-types`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return data.itemType;
}

export async function updateItemType(
  projectId: string,
  typeId: string,
  input: UpdateItemTypeInput,
) {
  const data = await requestJson<{ itemType: TimelineItemType }>(
    `/api/projects/${projectId}/item-types/${typeId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return data.itemType;
}

export async function deleteItemType(projectId: string, typeId: string) {
  const response = await fetch(
    `/api/projects/${projectId}/item-types/${typeId}`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    const payload = (await response
      .json()
      .catch(() => ({}))) as ApiErrorPayload;
    throw new ItemTypeApiError(
      payload.error?.message ?? "削除に失敗しました。",
      response.status,
    );
  }
}

export const itemTypeKeys = {
  list: (projectId: string) => ["projects", projectId, "item-types"] as const,
};
