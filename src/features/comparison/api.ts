import type {
  ComparisonDataset,
  ComparisonSavedView,
  ComparisonViewConfiguration,
} from "@/features/comparison/types";
import { requestJson } from "@/lib/api-client";

export async function loadComparisonProject(
  projectId: string,
  from: number,
  to: number,
) {
  const params = new URLSearchParams({ from: String(from), to: String(to) });
  return (
    await requestJson<{ dataset: ComparisonDataset }>(
      `/api/comparison/projects/${projectId}?${params}`,
    )
  ).dataset;
}

export async function createComparisonSavedView(
  name: string,
  configuration: ComparisonViewConfiguration,
) {
  return (
    await requestJson<{ view: ComparisonSavedView }>(
      "/api/comparison/saved-views",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, configuration }),
      },
    )
  ).view;
}

export async function updateComparisonSavedView(
  viewId: string,
  name: string,
  configuration: ComparisonViewConfiguration,
) {
  return (
    await requestJson<{ view: ComparisonSavedView }>(
      `/api/comparison/saved-views/${viewId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, configuration }),
      },
    )
  ).view;
}

export async function deleteComparisonSavedView(viewId: string) {
  await requestJson<void>(`/api/comparison/saved-views/${viewId}`, {
    method: "DELETE",
  });
}

export const comparisonKeys = {
  project: (projectId: string, from: number, to: number) =>
    ["comparison", "project", projectId, from, to] as const,
  views: ["comparison", "saved-views"] as const,
};
