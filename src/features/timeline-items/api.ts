import type {
  TimelineItem,
  TimelineItemSummary,
} from "@/features/timeline-items/types";
import type {
  MoveTimelineItemInput,
  TimelineItemInput,
} from "@/features/timeline-items/validation";

type ApiErrorPayload = { error?: { message?: string } };

export class TimelineItemApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "TimelineItemApiError";
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const payload = (await response
      .json()
      .catch(() => ({}))) as ApiErrorPayload;
    throw new TimelineItemApiError(
      payload.error?.message ?? "処理に失敗しました。",
      response.status,
    );
  }
  return (await response.json()) as T;
}

export async function listTimelineItems(projectId: string) {
  const data = await requestJson<{ items: TimelineItemSummary[] }>(
    `/api/projects/${projectId}/timeline`,
  );
  return data.items;
}

export async function getTimelineItem(projectId: string, itemId: string) {
  const data = await requestJson<{ item: TimelineItem }>(
    `/api/projects/${projectId}/items/${itemId}`,
  );
  return data.item;
}

export async function createTimelineItem(
  projectId: string,
  input: TimelineItemInput,
) {
  const data = await requestJson<{ item: TimelineItem }>(
    `/api/projects/${projectId}/items`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return data.item;
}

export async function updateTimelineItem(
  projectId: string,
  itemId: string,
  input: TimelineItemInput,
) {
  const data = await requestJson<{ item: TimelineItem }>(
    `/api/projects/${projectId}/items/${itemId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return data.item;
}

export async function moveTimelineItem(
  projectId: string,
  itemId: string,
  input: MoveTimelineItemInput,
) {
  const data = await requestJson<{ items: TimelineItemSummary[] }>(
    `/api/projects/${projectId}/items/${itemId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return data.items;
}

export async function deleteTimelineItem(projectId: string, itemId: string) {
  const response = await fetch(`/api/projects/${projectId}/items/${itemId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const payload = (await response
      .json()
      .catch(() => ({}))) as ApiErrorPayload;
    throw new TimelineItemApiError(
      payload.error?.message ?? "削除に失敗しました。",
      response.status,
    );
  }
}

export const timelineItemKeys = {
  list: (projectId: string) => ["projects", projectId, "timeline"] as const,
  detail: (projectId: string, itemId: string) =>
    ["projects", projectId, "timeline-items", itemId] as const,
};
