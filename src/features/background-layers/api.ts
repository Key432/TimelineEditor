import type { TimelineBackgroundLayer } from "@/features/background-layers/types";
import type { BackgroundPeriodInput } from "@/features/background-layers/validation";

export const backgroundLayerKeys = {
  list: (projectId: string) =>
    ["projects", projectId, "background-layers"] as const,
};

async function responseJson(response: Response) {
  const body = await response.json();
  if (!response.ok)
    throw new Error(body.error?.message ?? "年代背景の処理に失敗しました。");
  return body;
}

export async function listBackgroundLayers(projectId: string) {
  const response = await fetch(`/api/projects/${projectId}/background-layers`);
  return (await responseJson(response)).layers as TimelineBackgroundLayer[];
}

export async function createBackgroundLayer(
  projectId: string,
  input: {
    name: string;
    description?: string | null;
    isVisible?: boolean;
  },
) {
  const response = await fetch(`/api/projects/${projectId}/background-layers`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return (await responseJson(response)).layer as TimelineBackgroundLayer;
}

export async function updateBackgroundLayer(
  projectId: string,
  layerId: string,
  input: {
    name?: string;
    description?: string | null;
    isVisible?: boolean;
    sortOrder?: number;
  },
) {
  const response = await fetch(
    `/api/projects/${projectId}/background-layers/${layerId}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return (await responseJson(response)).layer as TimelineBackgroundLayer;
}

export async function deleteBackgroundLayer(
  projectId: string,
  layerId: string,
) {
  const response = await fetch(
    `/api/projects/${projectId}/background-layers/${layerId}`,
    { method: "DELETE" },
  );
  await responseJson(response);
}

export async function saveBackgroundPeriod(
  projectId: string,
  layerId: string,
  periodId: string | null,
  input: BackgroundPeriodInput,
) {
  const path = periodId
    ? `/api/projects/${projectId}/background-layers/${layerId}/periods/${periodId}`
    : `/api/projects/${projectId}/background-layers/${layerId}/periods`;
  const response = await fetch(path, {
    method: periodId ? "PUT" : "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return responseJson(response);
}

export async function deleteBackgroundPeriod(
  projectId: string,
  layerId: string,
  periodId: string,
) {
  const response = await fetch(
    `/api/projects/${projectId}/background-layers/${layerId}/periods/${periodId}`,
    { method: "DELETE" },
  );
  await responseJson(response);
}
