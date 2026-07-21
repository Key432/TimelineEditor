import type {
  TimelineEvent,
  TimelineEventSummary,
} from "@/features/timeline-events/types";
import type { TimelineEventInput } from "@/features/timeline-events/validation";

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
) {
  const data = await requestJson<{ event: TimelineEvent }>(
    `/api/projects/${projectId}/events/${eventId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return data.event;
}

export async function deleteTimelineEvent(projectId: string, eventId: string) {
  const response = await fetch(`/api/projects/${projectId}/events/${eventId}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("イベントアイテムを削除できませんでした。");
}

export const timelineEventKeys = {
  list: (projectId: string) =>
    ["projects", projectId, "timeline-events"] as const,
  detail: (projectId: string, eventId: string) =>
    ["projects", projectId, "timeline-events", eventId] as const,
};
