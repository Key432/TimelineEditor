import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  createComparisonSavedViewSchema,
  comparisonRangeSchema,
  updateComparisonSavedViewSchema,
} from "@/features/comparison/validation";
import { historicalDateOrdinal } from "@/features/timeline-items/historical-date";
import type { TimelineItemSummary } from "@/features/timeline-items/types";
import { ComparisonRepository } from "@/lib/repositories/comparison-repository";
import { ServiceError } from "@/lib/services/errors";
import { ProjectService } from "@/lib/services/project-service";
import { TimelineEventService } from "@/lib/services/timeline-event-service";
import { TimelineItemService } from "@/lib/services/timeline-item-service";
import type { Database } from "@/lib/supabase/database.types";

function validationError(error: z.ZodError) {
  return new ServiceError(
    "入力内容を確認してください。",
    400,
    "VALIDATION_ERROR",
    z.flattenError(error),
  );
}

function itemBounds(item: TimelineItemSummary) {
  const startDate = item.temporalType === "point" ? item.point : item.start;
  if (!startDate) return null;
  const start = historicalDateOrdinal(startDate);
  if (item.temporalType === "point") return { start, end: start };
  const endDate = item.end ?? item.lastConfirmed ?? item.start;
  return {
    start,
    end: endDate ? historicalDateOrdinal(endDate, "end") : start,
  };
}

function isConflict(error: unknown, message: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    error.message === message
  );
}

export class ComparisonService {
  private readonly repository: ComparisonRepository;

  constructor(private readonly client: SupabaseClient<Database>) {
    this.repository = new ComparisonRepository(client);
  }

  private async userId() {
    const { data, error } = await this.client.auth.getClaims();
    const userId = data?.claims?.sub;
    if (error || typeof userId !== "string")
      throw new ServiceError("認証が必要です。", 401, "UNAUTHENTICATED");
    return userId;
  }

  private viewId(value: string) {
    if (!z.uuid().safeParse(value).success)
      throw new ServiceError(
        "保存済み比較ビューが見つかりません。",
        404,
        "COMPARISON_VIEW_NOT_FOUND",
      );
    return value;
  }

  async listProjects() {
    return this.repository.listProjects(await this.userId());
  }

  async loadProject(projectId: string, input: unknown) {
    await this.userId();
    const range = comparisonRangeSchema.safeParse(input);
    if (!range.success) throw validationError(range.error);
    const projects = new ProjectService(this.client);
    const project = await projects.get(projectId);
    const [listing, events] = await Promise.all([
      new TimelineItemService(this.client).list(project.id),
      new TimelineEventService(this.client).list(project.id),
    ]);
    const items = listing.items.filter((item) => {
      const bounds = itemBounds(item);
      return (
        bounds && bounds.end >= range.data.from && bounds.start <= range.data.to
      );
    });
    const itemIds = new Set(items.map((item) => item.id));
    return {
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        publicId: project.publicId,
        access:
          (await this.userId()) === (await this.ownerId(project.id))
            ? ("owned" as const)
            : ("public" as const),
      },
      items,
      events: events.filter((event) => {
        const ordinal = historicalDateOrdinal(event.date);
        return (
          ordinal >= range.data.from &&
          ordinal <= range.data.to &&
          event.timelineItemIds.some((id) => itemIds.has(id))
        );
      }),
      itemTypes: listing.itemTypes,
    };
  }

  private async ownerId(projectId: string) {
    const { data, error } = await this.client
      .from("projects")
      .select("owner_id")
      .eq("id", projectId)
      .single();
    if (error) throw error;
    return data.owner_id;
  }

  async listSavedViews() {
    await this.userId();
    return this.repository.listSavedViews();
  }

  async createSavedView(input: unknown) {
    const ownerId = await this.userId();
    const result = createComparisonSavedViewSchema.safeParse(input);
    if (!result.success) throw validationError(result.error);
    if ((await this.repository.listSavedViews()).length >= 50)
      throw new ServiceError(
        "保存済み比較ビューは50件までです。",
        409,
        "COMPARISON_VIEW_LIMIT_EXCEEDED",
      );
    try {
      return await this.repository.createSavedView(
        ownerId,
        result.data.name,
        result.data.configuration,
      );
    } catch (error) {
      if (isConflict(error, "comparison saved view limit exceeded"))
        throw new ServiceError(
          "保存済み比較ビューは50件までです。",
          409,
          "COMPARISON_VIEW_LIMIT_EXCEEDED",
        );
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
      )
        throw new ServiceError(
          "同じ名前の比較ビューがあります。",
          409,
          "COMPARISON_VIEW_NAME_CONFLICT",
        );
      throw error;
    }
  }

  async updateSavedView(viewId: string, input: unknown) {
    await this.userId();
    const result = updateComparisonSavedViewSchema.safeParse(input);
    if (!result.success) throw validationError(result.error);
    const view = await this.repository.updateSavedView(
      this.viewId(viewId),
      result.data,
    );
    if (!view)
      throw new ServiceError(
        "保存済み比較ビューが見つかりません。",
        404,
        "COMPARISON_VIEW_NOT_FOUND",
      );
    return view;
  }

  async deleteSavedView(viewId: string) {
    await this.userId();
    if (!(await this.repository.deleteSavedView(this.viewId(viewId))))
      throw new ServiceError(
        "保存済み比較ビューが見つかりません。",
        404,
        "COMPARISON_VIEW_NOT_FOUND",
      );
  }
}
