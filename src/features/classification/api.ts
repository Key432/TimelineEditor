import type {
  CustomFieldDefinition,
  EventType,
  Tag,
} from "@/features/classification/types";
import type {
  CustomFieldDefinitionInput,
  EventTypeInput,
  TagInput,
} from "@/features/classification/validation";
import { requestJson } from "@/lib/api-client";

export type ClassificationData = {
  tags: Tag[];
  eventTypes: EventType[];
  customFields: CustomFieldDefinition[];
};

const request = <T>(url: string, init?: RequestInit) =>
  requestJson<T>(url, init, "分類を更新できませんでした。");

export const classificationKeys = {
  all: (projectId: string) =>
    ["projects", projectId, "classification"] as const,
};
export const listClassification = (projectId: string) =>
  request<ClassificationData>(`/api/projects/${projectId}/classification`);
export const createTag = (projectId: string, values: TagInput) =>
  request<{ tag: Tag }>(`/api/projects/${projectId}/classification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "tag", values }),
  }).then((data) => data.tag);
export const updateTag = (projectId: string, id: string, values: TagInput) =>
  request(`/api/projects/${projectId}/classification/tags/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });
export const deleteTag = (projectId: string, id: string, unusedOnly = false) =>
  request<void>(
    `/api/projects/${projectId}/classification/tags/${id}?unusedOnly=${unusedOnly}`,
    { method: "DELETE" },
  );
export const mergeTag = (projectId: string, id: string, targetId: string) =>
  request(`/api/projects/${projectId}/classification/tags/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetId }),
  });
export const createEventType = (projectId: string, values: EventTypeInput) =>
  request<{ eventType: EventType }>(
    `/api/projects/${projectId}/classification`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "eventType", values }),
    },
  ).then((data) => data.eventType);
export const updateEventType = (
  projectId: string,
  id: string,
  values: EventTypeInput,
) =>
  request(`/api/projects/${projectId}/classification/event-types/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });
export const deleteEventType = (projectId: string, id: string) =>
  request<void>(`/api/projects/${projectId}/classification/event-types/${id}`, {
    method: "DELETE",
  });
export const createCustomField = (
  projectId: string,
  values: CustomFieldDefinitionInput,
) =>
  request<{ customField: CustomFieldDefinition }>(
    `/api/projects/${projectId}/classification`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "customField", values }),
    },
  ).then((data) => data.customField);
export const deleteCustomField = (projectId: string, id: string) =>
  request<void>(
    `/api/projects/${projectId}/classification/custom-fields/${id}`,
    { method: "DELETE" },
  );
