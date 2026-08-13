import type { TimelineBackgroundLayer } from "@/features/background-layers/types";
import type { BackgroundPeriodInput } from "@/features/background-layers/validation";
import { requestJson } from "@/lib/api-client";

export const backgroundLayerKeys = {
  list: (projectId: string) =>
    ["projects", projectId, "background-layers"] as const,
};

export async function listBackgroundLayers(projectId: string) {
  const result = await requestJson<{ layers: TimelineBackgroundLayer[] }>(
    `/api/projects/${projectId}/background-layers`,
    undefined,
    "年代背景の処理に失敗しました。",
  );
  return result.layers;
}

export async function createBackgroundLayer(
  projectId: string,
  input: {
    name: string;
    description?: string | null;
    isVisible?: boolean;
  },
) {
  const result = await requestJson<{ layer: TimelineBackgroundLayer }>(
    `/api/projects/${projectId}/background-layers`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
    "年代背景の処理に失敗しました。",
  );
  return result.layer;
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
  const result = await requestJson<{ layer: TimelineBackgroundLayer }>(
    `/api/projects/${projectId}/background-layers/${layerId}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
    "年代背景の処理に失敗しました。",
  );
  return result.layer;
}

export async function deleteBackgroundLayer(
  projectId: string,
  layerId: string,
) {
  await requestJson<void>(
    `/api/projects/${projectId}/background-layers/${layerId}`,
    { method: "DELETE" },
    "年代背景の処理に失敗しました。",
  );
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
  return requestJson<Record<string, unknown>>(
    path,
    {
      method: periodId ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
    "年代背景の処理に失敗しました。",
  );
}

export async function deleteBackgroundPeriod(
  projectId: string,
  layerId: string,
  periodId: string,
) {
  await requestJson<void>(
    `/api/projects/${projectId}/background-layers/${layerId}/periods/${periodId}`,
    { method: "DELETE" },
    "年代背景の処理に失敗しました。",
  );
}
