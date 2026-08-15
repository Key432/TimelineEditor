import type {
  ComparisonDataset,
  ComparisonProjectOption,
} from "@/features/comparison/types";
import { requestJson } from "@/lib/api-client";

export async function listComparisonProjects() {
  return (
    await requestJson<{ projects: ComparisonProjectOption[] }>(
      "/api/comparison/projects",
    )
  ).projects;
}

export async function loadComparisonProject(projectId: string) {
  return (
    await requestJson<{ dataset: ComparisonDataset }>(
      `/api/comparison/projects/${projectId}`,
    )
  ).dataset;
}

export const comparisonKeys = {
  projects: ["comparison", "projects"] as const,
  project: (projectId: string) => ["comparison", "project", projectId] as const,
};
