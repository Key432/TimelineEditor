import type {
  TimelineItemCreateResult,
  TimelineItem,
  TimelineItemSummary,
} from "@/features/timeline-items/types";
import type {
  MoveTimelineItemInput,
  TimelineItemInput,
} from "@/features/timeline-items/validation";
import type { TimelineEventDraftInput } from "@/features/timeline-events/validation";
import { requestJson } from "@/lib/api-client";

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
  events: TimelineEventDraftInput[] = [],
) {
  return requestJson<TimelineItemCreateResult>(
    `/api/projects/${projectId}/items`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item: input, events }),
    },
  );
}

export async function updateTimelineItem(
  projectId: string,
  itemId: string,
  input: TimelineItemInput,
  expectedUpdatedAt: string,
) {
  const data = await requestJson<{ item: TimelineItem }>(
    `/api/projects/${projectId}/items/${itemId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: input, expectedUpdatedAt }),
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
  await requestJson<void>(
    `/api/projects/${projectId}/items/${itemId}`,
    { method: "DELETE" },
    "削除に失敗しました。",
  );
}

export const timelineItemKeys = {
  list: (projectId: string) => ["projects", projectId, "timeline"] as const,
  detail: (projectId: string, itemId: string) =>
    ["projects", projectId, "timeline-items", itemId] as const,
};
