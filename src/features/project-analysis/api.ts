import type {
  DuplicateCandidate,
  ProjectAnalysisSummary,
  ProjectAnalysisFilters,
  ProjectStatistics,
  QualityIssue,
} from "@/features/project-analysis/analysis";
import { requestJson } from "@/lib/api-client";

export const projectAnalysisKeys = {
  all: (projectId: string) => ["projects", projectId, "analysis"] as const,
  detail: (projectId: string, filters: ProjectAnalysisFilters = {}) =>
    [...projectAnalysisKeys.all(projectId), filters] as const,
};

export async function getProjectAnalysis(
  projectId: string,
  filters: ProjectAnalysisFilters = {},
) {
  const params = new URLSearchParams();
  if (filters.query) params.set("query", filters.query);
  if (filters.typeIds?.length) params.set("typeIds", filters.typeIds.join(","));
  if (filters.tagIds?.length) params.set("tagIds", filters.tagIds.join(","));
  if (filters.tagMode) params.set("tagMode", filters.tagMode);
  if (filters.eventTypeIds?.length)
    params.set("eventTypeIds", filters.eventTypeIds.join(","));
  if (filters.fromOrdinal != null)
    params.set("fromOrdinal", String(filters.fromOrdinal));
  if (filters.toOrdinal != null)
    params.set("toOrdinal", String(filters.toOrdinal));
  if (filters.hasEvents) params.set("hasEvents", filters.hasEvents);
  if (filters.approximate) params.set("approximate", filters.approximate);
  if (filters.hasCustomColor)
    params.set("hasCustomColor", filters.hasCustomColor);
  if (filters.visibility) params.set("visibility", filters.visibility);
  return requestJson<{
    issues: QualityIssue[];
    duplicates: DuplicateCandidate[];
    summary: ProjectAnalysisSummary;
    statistics: ProjectStatistics;
  }>(
    `/api/projects/${projectId}/analysis${params.size ? `?${params}` : ""}`,
    undefined,
    "データ品質の処理に失敗しました。",
  );
}

export async function previewEntityMerge(
  projectId: string,
  input: {
    entityType: "timeline_item" | "timeline_event";
    survivorId: string;
    mergedId: string;
  },
) {
  return requestJson<{
    preview: true;
    survivor: { id: string; title: string };
    merged: { id: string; title: string };
    transfers: {
      tags: number;
      citations: number;
      customFields: number;
      customFieldConflicts: number;
      parentsOrEvents: number;
      internalLinks: number;
      relationships: number;
    };
  }>(
    `/api/projects/${projectId}/analysis`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...input, preview: true }),
    },
    "データ品質の処理に失敗しました。",
  );
}

export async function mergeEntities(
  projectId: string,
  input: {
    entityType: "timeline_item" | "timeline_event";
    survivorId: string;
    mergedId: string;
  },
) {
  return requestJson<{
    operationId: string;
    survivorId: string;
  }>(
    `/api/projects/${projectId}/analysis`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...input, preview: false }),
    },
    "データ品質の処理に失敗しました。",
  );
}

export async function undoEntityMerge(projectId: string, operationId: string) {
  return requestJson<Record<string, unknown>>(
    `/api/projects/${projectId}/analysis`,
    {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ operationId }),
    },
    "データ品質の処理に失敗しました。",
  );
}
