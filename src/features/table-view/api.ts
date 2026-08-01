import type { TablePreferenceInput } from "@/features/table-view/validation";

export type SavedTablePreference = TablePreferenceInput & {
  id: string;
  updatedAt: string;
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    throw new Error(
      payload.error?.message ?? "テーブル設定を保存できませんでした。",
    );
  }
  return (await response.json()) as T;
}

export async function listTablePreferences(projectId: string) {
  const data = await request<{ preferences: SavedTablePreference[] }>(
    `/api/projects/${projectId}/table-preferences`,
  );
  return data.preferences;
}

export async function saveTablePreference(
  projectId: string,
  input: TablePreferenceInput,
) {
  const data = await request<{ preference: SavedTablePreference }>(
    `/api/projects/${projectId}/table-preferences`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return data.preference;
}

export const tablePreferenceKeys = {
  list: (projectId: string) =>
    ["projects", projectId, "table-preferences"] as const,
};

export type BulkOperation =
  | { kind: "set_visibility"; value: boolean }
  | { kind: "set_color"; value: string | null }
  | { kind: "set_type"; value: string | null }
  | { kind: "tags"; mode: "add" | "remove" | "replace"; tagIds: string[] }
  | { kind: "delete" };

export async function previewBulkEdit(
  projectId: string,
  entityType: "timeline_item" | "timeline_event",
  ids: string[],
  operation: BulkOperation,
) {
  return request<{ preview: { selected: number; references: number } }>(
    `/api/projects/${projectId}/bulk-edit`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType, ids, operation, preview: true }),
    },
  );
}

export async function runBulkEdit(
  projectId: string,
  entityType: "timeline_item" | "timeline_event",
  ids: string[],
  operation: BulkOperation,
) {
  return request<{
    operation: { id: string; label: string; affectedCount: number };
  }>(`/api/projects/${projectId}/bulk-edit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entityType, ids, operation, preview: false }),
  });
}

export async function undoBulkEdit(projectId: string, operationId: string) {
  return request<{ undone: true }>(`/api/projects/${projectId}/bulk-edit`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operationId }),
  });
}

export type CsvMappingProfile = {
  id: string;
  name: string;
  entityType: "timeline_item" | "timeline_event";
  mapping: Record<string, string>;
  dateFormat: "separate" | "iso" | "japanese";
};

export async function listCsvMappingProfiles(projectId: string) {
  const data = await request<{ profiles: CsvMappingProfile[] }>(
    `/api/projects/${projectId}/csv-mappings`,
  );
  return data.profiles;
}

export async function saveCsvMappingProfile(
  projectId: string,
  input: Omit<CsvMappingProfile, "id"> & { id?: string },
) {
  const data = await request<{ profile: CsvMappingProfile }>(
    `/api/projects/${projectId}/csv-mappings`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return data.profile;
}
