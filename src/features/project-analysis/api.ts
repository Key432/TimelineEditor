import type {
  DuplicateCandidate,
  ProjectAnalysisSummary,
  QualityIssue,
} from "@/features/project-analysis/analysis";

export const projectAnalysisKeys = {
  detail: (projectId: string) => ["projects", projectId, "analysis"] as const,
};

async function responseJson(response: Response) {
  const body = await response.json();
  if (!response.ok)
    throw new Error(body.error?.message ?? "データ品質の処理に失敗しました。");
  return body;
}

export async function getProjectAnalysis(projectId: string) {
  const response = await fetch(`/api/projects/${projectId}/analysis`);
  return (await responseJson(response)) as {
    issues: QualityIssue[];
    duplicates: DuplicateCandidate[];
    summary: ProjectAnalysisSummary;
  };
}

export async function previewEntityMerge(
  projectId: string,
  input: {
    entityType: "timeline_item" | "timeline_event";
    survivorId: string;
    mergedId: string;
  },
) {
  const response = await fetch(`/api/projects/${projectId}/analysis`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...input, preview: true }),
  });
  return (await responseJson(response)) as {
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
  };
}

export async function mergeEntities(
  projectId: string,
  input: {
    entityType: "timeline_item" | "timeline_event";
    survivorId: string;
    mergedId: string;
  },
) {
  const response = await fetch(`/api/projects/${projectId}/analysis`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...input, preview: false }),
  });
  return (await responseJson(response)) as {
    operationId: string;
    survivorId: string;
  };
}

export async function undoEntityMerge(projectId: string, operationId: string) {
  const response = await fetch(`/api/projects/${projectId}/analysis`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ operationId }),
  });
  return responseJson(response);
}
