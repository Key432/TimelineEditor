import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  backgroundPeriodSchema,
  createBackgroundLayerSchema,
  updateBackgroundLayerSchema,
} from "@/features/background-layers/validation";
import { BackgroundLayerRepository } from "@/lib/repositories/background-layer-repository";
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

export class BackgroundLayerService {
  private readonly repository: BackgroundLayerRepository;
  private readonly projects: ProjectService;

  constructor(client: SupabaseClient<Database>) {
    this.repository = new BackgroundLayerRepository(client);
    this.projects = new ProjectService(client);
  }

  private id(value: string, code: string) {
    if (!z.uuid().safeParse(value).success)
      throw new ServiceError("年代背景が見つかりません。", 404, code);
    return value;
  }

  async list(projectId: string) {
    const project = await this.projects.get(projectId);
    return this.repository.list(project.id);
  }

  async createLayer(projectId: string, input: unknown) {
    const project = await this.projects.get(projectId);
    const parsed = createBackgroundLayerSchema.safeParse(input);
    if (!parsed.success) throw validationError(parsed.error);
    try {
      return await this.repository.createLayer(project.id, parsed.data);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
      )
        throw new ServiceError(
          "同じ名前のレイヤーがあります。",
          409,
          "BACKGROUND_LAYER_NAME_CONFLICT",
        );
      throw error;
    }
  }

  async updateLayer(projectId: string, layerId: string, input: unknown) {
    const project = await this.projects.get(projectId);
    const parsed = updateBackgroundLayerSchema.safeParse(input);
    if (!parsed.success) throw validationError(parsed.error);
    const layer = await this.repository.updateLayer(
      project.id,
      this.id(layerId, "BACKGROUND_LAYER_NOT_FOUND"),
      parsed.data,
    );
    if (!layer)
      throw new ServiceError(
        "年代背景レイヤーが見つかりません。",
        404,
        "BACKGROUND_LAYER_NOT_FOUND",
      );
    return layer;
  }

  async deleteLayer(projectId: string, layerId: string) {
    const project = await this.projects.get(projectId);
    if (
      !(await this.repository.deleteLayer(
        project.id,
        this.id(layerId, "BACKGROUND_LAYER_NOT_FOUND"),
      ))
    )
      throw new ServiceError(
        "年代背景レイヤーが見つかりません。",
        404,
        "BACKGROUND_LAYER_NOT_FOUND",
      );
  }

  async savePeriod(
    projectId: string,
    layerId: string,
    periodId: string | null,
    input: unknown,
  ) {
    const project = await this.projects.get(projectId);
    const validLayerId = this.id(layerId, "BACKGROUND_LAYER_NOT_FOUND");
    if (!(await this.repository.findLayer(project.id, validLayerId)))
      throw new ServiceError(
        "年代背景レイヤーが見つかりません。",
        404,
        "BACKGROUND_LAYER_NOT_FOUND",
      );
    const parsed = backgroundPeriodSchema.safeParse(input);
    if (!parsed.success) throw validationError(parsed.error);
    if (periodId) {
      if (
        !(await this.repository.updatePeriod(
          project.id,
          validLayerId,
          this.id(periodId, "BACKGROUND_PERIOD_NOT_FOUND"),
          parsed.data,
        ))
      )
        throw new ServiceError(
          "背景期間が見つかりません。",
          404,
          "BACKGROUND_PERIOD_NOT_FOUND",
        );
    } else {
      await this.repository.createPeriod(project.id, validLayerId, parsed.data);
    }
    return this.repository.findLayer(project.id, validLayerId);
  }

  async deletePeriod(projectId: string, layerId: string, periodId: string) {
    const project = await this.projects.get(projectId);
    if (
      !(await this.repository.deletePeriod(
        project.id,
        this.id(layerId, "BACKGROUND_LAYER_NOT_FOUND"),
        this.id(periodId, "BACKGROUND_PERIOD_NOT_FOUND"),
      ))
    )
      throw new ServiceError(
        "背景期間が見つかりません。",
        404,
        "BACKGROUND_PERIOD_NOT_FOUND",
      );
  }
}
