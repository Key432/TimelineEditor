import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  timelineEventDraftSchema,
  type TimelineEventDraftValues,
} from "@/features/timeline-events/validation";
import type { TimelineEventCreationFailure } from "@/features/timeline-items/types";
import {
  moveTimelineItemSchema,
  timelineItemSchema,
} from "@/features/timeline-items/validation";
import { ItemTypeRepository } from "@/lib/repositories/item-type-repository";
import { TimelineItemRepository } from "@/lib/repositories/timeline-item-repository";
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

export class TimelineItemService {
  private readonly repository: TimelineItemRepository;
  private readonly itemTypes: ItemTypeRepository;
  private readonly projects: ProjectService;

  constructor(client: SupabaseClient<Database>) {
    this.repository = new TimelineItemRepository(client);
    this.itemTypes = new ItemTypeRepository(client);
    this.projects = new ProjectService(client);
  }

  private parseItemId(itemId: string) {
    if (!z.uuid().safeParse(itemId).success) {
      throw new ServiceError(
        "タイムラインアイテムが見つかりません。",
        404,
        "TIMELINE_ITEM_NOT_FOUND",
      );
    }
    return itemId;
  }

  private async requireItemType(projectId: string, typeId: string) {
    const itemType = await this.itemTypes.findById(projectId, typeId);
    if (!itemType) {
      throw new ServiceError(
        "対象種別が見つかりません。",
        400,
        "ITEM_TYPE_NOT_FOUND",
      );
    }
  }

  async list(projectId: string) {
    const project = await this.projects.get(projectId);
    const [items, itemTypes] = await Promise.all([
      this.repository.list(project.id),
      this.itemTypes.list(project.id),
    ]);
    return { project, items, itemTypes };
  }

  async get(projectId: string, itemId: string) {
    const project = await this.projects.get(projectId);
    const item = await this.repository.findById(
      project.id,
      this.parseItemId(itemId),
    );
    if (!item) {
      throw new ServiceError(
        "タイムラインアイテムが見つかりません。",
        404,
        "TIMELINE_ITEM_NOT_FOUND",
      );
    }
    return { project, item };
  }

  async create(projectId: string, input: unknown) {
    const project = await this.projects.get(projectId);
    const batch: Record<string, unknown> =
      typeof input === "object" && input !== null && "item" in input
        ? input
        : { item: input, events: [] };
    const rawItem = batch.item;
    const rawEvents: unknown[] =
      "events" in batch && Array.isArray(batch.events) ? batch.events : [];
    const result = timelineItemSchema.safeParse(rawItem);
    if (!result.success) throw validationError(result.error);
    await this.requireItemType(project.id, result.data.typeId);

    const events: TimelineEventDraftValues[] = [];
    const failedEvents: TimelineEventCreationFailure[] = [];
    for (const rawEvent of rawEvents.slice(0, 50)) {
      const parsed = timelineEventDraftSchema.safeParse(rawEvent);
      if (parsed.success) {
        events.push(parsed.data);
        continue;
      }
      const title =
        typeof rawEvent === "object" &&
        rawEvent !== null &&
        "title" in rawEvent &&
        typeof rawEvent.title === "string" &&
        rawEvent.title.trim()
          ? rawEvent.title.trim()
          : "タイトル未入力";
      failedEvents.push({
        title,
        reason: "入力内容を確認してください。",
      });
    }
    if (rawEvents.length > 50) {
      for (const rawEvent of rawEvents.slice(50)) {
        const title =
          typeof rawEvent === "object" &&
          rawEvent !== null &&
          "title" in rawEvent &&
          typeof rawEvent.title === "string" &&
          rawEvent.title.trim()
            ? rawEvent.title.trim()
            : "タイトル未入力";
        failedEvents.push({
          title,
          reason: "一度に追加できるイベントは50件までです。",
        });
      }
    }

    const created = await this.repository.createWithEvents(
      project.id,
      result.data,
      events,
    );
    return {
      ...created,
      failedEvents: [...failedEvents, ...created.failedEvents],
    };
  }

  async update(projectId: string, itemId: string, input: unknown) {
    const { project, item: currentItem } = await this.get(projectId, itemId);
    const result = timelineItemSchema.safeParse(input);
    if (!result.success) throw validationError(result.error);
    await this.requireItemType(project.id, result.data.typeId);
    const hasPreviousTitle = result.data.aliases.some(
      (alias) =>
        alias.localeCompare(currentItem.title, "ja", {
          sensitivity: "base",
        }) === 0,
    );
    const enrichedResult = timelineItemSchema.safeParse({
      ...result.data,
      aliases:
        result.data.addPreviousTitleToAliases && !hasPreviousTitle
          ? [...result.data.aliases, currentItem.title]
          : result.data.aliases,
    });
    if (!enrichedResult.success) throw validationError(enrichedResult.error);
    const item = await this.repository.update(
      project.id,
      this.parseItemId(itemId),
      enrichedResult.data,
    );
    if (!item) {
      throw new ServiceError(
        "タイムラインアイテムが見つかりません。",
        404,
        "TIMELINE_ITEM_NOT_FOUND",
      );
    }
    return item;
  }

  async move(projectId: string, itemId: string, input: unknown) {
    const { project } = await this.get(projectId, itemId);
    const result = moveTimelineItemSchema.safeParse(input);
    if (!result.success) throw validationError(result.error);
    if (result.data.typeId) {
      await this.requireItemType(project.id, result.data.typeId);
    }
    await this.repository.move(
      project.id,
      this.parseItemId(itemId),
      result.data.manualOrder,
      result.data.typeId,
    );
    return this.repository.list(project.id);
  }

  async delete(projectId: string, itemId: string) {
    const { project } = await this.get(projectId, itemId);
    const deleted = await this.repository.delete(
      project.id,
      this.parseItemId(itemId),
    );
    if (!deleted) {
      throw new ServiceError(
        "タイムラインアイテムが見つかりません。",
        404,
        "TIMELINE_ITEM_NOT_FOUND",
      );
    }
  }
}
