import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { timelineEventSchema } from "@/features/timeline-events/validation";
import { TimelineEventRepository } from "@/lib/repositories/timeline-event-repository";
import { TimelineItemRepository } from "@/lib/repositories/timeline-item-repository";
import { SourceRepository } from "@/lib/repositories/source-repository";
import { ServiceError } from "@/lib/services/errors";
import { ProjectService } from "@/lib/services/project-service";
import type { Database } from "@/lib/supabase/database.types";
import { ClassificationService } from "@/lib/services/classification-service";

function validationError(error: z.ZodError) {
  return new ServiceError(
    "入力内容を確認してください。",
    400,
    "VALIDATION_ERROR",
    z.flattenError(error),
  );
}

export class TimelineEventService {
  private readonly repository: TimelineEventRepository;
  private readonly items: TimelineItemRepository;
  private readonly projects: ProjectService;
  private readonly sources: SourceRepository;
  private readonly classification: ClassificationService;

  constructor(client: SupabaseClient<Database>) {
    this.repository = new TimelineEventRepository(client);
    this.items = new TimelineItemRepository(client);
    this.projects = new ProjectService(client);
    this.sources = new SourceRepository(client);
    this.classification = new ClassificationService(client);
  }

  private async requireSources(projectId: string, sourceIds: string[]) {
    if (!(await this.sources.allBelongToProject(projectId, sourceIds))) {
      throw new ServiceError(
        "選択した資料が見つかりません。",
        400,
        "SOURCE_NOT_FOUND",
      );
    }
  }

  private parseEventId(eventId: string) {
    if (!z.uuid().safeParse(eventId).success) {
      throw new ServiceError(
        "イベントアイテムが見つかりません。",
        404,
        "TIMELINE_EVENT_NOT_FOUND",
      );
    }
    return eventId;
  }

  private async requireRangeParent(projectId: string, itemId: string) {
    const parent = await this.items.findById(projectId, itemId);
    if (!parent) {
      throw new ServiceError(
        "親タイムラインアイテムが見つかりません。",
        400,
        "PARENT_NOT_FOUND",
      );
    }
    if (parent.temporalType !== "range") {
      throw new ServiceError(
        "時点型タイムラインアイテムにはイベントアイテムを登録できません。",
        400,
        "POINT_PARENT_NOT_ALLOWED",
      );
    }
    return parent;
  }

  async list(projectId: string) {
    const project = await this.projects.get(projectId);
    return this.repository.list(project.id);
  }

  async get(projectId: string, eventId: string) {
    const project = await this.projects.get(projectId);
    const event = await this.repository.findById(
      project.id,
      this.parseEventId(eventId),
    );
    if (!event) {
      throw new ServiceError(
        "イベントアイテムが見つかりません。",
        404,
        "TIMELINE_EVENT_NOT_FOUND",
      );
    }
    return { project, event };
  }

  async create(projectId: string, input: unknown) {
    const project = await this.projects.get(projectId);
    const result = timelineEventSchema.safeParse(input);
    if (!result.success) throw validationError(result.error);
    await Promise.all(
      result.data.timelineItemIds.map((itemId) =>
        this.requireRangeParent(project.id, itemId),
      ),
    );
    await this.classification.requireEventType(
      project.id,
      result.data.eventTypeId,
    );
    const metadata = await this.classification.validateEntityMetadata(
      project.id,
      "timeline_event",
      result.data.eventTypeId,
      result.data.tagIds,
      result.data.customFields,
    );
    await this.requireSources(
      project.id,
      result.data.citations.map((citation) => citation.sourceId),
    );
    const event = await this.repository.create(project.id, result.data);
    await this.classification.attachEntityMetadata(
      project.id,
      "timeline_event",
      event.id,
      metadata.tagIds,
      metadata.customFields,
    );
    return (await this.repository.findById(project.id, event.id))!;
  }

  async update(projectId: string, eventId: string, input: unknown) {
    const updateRequest = z
      .object({ values: z.unknown(), expectedUpdatedAt: z.string().min(1) })
      .safeParse(input);
    if (!updateRequest.success) throw validationError(updateRequest.error);
    const { project, event: currentEvent } = await this.get(projectId, eventId);
    if (currentEvent.updatedAt !== updateRequest.data.expectedUpdatedAt) {
      throw new ServiceError(
        "別の場所で更新されています。最新の内容を読み込み直してください。",
        409,
        "TIMELINE_EVENT_CONFLICT",
      );
    }
    const result = timelineEventSchema.safeParse(updateRequest.data.values);
    if (!result.success) throw validationError(result.error);
    await Promise.all(
      result.data.timelineItemIds.map((itemId) =>
        this.requireRangeParent(project.id, itemId),
      ),
    );
    await this.classification.requireEventType(
      project.id,
      result.data.eventTypeId,
    );
    const metadata = await this.classification.validateEntityMetadata(
      project.id,
      "timeline_event",
      result.data.eventTypeId,
      result.data.tagIds,
      result.data.customFields,
    );
    await this.requireSources(
      project.id,
      result.data.citations.map((citation) => citation.sourceId),
    );
    const hasPreviousTitle = result.data.aliases.some(
      (alias) =>
        alias.localeCompare(currentEvent.title, "ja", {
          sensitivity: "base",
        }) === 0,
    );
    const enrichedResult = timelineEventSchema.safeParse({
      ...result.data,
      aliases:
        result.data.addPreviousTitleToAliases && !hasPreviousTitle
          ? [...result.data.aliases, currentEvent.title]
          : result.data.aliases,
    });
    if (!enrichedResult.success) throw validationError(enrichedResult.error);
    const event = await this.repository.update(
      project.id,
      this.parseEventId(eventId),
      enrichedResult.data,
      updateRequest.data.expectedUpdatedAt,
    );
    if (!event) {
      throw new ServiceError(
        "別の場所で更新されています。最新の内容を読み込み直してください。",
        409,
        "TIMELINE_EVENT_CONFLICT",
      );
    }
    await this.classification.attachEntityMetadata(
      project.id,
      "timeline_event",
      event.id,
      metadata.tagIds,
      metadata.customFields,
    );
    return (await this.repository.findById(project.id, event.id))!;
  }

  async delete(projectId: string, eventId: string) {
    const { project } = await this.get(projectId, eventId);
    if (
      !(await this.repository.delete(project.id, this.parseEventId(eventId)))
    ) {
      throw new ServiceError(
        "イベントアイテムが見つかりません。",
        404,
        "TIMELINE_EVENT_NOT_FOUND",
      );
    }
  }
}
