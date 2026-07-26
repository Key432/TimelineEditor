import type {
  ImportMode,
  ImportPreview,
  ProjectBackup,
} from "@/features/import-export/schema";

async function json<T>(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: { message?: string };
  };
  if (!response.ok)
    throw new Error(payload.error?.message ?? "処理に失敗しました。");
  return payload;
}

export const previewJsonImport = (projectId: string, payload: unknown) =>
  json<ImportPreview>(`/api/projects/${projectId}/import/json/preview`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

export async function previewCsvImport(projectId: string, file: File) {
  const body = new FormData();
  body.set("file", file);
  return json<ImportPreview>(`/api/projects/${projectId}/import/csv/preview`, {
    method: "POST",
    body,
  });
}

export const commitImport = (
  projectId: string,
  format: "json" | "csv",
  mode: ImportMode,
  payload: ProjectBackup,
) =>
  json<{
    projectId: string;
    imported: {
      itemTypes: number;
      timelineItems: number;
      timelineEvents: number;
    };
  }>(`/api/projects/${projectId}/import/${format}/commit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode, payload }),
  });
