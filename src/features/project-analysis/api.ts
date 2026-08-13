import type {
  DuplicateCandidate,
  ProjectAnalysisSummary,
  QualityIssue,
} from "@/features/project-analysis/analysis";
import { requestJson } from "@/lib/api-client";

export const projectAnalysisKeys = {
  detail: (projectId: string) => ["projects", projectId, "analysis"] as const,
};

export async function getProjectAnalysis(projectId: string) {
  return requestJson<{
    issues: QualityIssue[];
    duplicates: DuplicateCandidate[];
    summary: ProjectAnalysisSummary;
  }>(
    `/api/projects/${projectId}/analysis`,
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
