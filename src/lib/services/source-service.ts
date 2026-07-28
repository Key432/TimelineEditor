import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { sourceSchema } from "@/features/sources/validation";
import { SourceRepository } from "@/lib/repositories/source-repository";
import { ServiceError } from "@/lib/services/errors";
import { ProjectService } from "@/lib/services/project-service";
import type { Database } from "@/lib/supabase/database.types";

function validationError(error: z.ZodError) {
  return new ServiceError(
    "入力内容を確認してください。",
    400,
    "VALIDATION_ERROR",
    z.flattenError(error),
  );
}

export class SourceService {
  private readonly repository: SourceRepository;
  private readonly projects: ProjectService;

  constructor(client: SupabaseClient<Database>) {
    this.repository = new SourceRepository(client);
    this.projects = new ProjectService(client);
  }

  private sourceId(value: string) {
    if (!z.uuid().safeParse(value).success) {
      throw new ServiceError("資料が見つかりません。", 404, "SOURCE_NOT_FOUND");
    }
    return value;
  }

  async list(projectId: string) {
    const project = await this.projects.get(projectId);
    const [sources, missingEntities] = await Promise.all([
      this.repository.list(project.id),
      this.repository.listMissingEntities(project.id),
    ]);
    return { project, sources, missingEntities };
  }

  async create(projectId: string, input: unknown) {
    const project = await this.projects.get(projectId);
    const result = sourceSchema.safeParse(input);
    if (!result.success) throw validationError(result.error);
    try {
      return await this.repository.create(project.id, result.data);
    } catch (error) {
      if (
        typeof error === "object" &&
        error &&
        "code" in error &&
        error.code === "23505"
      ) {
        throw new ServiceError(
          "同じ引用キーがすでに使われています。",
          409,
          "CITATION_KEY_CONFLICT",
        );
      }
      throw error;
    }
  }

  async update(projectId: string, sourceId: string, input: unknown) {
    const project = await this.projects.get(projectId);
    const result = sourceSchema.safeParse(input);
    if (!result.success) throw validationError(result.error);
    let updated;
    try {
      updated = await this.repository.update(
        project.id,
        this.sourceId(sourceId),
        result.data,
      );
    } catch (error) {
      if (
        typeof error === "object" &&
        error &&
        "code" in error &&
        error.code === "23505"
      ) {
        throw new ServiceError(
          "同じ引用キーがすでに使われています。",
          409,
          "CITATION_KEY_CONFLICT",
        );
      }
      throw error;
    }
    if (!updated)
      throw new ServiceError("資料が見つかりません。", 404, "SOURCE_NOT_FOUND");
    return updated;
  }

  async delete(projectId: string, sourceId: string) {
    const project = await this.projects.get(projectId);
    if (!(await this.repository.delete(project.id, this.sourceId(sourceId)))) {
      throw new ServiceError("資料が見つかりません。", 404, "SOURCE_NOT_FOUND");
    }
  }
}
