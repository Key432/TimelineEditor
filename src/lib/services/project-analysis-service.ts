import type { SupabaseClient } from "@supabase/supabase-js";

import { analyzeProjectData } from "@/features/project-analysis/analysis";
import {
  mergeEntitiesSchema,
  undoEntityMergeSchema,
} from "@/features/project-analysis/validation";
import { ProjectAnalysisRepository } from "@/lib/repositories/project-analysis-repository";
import { ServiceError } from "@/lib/services/errors";
import type { Database } from "@/lib/supabase/database.types";

export class ProjectAnalysisService {
  private readonly repository: ProjectAnalysisRepository;

  constructor(private readonly client: SupabaseClient<Database>) {
    this.repository = new ProjectAnalysisRepository(client);
  }

  private async requireOwner(projectId: string) {
    const { data, error } = await this.client.auth.getClaims();
    const ownerId = data?.claims?.sub;
    if (error || !ownerId)
      throw new ServiceError("認証が必要です。", 401, "UNAUTHENTICATED");
    if (!(await this.repository.isOwner(projectId, ownerId)))
      throw new ServiceError(
        "プロジェクトが見つかりません。",
        404,
        "PROJECT_NOT_FOUND",
      );
  }

  async analyze(projectId: string) {
    await this.requireOwner(projectId);
    return analyzeProjectData(await this.repository.dataset(projectId));
  }

  async merge(projectId: string, input: unknown) {
    await this.requireOwner(projectId);
    const parsed = mergeEntitiesSchema.safeParse(input);
    if (!parsed.success)
      throw new ServiceError(
        "統合内容を確認してください。",
        400,
        "VALIDATION_ERROR",
        parsed.error.flatten(),
      );
    const { entityType, survivorId, mergedId, preview } = parsed.data;
    const dataset = await this.repository.dataset(projectId);
    const survivor = dataset.entities.find(
      (entity) => entity.entityType === entityType && entity.id === survivorId,
    );
    const merged = dataset.entities.find(
      (entity) => entity.entityType === entityType && entity.id === mergedId,
    );
    if (!survivor || !merged)
      throw new ServiceError(
        "統合対象が見つかりません。",
        404,
        "MERGE_ENTITY_NOT_FOUND",
      );
    if (preview)
      return {
        preview: true,
        survivor: { id: survivor.id, title: survivor.title },
        merged: { id: merged.id, title: merged.title },
        transfers: await this.repository.mergePreview(
          projectId,
          entityType,
          survivorId,
          mergedId,
        ),
      };
    return {
      operationId: await this.repository.merge(
        projectId,
        entityType,
        survivorId,
        mergedId,
      ),
      survivorId,
    };
  }

  async undo(projectId: string, input: unknown) {
    await this.requireOwner(projectId);
    const parsed = undoEntityMergeSchema.safeParse(input);
    if (!parsed.success)
      throw new ServiceError(
        "Undo対象を確認してください。",
        400,
        "VALIDATION_ERROR",
      );
    if (!(await this.repository.undo(projectId, parsed.data.operationId)))
      throw new ServiceError(
        "Undoできる統合が見つかりません。",
        404,
        "MERGE_OPERATION_NOT_FOUND",
      );
    return { undone: true };
  }
}
