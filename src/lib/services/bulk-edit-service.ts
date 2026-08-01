import type { SupabaseClient } from "@supabase/supabase-js";

import {
  bulkEditSchema,
  undoBulkEditSchema,
} from "@/features/table-view/bulk-validation";
import { eventToInput, itemToInput } from "@/features/table-view/table-model";
import { BulkEditRepository } from "@/lib/repositories/bulk-edit-repository";
import { ServiceError } from "@/lib/services/errors";
import { HistoryService } from "@/lib/services/history-service";
import { ProjectService } from "@/lib/services/project-service";
import { TimelineEventService } from "@/lib/services/timeline-event-service";
import { TimelineItemService } from "@/lib/services/timeline-item-service";
import type { Database, Json } from "@/lib/supabase/database.types";

type InverseEntry = { entityId: string; deleted?: boolean; patch?: Json };

function label(kind: string, count: number) {
  const action: Record<string, string> = {
    set_visibility: "表示状態変更",
    set_color: "個別色変更",
    set_type: "種別変更",
    tags: "タグ変更",
    delete: "削除",
  };
  return `${count}件の${action[kind] ?? "一括変更"}`;
}

export class BulkEditService {
  private readonly repository: BulkEditRepository;
  private readonly projects: ProjectService;
  private readonly items: TimelineItemService;
  private readonly events: TimelineEventService;
  private readonly history: HistoryService;

  constructor(private readonly client: SupabaseClient<Database>) {
    this.repository = new BulkEditRepository(client);
    this.projects = new ProjectService(client);
    this.items = new TimelineItemService(client);
    this.events = new TimelineEventService(client);
    this.history = new HistoryService(client);
  }

  async execute(projectId: string, input: unknown) {
    const parsed = bulkEditSchema.safeParse(input);
    if (!parsed.success)
      throw new ServiceError(
        "一括操作を確認してください。",
        400,
        "VALIDATION_ERROR",
        parsed.error.flatten(),
      );
    await this.projects.get(projectId);
    const counts = await this.repository.dependencyCounts(
      projectId,
      parsed.data.entityType,
      parsed.data.ids,
    );
    if (parsed.data.preview) return { preview: counts };
    const { data: auth } = await this.client.auth.getUser();
    if (!auth.user)
      throw new ServiceError("ログインが必要です。", 401, "UNAUTHENTICATED");
    const inverse: InverseEntry[] = [];
    if (parsed.data.entityType === "timeline_item") {
      const current = await Promise.all(
        parsed.data.ids.map((id) => this.items.get(projectId, id)),
      );
      for (const { item } of current) {
        const operation = parsed.data.operation;
        if (operation.kind === "delete") {
          inverse.push({ entityId: item.id, deleted: true });
          await this.items.delete(projectId, item.id);
          continue;
        }
        let values = itemToInput(item);
        if (operation.kind === "set_visibility") {
          inverse.push({
            entityId: item.id,
            patch: { isVisible: item.isVisible },
          });
          values = { ...values, isVisible: operation.value };
        } else if (operation.kind === "set_color") {
          inverse.push({
            entityId: item.id,
            patch: { colorOverride: item.colorOverride },
          });
          values = { ...values, colorOverride: operation.value };
        } else if (operation.kind === "set_type") {
          if (!operation.value)
            throw new ServiceError(
              "タイムライン種別を選択してください。",
              400,
              "TYPE_REQUIRED",
            );
          inverse.push({ entityId: item.id, patch: { typeId: item.typeId } });
          values = { ...values, typeId: operation.value };
        } else if (operation.kind === "tags") {
          const currentIds = values.tagIds ?? [];
          inverse.push({ entityId: item.id, patch: { tagIds: currentIds } });
          values = {
            ...values,
            tagIds:
              operation.mode === "replace"
                ? operation.tagIds
                : operation.mode === "add"
                  ? [...new Set([...currentIds, ...operation.tagIds])]
                  : currentIds.filter((id) => !operation.tagIds.includes(id)),
          };
        }
        await this.items.update(projectId, item.id, {
          values,
          expectedUpdatedAt: item.updatedAt,
        });
      }
    } else {
      const current = await Promise.all(
        parsed.data.ids.map((id) => this.events.get(projectId, id)),
      );
      for (const { event } of current) {
        const operation = parsed.data.operation;
        if (
          operation.kind === "set_visibility" ||
          operation.kind === "set_color"
        )
          throw new ServiceError(
            "イベントではこの一括操作を利用できません。",
            400,
            "OPERATION_NOT_SUPPORTED",
          );
        if (operation.kind === "delete") {
          inverse.push({ entityId: event.id, deleted: true });
          await this.events.delete(projectId, event.id);
          continue;
        }
        let values = eventToInput(event);
        if (operation.kind === "set_type") {
          inverse.push({
            entityId: event.id,
            patch: { eventTypeId: event.eventTypeId ?? null },
          });
          values = { ...values, eventTypeId: operation.value };
        } else if (operation.kind === "tags") {
          const currentIds = values.tagIds ?? [];
          inverse.push({ entityId: event.id, patch: { tagIds: currentIds } });
          values = {
            ...values,
            tagIds:
              operation.mode === "replace"
                ? operation.tagIds
                : operation.mode === "add"
                  ? [...new Set([...currentIds, ...operation.tagIds])]
                  : currentIds.filter((id) => !operation.tagIds.includes(id)),
          };
        }
        await this.events.update(projectId, event.id, {
          values,
          expectedUpdatedAt: event.updatedAt,
        });
      }
    }
    const recorded = await this.repository.record({
      projectId,
      ownerId: auth.user.id,
      entityType: parsed.data.entityType,
      label: label(parsed.data.operation.kind, inverse.length),
      inversePatch: inverse as Json,
      affectedCount: inverse.length,
    });
    return {
      operation: {
        id: recorded.id,
        label: recorded.label,
        affectedCount: recorded.affected_count,
      },
    };
  }

  async undo(projectId: string, input: unknown) {
    const parsed = undoBulkEditSchema.safeParse(input);
    if (!parsed.success)
      throw new ServiceError(
        "Undo対象が正しくありません。",
        400,
        "VALIDATION_ERROR",
      );
    await this.projects.get(projectId);
    const operation = await this.repository.find(
      projectId,
      parsed.data.operationId,
    );
    if (!operation)
      throw new ServiceError(
        "Undoできる一括操作が見つかりません。",
        404,
        "BULK_OPERATION_NOT_FOUND",
      );
    const inverse = operation.inverse_patch as unknown as InverseEntry[];
    for (const entry of [...inverse].reverse()) {
      if (entry.deleted) {
        await this.history.restoreTrash(
          projectId,
          operation.entity_type,
          entry.entityId,
        );
      } else if (entry.patch && operation.entity_type === "timeline_item") {
        const { item } = await this.items.get(projectId, entry.entityId);
        const values = {
          ...itemToInput(item),
          ...(entry.patch as Record<string, unknown>),
        };
        await this.items.update(projectId, entry.entityId, {
          values,
          expectedUpdatedAt: item.updatedAt,
        });
      } else if (entry.patch) {
        const { event } = await this.events.get(projectId, entry.entityId);
        const values = {
          ...eventToInput(event),
          ...(entry.patch as Record<string, unknown>),
        };
        await this.events.update(projectId, entry.entityId, {
          values,
          expectedUpdatedAt: event.updatedAt,
        });
      }
    }
    await this.repository.markUndone(projectId, operation.id);
    return { undone: true };
  }
}
