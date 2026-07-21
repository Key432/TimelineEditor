import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { timelineEventSchema } from "@/features/timeline-events/validation";
import { TimelineEventRepository } from "@/lib/repositories/timeline-event-repository";
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

export class TimelineEventService {
  private readonly repository: TimelineEventRepository;
  private readonly items: TimelineItemRepository;
  private readonly projects: ProjectService;

  constructor(client: SupabaseClient<Database>) {
    this.repository = new TimelineEventRepository(client);
    this.items = new TimelineItemRepository(client);
    this.projects = new ProjectService(client);
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
    await this.requireRangeParent(project.id, result.data.timelineItemId);
    return this.repository.create(project.id, result.data);
  }

  async update(projectId: string, eventId: string, input: unknown) {
    const { project } = await this.get(projectId, eventId);
    const result = timelineEventSchema.safeParse(input);
    if (!result.success) throw validationError(result.error);
    await this.requireRangeParent(project.id, result.data.timelineItemId);
    const event = await this.repository.update(
      project.id,
      this.parseEventId(eventId),
      result.data,
    );
    if (!event) {
      throw new ServiceError(
        "イベントアイテムが見つかりません。",
        404,
        "TIMELINE_EVENT_NOT_FOUND",
      );
    }
    return event;
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
