import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  createItemTypeSchema,
  updateItemTypeSchema,
} from "@/features/item-types/validation";
import { ItemTypeRepository } from "@/lib/repositories/item-type-repository";
import { ServiceError } from "@/lib/services/errors";
import { ProjectService } from "@/lib/services/project-service";
import type { Database } from "@/lib/supabase/database.types";

type DatabaseError = { code?: string };

function validationError(error: z.ZodError) {
  return new ServiceError(
    "入力内容を確認してください。",
    400,
    "VALIDATION_ERROR",
    z.flattenError(error),
  );
}

function isDatabaseError(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as DatabaseError).code === code
  );
}

export class ItemTypeService {
  private readonly repository: ItemTypeRepository;
  private readonly projects: ProjectService;

  constructor(client: SupabaseClient<Database>) {
    this.repository = new ItemTypeRepository(client);
    this.projects = new ProjectService(client);
  }

  private parseTypeId(typeId: string) {
    if (!z.uuid().safeParse(typeId).success) {
      throw new ServiceError(
        "対象種別が見つかりません。",
        404,
        "ITEM_TYPE_NOT_FOUND",
      );
    }
    return typeId;
  }

  private duplicateNameError() {
    return new ServiceError(
      "同じ名前の対象種別がすでにあります。",
      409,
      "ITEM_TYPE_NAME_CONFLICT",
    );
  }

  async list(projectId: string) {
    const project = await this.projects.get(projectId);
    return {
      project,
      itemTypes: await this.repository.list(project.id),
    };
  }

  async create(projectId: string, input: unknown) {
    const project = await this.projects.get(projectId);
    const result = createItemTypeSchema.safeParse(input);
    if (!result.success) throw validationError(result.error);

    try {
      return await this.repository.create(project.id, result.data);
    } catch (error) {
      if (isDatabaseError(error, "23505")) throw this.duplicateNameError();
      throw error;
    }
  }

  async update(projectId: string, typeId: string, input: unknown) {
    const project = await this.projects.get(projectId);
    const validTypeId = this.parseTypeId(typeId);
    const current = await this.repository.findById(project.id, validTypeId);
    if (!current) {
      throw new ServiceError(
        "対象種別が見つかりません。",
        404,
        "ITEM_TYPE_NOT_FOUND",
      );
    }

    const result = updateItemTypeSchema.safeParse(input);
    if (!result.success) throw validationError(result.error);
    const { sortOrder, ...fields } = result.data;

    try {
      const updated = await this.repository.update(
        project.id,
        validTypeId,
        fields,
      );
      if (!updated) {
        throw new ServiceError(
          "対象種別が見つかりません。",
          404,
          "ITEM_TYPE_NOT_FOUND",
        );
      }
      if (sortOrder !== undefined) {
        await this.repository.move(project.id, validTypeId, sortOrder);
      }
      return this.repository.findById(project.id, validTypeId);
    } catch (error) {
      if (isDatabaseError(error, "23505")) throw this.duplicateNameError();
      throw error;
    }
  }

  async delete(projectId: string, typeId: string) {
    const project = await this.projects.get(projectId);
    const validTypeId = this.parseTypeId(typeId);

    try {
      const deleted = await this.repository.delete(project.id, validTypeId);
      if (!deleted) {
        throw new ServiceError(
          "対象種別が見つかりません。",
          404,
          "ITEM_TYPE_NOT_FOUND",
        );
      }
    } catch (error) {
      if (isDatabaseError(error, "23503")) {
        throw new ServiceError(
          "使用中の対象種別は削除できません。別の種別へ移行してください。",
          409,
          "ITEM_TYPE_IN_USE",
        );
      }
      throw error;
    }
  }
}
