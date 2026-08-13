import type { TimelineItemType } from "@/features/item-types/types";
import type {
  CreateItemTypeInput,
  UpdateItemTypeInput,
} from "@/features/item-types/validation";
import { requestJson } from "@/lib/api-client";

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
  await requestJson<void>(
    `/api/projects/${projectId}/item-types/${typeId}`,
    { method: "DELETE" },
    "削除に失敗しました。",
  );
}

export const itemTypeKeys = {
  list: (projectId: string) => ["projects", projectId, "item-types"] as const,
};
