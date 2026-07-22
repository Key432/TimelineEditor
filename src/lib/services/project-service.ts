import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  createProjectSchema,
  deleteProjectSchema,
  updateProjectSchema,
} from "@/features/projects/validation";
import { ProjectRepository } from "@/lib/repositories/project-repository";
import { ServiceError } from "@/lib/services/errors";
import type { Database } from "@/lib/supabase/database.types";

function validationError(error: z.ZodError) {
  return new ServiceError(
    "入力内容を確認してください。",
    400,
    "VALIDATION_ERROR",
    z.flattenError(error),
  );
}

export class ProjectService {
  private readonly repository: ProjectRepository;

  constructor(private readonly client: SupabaseClient<Database>) {
    this.repository = new ProjectRepository(client);
  }

  private async requireAuthentication() {
    const { data, error } = await this.client.auth.getClaims();
    if (error || !data?.claims?.sub) {
      throw new ServiceError("認証が必要です。", 401, "UNAUTHENTICATED");
    }
  }

  private parseProjectId(projectId: string) {
    if (!z.uuid().safeParse(projectId).success) {
      throw new ServiceError(
        "プロジェクトが見つかりません。",
        404,
        "PROJECT_NOT_FOUND",
      );
    }
    return projectId;
  }

  async list() {
    await this.requireAuthentication();
    return this.repository.list();
  }

  async get(projectId: string) {
    const validProjectId = this.parseProjectId(projectId);
    const project = await this.repository.findById(validProjectId);
    if (!project) {
      throw new ServiceError(
        "プロジェクトが見つかりません。",
        404,
        "PROJECT_NOT_FOUND",
      );
    }
    return project;
  }

  async getPublic(publicId: string) {
    if (!/^[0-9a-f]{32}$/.test(publicId)) {
      throw new ServiceError(
        "公開プロジェクトが見つかりません。",
        404,
        "PUBLIC_PROJECT_NOT_FOUND",
      );
    }
    const project = await this.repository.findByPublicId(publicId);
    if (!project) {
      throw new ServiceError(
        "公開プロジェクトが見つかりません。",
        404,
        "PUBLIC_PROJECT_NOT_FOUND",
      );
    }
    return project;
  }

  async create(input: unknown) {
    await this.requireAuthentication();
    const result = createProjectSchema.safeParse(input);
    if (!result.success) throw validationError(result.error);
    return this.repository.create(result.data);
  }

  async update(projectId: string, input: unknown) {
    await this.requireAuthentication();
    await this.get(projectId);
    const result = updateProjectSchema.safeParse(input);
    if (!result.success) throw validationError(result.error);
    return this.repository.update(projectId, result.data);
  }

  async delete(projectId: string, input: unknown) {
    await this.requireAuthentication();
    const project = await this.get(projectId);
    const result = deleteProjectSchema.safeParse(input);
    if (!result.success) throw validationError(result.error);
    if (result.data.confirmationName !== project.name) {
      throw new ServiceError(
        "プロジェクト名が一致しません。",
        409,
        "CONFIRMATION_NAME_MISMATCH",
      );
    }

    const deleted = await this.repository.delete(projectId);
    if (!deleted) {
      throw new ServiceError(
        "プロジェクトが見つかりません。",
        404,
        "PROJECT_NOT_FOUND",
      );
    }
  }

  async publish(projectId: string) {
    await this.requireAuthentication();
    await this.get(projectId);
    await this.repository.publish(this.parseProjectId(projectId));
    return this.get(projectId);
  }

  async unpublish(projectId: string) {
    await this.requireAuthentication();
    await this.get(projectId);
    await this.repository.unpublish(this.parseProjectId(projectId));
    return this.get(projectId);
  }

  async regeneratePublicId(projectId: string) {
    await this.requireAuthentication();
    await this.get(projectId);
    await this.repository.regeneratePublicId(this.parseProjectId(projectId));
    return this.get(projectId);
  }
}
