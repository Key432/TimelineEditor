import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { HistoryRepository } from "@/lib/repositories/history-repository";
import { ServiceError } from "@/lib/services/errors";
import type { Database } from "@/lib/supabase/database.types";

const entityTypeSchema = z.enum(["timeline_item", "timeline_event"]);
const idSchema = z.uuid();

export class HistoryService {
  private readonly repository: HistoryRepository;

  constructor(private readonly client: SupabaseClient<Database>) {
    this.repository = new HistoryRepository(client);
  }

  private async requireOwner(projectId: string) {
    if (!idSchema.safeParse(projectId).success) {
      throw new ServiceError(
        "プロジェクトが見つかりません。",
        404,
        "PROJECT_NOT_FOUND",
      );
    }
    const { data, error } = await this.client.auth.getClaims();
    const ownerId = data?.claims?.sub;
    if (
      error ||
      !ownerId ||
      !(await this.repository.isProjectOwner(projectId, ownerId))
    ) {
      throw new ServiceError(
        "プロジェクトが見つかりません。",
        404,
        "PROJECT_NOT_FOUND",
      );
    }
  }

  private parseEntity(entityType: unknown, entityId: unknown) {
    const type = entityTypeSchema.safeParse(entityType);
    const id = idSchema.safeParse(entityId);
    if (!type.success || !id.success) {
      throw new ServiceError("対象が見つかりません。", 404, "ENTITY_NOT_FOUND");
    }
    return { entityType: type.data, entityId: id.data };
  }

  async list(projectId: string, entityType: unknown, entityId: unknown) {
    await this.requireOwner(projectId);
    const entity = this.parseEntity(entityType, entityId);
    return this.repository.list(projectId, entity.entityType, entity.entityId);
  }

  async checkpoint(projectId: string, input: unknown) {
    await this.requireOwner(projectId);
    const value = typeof input === "object" && input !== null ? input : {};
    const entity = this.parseEntity(
      "entityType" in value ? value.entityType : undefined,
      "entityId" in value ? value.entityId : undefined,
    );
    return this.repository.checkpoint(
      projectId,
      entity.entityType,
      entity.entityId,
    );
  }

  async restoreHistory(projectId: string, historyId: string) {
    await this.requireOwner(projectId);
    if (
      !idSchema.safeParse(historyId).success ||
      !(await this.repository.restoreHistory(projectId, historyId))
    ) {
      throw new ServiceError(
        "履歴が見つかりません。",
        404,
        "HISTORY_NOT_FOUND",
      );
    }
  }

  async listTrash(projectId: string) {
    await this.requireOwner(projectId);
    return this.repository.listTrash(projectId);
  }

  async restoreTrash(
    projectId: string,
    entityType: unknown,
    entityId: unknown,
  ) {
    await this.requireOwner(projectId);
    const entity = this.parseEntity(entityType, entityId);
    if (
      !(await this.repository.restoreTrash(
        projectId,
        entity.entityType,
        entity.entityId,
      ))
    ) {
      throw new ServiceError(
        "ゴミ箱の項目が見つかりません。",
        404,
        "TRASH_NOT_FOUND",
      );
    }
  }

  async purgeTrash(projectId: string, entityType: unknown, entityId: unknown) {
    await this.requireOwner(projectId);
    const entity = this.parseEntity(entityType, entityId);
    if (
      !(await this.repository.purgeTrash(
        projectId,
        entity.entityType,
        entity.entityId,
      ))
    ) {
      throw new ServiceError(
        "ゴミ箱の項目が見つかりません。",
        404,
        "TRASH_NOT_FOUND",
      );
    }
  }
}
