import type {
  CloudDraft,
  CloudDraftEntityType,
  SaveCloudDraftInput,
} from "@/features/autosave/types";

type ErrorPayload = {
  error?: { code?: string; message?: string; issues?: unknown };
};

export class CloudDraftConflictError extends Error {
  constructor(readonly current: CloudDraft | null) {
    super("クラウド下書きが別の端末で更新されています。");
    this.name = "CloudDraftConflictError";
  }
}

function endpoint(
  projectId: string,
  entityType: CloudDraftEntityType,
  draftScope: string,
) {
  return `/api/projects/${projectId}/cloud-drafts/${entityType}/${draftScope}`;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const payload = (await response
      .json()
      .catch(() => null)) as ErrorPayload | null;
    if (response.status === 409 && payload?.error?.code === "DRAFT_CONFLICT") {
      const issues = payload.error.issues as { current?: CloudDraft | null };
      throw new CloudDraftConflictError(issues?.current ?? null);
    }
    throw new Error(
      payload?.error?.message ?? "クラウド下書きを処理できませんでした。",
    );
  }
  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T);
}

export async function getCloudDraft<T>(
  projectId: string,
  entityType: CloudDraftEntityType,
  draftScope: string,
) {
  return (
    await request<{ draft: CloudDraft<T> | null }>(
      endpoint(projectId, entityType, draftScope),
    )
  ).draft;
}

export async function saveCloudDraft<T>(
  projectId: string,
  entityType: CloudDraftEntityType,
  draftScope: string,
  input: SaveCloudDraftInput,
) {
  return (
    await request<{ draft: CloudDraft<T> }>(
      endpoint(projectId, entityType, draftScope),
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    )
  ).draft;
}

export async function deleteCloudDraft(
  projectId: string,
  entityType: CloudDraftEntityType,
  draftScope: string,
) {
  await request<void>(endpoint(projectId, entityType, draftScope), {
    method: "DELETE",
  });
}
