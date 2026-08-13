import type { Project, ProjectSummary } from "@/features/projects/types";
import type {
  CreateProjectValues,
  UpdateProjectInput,
} from "@/features/projects/validation";
import { requestJson } from "@/lib/api-client";

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
  await requestJson<void>(
    `/api/projects/${projectId}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmationName }),
    },
    "削除に失敗しました。",
  );
}

async function changePublication(
  projectId: string,
  action: "publish" | "unpublish" | "public-id/regenerate",
) {
  const data = await requestJson<{ project: Project }>(
    `/api/projects/${projectId}/${action}`,
    { method: "POST" },
  );
  return data.project;
}

export const publishProject = (projectId: string) =>
  changePublication(projectId, "publish");

export const unpublishProject = (projectId: string) =>
  changePublication(projectId, "unpublish");

export const regenerateProjectPublicId = (projectId: string) =>
  changePublication(projectId, "public-id/regenerate");

export const projectKeys = {
  all: ["projects"] as const,
  detail: (projectId: string) => ["projects", projectId] as const,
};
