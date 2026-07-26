import type {
  TimelineSavedView,
  TimelineViewConfiguration,
} from "@/features/timeline-views/types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      payload?.error?.message ?? "保存済みビューを処理できませんでした。",
    );
  }
  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T);
}

export async function listTimelineSavedViews(projectId: string) {
  return (
    await request<{ views: TimelineSavedView[] }>(
      `/api/projects/${projectId}/saved-views`,
    )
  ).views;
}

export async function createTimelineSavedView(
  projectId: string,
  name: string,
  configuration: TimelineViewConfiguration,
) {
  return (
    await request<{ view: TimelineSavedView }>(
      `/api/projects/${projectId}/saved-views`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, configuration }),
      },
    )
  ).view;
}

export async function updateTimelineSavedView(
  projectId: string,
  viewId: string,
  name: string,
  configuration: TimelineViewConfiguration,
) {
  return (
    await request<{ view: TimelineSavedView }>(
      `/api/projects/${projectId}/saved-views/${viewId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, configuration }),
      },
    )
  ).view;
}

export async function deleteTimelineSavedView(
  projectId: string,
  viewId: string,
) {
  await request<void>(`/api/projects/${projectId}/saved-views/${viewId}`, {
    method: "DELETE",
  });
}

export const timelineSavedViewKeys = {
  list: (projectId: string) => ["projects", projectId, "saved-views"] as const,
};
