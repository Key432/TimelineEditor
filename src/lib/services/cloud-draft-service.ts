import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  cloudDraftEntityTypeSchema,
  cloudDraftScopeSchema,
  saveCloudDraftSchema,
} from "@/features/autosave/validation";
import { CloudDraftRepository } from "@/lib/repositories/cloud-draft-repository";
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

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

export class CloudDraftService {
  private readonly repository: CloudDraftRepository;

  constructor(private readonly client: SupabaseClient<Database>) {
    this.repository = new CloudDraftRepository(client);
  }

  private async parseTarget(
    projectId: string,
    entityType: string,
    draftScope: string,
  ) {
    const projectResult = z.uuid().safeParse(projectId);
    const entityResult = cloudDraftEntityTypeSchema.safeParse(entityType);
    const scopeResult = cloudDraftScopeSchema.safeParse(draftScope);
    if (
      !projectResult.success ||
      !entityResult.success ||
      !scopeResult.success
    ) {
      throw new ServiceError(
        "クラウド下書きが見つかりません。",
        404,
        "DRAFT_NOT_FOUND",
      );
    }
    const { data, error } = await this.client.auth.getClaims();
    const ownerId = data?.claims?.sub;
    if (error || !ownerId) {
      throw new ServiceError("認証が必要です。", 401, "UNAUTHENTICATED");
    }
    if (!(await this.repository.isProjectOwner(projectResult.data, ownerId))) {
      throw new ServiceError(
        "クラウド下書きが見つかりません。",
        404,
        "DRAFT_NOT_FOUND",
      );
    }
    return {
      projectId: projectResult.data,
      entityType: entityResult.data,
      draftScope: scopeResult.data,
    };
  }

  private conflict(current: Awaited<ReturnType<CloudDraftRepository["find"]>>) {
    return new ServiceError(
      "クラウド下書きが別の端末で更新されています。",
      409,
      "DRAFT_CONFLICT",
      { current },
    );
  }

  async get(projectId: string, entityType: string, draftScope: string) {
    const target = await this.parseTarget(projectId, entityType, draftScope);
    return this.repository.find(
      target.projectId,
      target.entityType,
      target.draftScope,
    );
  }

  async save(
    projectId: string,
    entityType: string,
    draftScope: string,
    input: unknown,
  ) {
    const target = await this.parseTarget(projectId, entityType, draftScope);
    const result = saveCloudDraftSchema.safeParse(input);
    if (!result.success) throw validationError(result.error);
    const current = await this.repository.find(
      target.projectId,
      target.entityType,
      target.draftScope,
    );
    if (current?.fingerprint === result.data.fingerprint) return current;
    if (current) {
      if (result.data.expectedVersion !== current.version) {
        throw this.conflict(current);
      }
      const saved = await this.repository.update(
        target.projectId,
        target.entityType,
        target.draftScope,
        current.version,
        result.data,
      );
      if (saved) return saved;
      throw this.conflict(
        await this.repository.find(
          target.projectId,
          target.entityType,
          target.draftScope,
        ),
      );
    }
    if (result.data.expectedVersion !== null) throw this.conflict(null);
    try {
      return await this.repository.create(
        target.projectId,
        target.entityType,
        target.draftScope,
        result.data,
      );
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      throw this.conflict(
        await this.repository.find(
          target.projectId,
          target.entityType,
          target.draftScope,
        ),
      );
    }
  }

  async delete(projectId: string, entityType: string, draftScope: string) {
    const target = await this.parseTarget(projectId, entityType, draftScope);
    await this.repository.delete(
      target.projectId,
      target.entityType,
      target.draftScope,
    );
  }
}
