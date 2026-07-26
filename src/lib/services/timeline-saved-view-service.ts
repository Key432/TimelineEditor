import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  createTimelineSavedViewSchema,
  updateTimelineSavedViewSchema,
} from "@/features/timeline-views/validation";
import { TimelineSavedViewRepository } from "@/lib/repositories/timeline-saved-view-repository";
import { ProjectService } from "@/lib/services/project-service";
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

export class TimelineSavedViewService {
  private readonly repository: TimelineSavedViewRepository;
  private readonly projects: ProjectService;

  constructor(client: SupabaseClient<Database>) {
    this.repository = new TimelineSavedViewRepository(client);
    this.projects = new ProjectService(client);
  }

  private parseViewId(viewId: string) {
    if (!z.uuid().safeParse(viewId).success)
      throw new ServiceError(
        "保存済みビューが見つかりません。",
        404,
        "SAVED_VIEW_NOT_FOUND",
      );
    return viewId;
  }

  async list(projectId: string) {
    const project = await this.projects.get(projectId);
    return this.repository.list(project.id);
  }

  async create(projectId: string, input: unknown) {
    const project = await this.projects.get(projectId);
    const result = createTimelineSavedViewSchema.safeParse(input);
    if (!result.success) throw validationError(result.error);
    if ((await this.repository.list(project.id)).length >= 50) {
      throw new ServiceError(
        "保存済みビューは1プロジェクト50件までです。",
        409,
        "SAVED_VIEW_LIMIT_EXCEEDED",
      );
    }
    try {
      return await this.repository.create(
        project.id,
        result.data.name,
        result.data.configuration,
      );
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
      ) {
        throw new ServiceError(
          "同じ名前の保存済みビューがあります。",
          409,
          "SAVED_VIEW_NAME_CONFLICT",
        );
      }
      if (
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        error.message === "timeline saved view limit exceeded"
      ) {
        throw new ServiceError(
          "保存済みビューは1プロジェクト50件までです。",
          409,
          "SAVED_VIEW_LIMIT_EXCEEDED",
        );
      }
      throw error;
    }
  }

  async update(projectId: string, viewId: string, input: unknown) {
    const project = await this.projects.get(projectId);
    const result = updateTimelineSavedViewSchema.safeParse(input);
    if (!result.success) throw validationError(result.error);
    const view = await this.repository.update(
      project.id,
      this.parseViewId(viewId),
      result.data,
    );
    if (!view)
      throw new ServiceError(
        "保存済みビューが見つかりません。",
        404,
        "SAVED_VIEW_NOT_FOUND",
      );
    return view;
  }

  async delete(projectId: string, viewId: string) {
    const project = await this.projects.get(projectId);
    if (!(await this.repository.delete(project.id, this.parseViewId(viewId)))) {
      throw new ServiceError(
        "保存済みビューが見つかりません。",
        404,
        "SAVED_VIEW_NOT_FOUND",
      );
    }
  }
}
