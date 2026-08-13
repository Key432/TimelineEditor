import type {
  TimelineEvent,
  TimelineEventSummary,
} from "@/features/timeline-events/types";
import type { TimelineEventInput } from "@/features/timeline-events/validation";
import { requestJson } from "@/lib/api-client";

export async function listTimelineEvents(projectId: string) {
  const data = await requestJson<{ events: TimelineEventSummary[] }>(
    `/api/projects/${projectId}/events`,
  );
  return data.events;
}

export async function getTimelineEvent(projectId: string, eventId: string) {
  const data = await requestJson<{ event: TimelineEvent }>(
    `/api/projects/${projectId}/events/${eventId}`,
  );
  return data.event;
}

export async function createTimelineEvent(
  projectId: string,
  input: TimelineEventInput,
) {
  const data = await requestJson<{ event: TimelineEvent }>(
    `/api/projects/${projectId}/events`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return data.event;
}

export async function updateTimelineEvent(
  projectId: string,
  eventId: string,
  input: TimelineEventInput,
  expectedUpdatedAt: string,
) {
  const data = await requestJson<{ event: TimelineEvent }>(
    `/api/projects/${projectId}/events/${eventId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: input, expectedUpdatedAt }),
    },
  );
  return data.event;
}

export async function deleteTimelineEvent(projectId: string, eventId: string) {
  await requestJson<void>(
    `/api/projects/${projectId}/events/${eventId}`,
    { method: "DELETE" },
    "イベントアイテムを削除できませんでした。",
  );
}

export const timelineEventKeys = {
  list: (projectId: string) =>
    ["projects", projectId, "timeline-events"] as const,
  detail: (projectId: string, eventId: string) =>
    ["projects", projectId, "timeline-events", eventId] as const,
};
