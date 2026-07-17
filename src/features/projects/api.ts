import type { Project, ProjectSummary } from "@/features/projects/types";
import type {
  CreateProjectValues,
  UpdateProjectInput,
} from "@/features/projects/validation";

type ApiErrorPayload = { error?: { message?: string } };

export class ProjectApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ProjectApiError";
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const payload = (await response
      .json()
      .catch(() => ({}))) as ApiErrorPayload;
    throw new ProjectApiError(
      payload.error?.message ?? "処理に失敗しました。",
      response.status,
    );
  }
  return (await response.json()) as T;
}

export async function listProjects() {
  const data = await requestJson<{ projects: ProjectSummary[] }>(
    "/api/projects",
  );
  return data.projects;
}

export async function createProject(input: CreateProjectValues) {
  const data = await requestJson<{ project: Project }>("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return data.project;
}

export async function updateProject(
  projectId: string,
  input: UpdateProjectInput,
) {
  const data = await requestJson<{ project: Project }>(
    `/api/projects/${projectId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return data.project;
}

export async function deleteProject(
  projectId: string,
  confirmationName: string,
) {
  const response = await fetch(`/api/projects/${projectId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmationName }),
  });
  if (!response.ok) {
    const payload = (await response
      .json()
      .catch(() => ({}))) as ApiErrorPayload;
    throw new ProjectApiError(
      payload.error?.message ?? "削除に失敗しました。",
      response.status,
    );
  }
}

export const projectKeys = {
  all: ["projects"] as const,
  detail: (projectId: string) => ["projects", projectId] as const,
};
