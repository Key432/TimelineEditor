import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  customFieldDefinitionSchema,
  customFieldEntriesSchema,
  eventTypeSchema,
  tagSchema,
} from "@/features/classification/validation";
import type {
  CustomFieldEntityType,
  CustomFieldEntry,
} from "@/features/classification/types";
import { ClassificationRepository } from "@/lib/repositories/classification-repository";
import { ServiceError } from "@/lib/services/errors";
import { ProjectService } from "@/lib/services/project-service";
import type { Database } from "@/lib/supabase/database.types";
import { ItemTypeRepository } from "@/lib/repositories/item-type-repository";

function invalid(error: z.ZodError) {
  return new ServiceError(
    "入力内容を確認してください。",
    400,
    "VALIDATION_ERROR",
    z.flattenError(error),
  );
}

const idSchema = z.uuid();

export class ClassificationService {
  private readonly repository: ClassificationRepository;
  private readonly projects: ProjectService;
  private readonly itemTypes: ItemTypeRepository;
  constructor(client: SupabaseClient<Database>) {
    this.repository = new ClassificationRepository(client);
    this.projects = new ProjectService(client);
    this.itemTypes = new ItemTypeRepository(client);
  }

  private parseId(id: string) {
    if (!idSchema.safeParse(id).success)
      throw new ServiceError(
        "分類が見つかりません。",
        404,
        "CLASSIFICATION_NOT_FOUND",
      );
    return id;
  }

  async list(projectId: string) {
    const project = await this.projects.get(projectId);
    const [tags, eventTypes, customFields] = await Promise.all([
      this.repository.listTags(project.id),
      this.repository.listEventTypes(project.id),
      this.repository.listDefinitions(project.id),
    ]);
    return { tags, eventTypes, customFields };
  }

  async createTag(projectId: string, input: unknown) {
    const project = await this.projects.get(projectId);
    const parsed = tagSchema.safeParse(input);
    if (!parsed.success) throw invalid(parsed.error);
    return this.repository.createTag(project.id, parsed.data);
  }
  async updateTag(projectId: string, id: string, input: unknown) {
    const project = await this.projects.get(projectId);
    const parsed = tagSchema.safeParse(input);
    if (!parsed.success) throw invalid(parsed.error);
    const tag = await this.repository.updateTag(
      project.id,
      this.parseId(id),
      parsed.data,
    );
    if (!tag)
      throw new ServiceError("タグが見つかりません。", 404, "TAG_NOT_FOUND");
    return tag;
  }
  async deleteTag(projectId: string, id: string, unusedOnly: boolean) {
    const project = await this.projects.get(projectId);
    if (
      !(await this.repository.deleteTag(
        project.id,
        this.parseId(id),
        unusedOnly,
      ))
    )
      throw new ServiceError(
        unusedOnly
          ? "使用中のタグは削除できません。"
          : "タグが見つかりません。",
        unusedOnly ? 409 : 404,
        "TAG_DELETE_FAILED",
      );
  }
  async mergeTags(projectId: string, sourceId: string, targetId: string) {
    const project = await this.projects.get(projectId);
    await this.repository.mergeTags(
      project.id,
      this.parseId(sourceId),
      this.parseId(targetId),
    );
  }

  async createEventType(projectId: string, input: unknown) {
    const project = await this.projects.get(projectId);
    const parsed = eventTypeSchema.safeParse(input);
    if (!parsed.success) throw invalid(parsed.error);
    return this.repository.createEventType(project.id, parsed.data);
  }
  async updateEventType(projectId: string, id: string, input: unknown) {
    const project = await this.projects.get(projectId);
    const parsed = eventTypeSchema.safeParse(input);
    if (!parsed.success) throw invalid(parsed.error);
    const eventType = await this.repository.updateEventType(
      project.id,
      this.parseId(id),
      parsed.data,
    );
    if (!eventType)
      throw new ServiceError(
        "イベント種別が見つかりません。",
        404,
        "EVENT_TYPE_NOT_FOUND",
      );
    return eventType;
  }
  async deleteEventType(projectId: string, id: string) {
    const project = await this.projects.get(projectId);
    const eventType = (await this.repository.listEventTypes(project.id)).find(
      (type) => type.id === this.parseId(id),
    );
    if (!eventType)
      throw new ServiceError(
        "イベント種別が見つかりません。",
        404,
        "EVENT_TYPE_NOT_FOUND",
      );
    if (eventType.usageCount > 0)
      throw new ServiceError(
        "使用中のイベント種別は削除できません。",
        409,
        "EVENT_TYPE_IN_USE",
      );
    if (!(await this.repository.deleteEventType(project.id, this.parseId(id))))
      throw new ServiceError(
        "使用中のイベント種別は削除できません。",
        409,
        "EVENT_TYPE_DELETE_FAILED",
      );
  }

  async createDefinition(projectId: string, input: unknown) {
    const project = await this.projects.get(projectId);
    const parsed = customFieldDefinitionSchema.safeParse(input);
    if (!parsed.success) throw invalid(parsed.error);
    await this.requireDefinitionTarget(
      project.id,
      parsed.data.entityType,
      parsed.data.scope,
      parsed.data.targetTypeId,
    );
    return this.repository.createDefinition(project.id, parsed.data);
  }
  async updateDefinition(projectId: string, id: string, input: unknown) {
    const project = await this.projects.get(projectId);
    const parsed = customFieldDefinitionSchema.safeParse(input);
    if (!parsed.success) throw invalid(parsed.error);
    await this.requireDefinitionTarget(
      project.id,
      parsed.data.entityType,
      parsed.data.scope,
      parsed.data.targetTypeId,
    );
    const field = await this.repository.updateDefinition(
      project.id,
      this.parseId(id),
      parsed.data,
    );
    if (!field)
      throw new ServiceError(
        "カスタムフィールドが見つかりません。",
        404,
        "CUSTOM_FIELD_NOT_FOUND",
      );
    return field;
  }

  private async requireDefinitionTarget(
    projectId: string,
    entityType: CustomFieldEntityType,
    scope: "project" | "type",
    targetTypeId: string | null,
  ) {
    if (scope === "project") return;
    const exists =
      entityType === "timeline_item"
        ? Boolean(
            targetTypeId &&
            (await this.itemTypes.findById(projectId, targetTypeId)),
          )
        : Boolean(
            targetTypeId &&
            (await this.repository.listEventTypes(projectId)).some(
              (type) => type.id === targetTypeId,
            ),
          );
    if (!exists)
      throw new ServiceError(
        "対象種別が見つかりません。",
        400,
        "CUSTOM_FIELD_TARGET_NOT_FOUND",
      );
  }
  async deleteDefinition(projectId: string, id: string) {
    const project = await this.projects.get(projectId);
    if (!(await this.repository.deleteDefinition(project.id, this.parseId(id))))
      throw new ServiceError(
        "カスタムフィールドが見つかりません。",
        404,
        "CUSTOM_FIELD_NOT_FOUND",
      );
  }

  async validateEntityMetadata(
    projectId: string,
    entityType: CustomFieldEntityType,
    typeId: string | null,
    tagIds: string[],
    values: unknown,
  ) {
    const [tags, definitions] = await Promise.all([
      this.repository.listTags(projectId),
      this.repository.listDefinitions(projectId),
    ]);
    const uniqueTagIds = [...new Set(tagIds)];
    if (uniqueTagIds.some((id) => !tags.some((tag) => tag.id === id)))
      throw new ServiceError(
        "選択したタグが見つかりません。",
        400,
        "TAG_NOT_FOUND",
      );
    const parsed = customFieldEntriesSchema.safeParse(values);
    if (!parsed.success) throw invalid(parsed.error);
    const applicable = definitions.filter(
      (field) =>
        field.entityType === entityType &&
        (field.scope === "project" || field.targetTypeId === typeId),
    );
    const entries = parsed.data.filter(
      (entry) =>
        !(typeof entry.value === "string" && entry.value.trim() === "") &&
        !(Array.isArray(entry.value) && entry.value.length === 0),
    );
    for (const entry of entries) {
      const definition = applicable.find((field) => field.id === entry.fieldId);
      if (!definition)
        throw new ServiceError(
          "利用できないカスタムフィールドが含まれています。",
          400,
          "CUSTOM_FIELD_NOT_APPLICABLE",
        );
      const value = entry.value;
      const valid =
        (definition.fieldType === "number" && typeof value === "number") ||
        (definition.fieldType === "boolean" && typeof value === "boolean") ||
        (definition.fieldType === "multi_select" && Array.isArray(value)) ||
        (definition.fieldType === "historical_date" &&
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value) &&
          "year" in value) ||
        (definition.fieldType === "entity_reference" &&
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value) &&
          "entityId" in value) ||
        (["text", "multiline", "single_select", "url"].includes(
          definition.fieldType,
        ) &&
          typeof value === "string");
      if (!valid)
        throw new ServiceError(
          `${definition.name}の値の形式が正しくありません。`,
          400,
          "CUSTOM_FIELD_TYPE_MISMATCH",
        );
      if (["single_select", "multi_select"].includes(definition.fieldType)) {
        const selected = Array.isArray(value) ? value : [value as string];
        if (selected.some((option) => !definition.options.includes(option)))
          throw new ServiceError(
            `${definition.name}に存在しない選択肢が含まれています。`,
            400,
            "CUSTOM_FIELD_OPTION_NOT_FOUND",
          );
      }
      if (definition.fieldType === "url" && typeof value === "string") {
        try {
          const url = new URL(value);
          if (!["http:", "https:"].includes(url.protocol)) throw new Error();
        } catch {
          throw new ServiceError(
            `${definition.name}にはhttpまたはhttpsのURLを入力してください。`,
            400,
            "CUSTOM_FIELD_URL_INVALID",
          );
        }
      }
    }
    for (const definition of applicable.filter((field) => field.isRequired))
      if (!entries.some((entry) => entry.fieldId === definition.id))
        throw new ServiceError(
          `${definition.name}は必須です。`,
          400,
          "CUSTOM_FIELD_REQUIRED",
        );
    return { tagIds: uniqueTagIds, customFields: entries };
  }

  async requireEventType(projectId: string, eventTypeId: string | null) {
    if (!eventTypeId) return;
    if (
      !(await this.repository.listEventTypes(projectId)).some(
        (type) => type.id === eventTypeId,
      )
    )
      throw new ServiceError(
        "イベント種別が見つかりません。",
        400,
        "EVENT_TYPE_NOT_FOUND",
      );
  }

  async attachEntityMetadata(
    projectId: string,
    entityType: CustomFieldEntityType,
    entityId: string,
    tagIds: string[],
    values: CustomFieldEntry[],
  ) {
    await Promise.all([
      this.repository.replaceEntityTags(
        projectId,
        entityType,
        entityId,
        tagIds,
      ),
      this.repository.replaceValues(projectId, entityType, entityId, values),
    ]);
  }

  async loadEntityMetadata(
    projectId: string,
    entityType: CustomFieldEntityType,
    entityId: string,
  ) {
    const [tagIds, customFields] = await Promise.all([
      this.repository.listEntityTags(projectId, entityType, entityId),
      this.repository.listValues(projectId, entityType, entityId),
    ]);
    return { tagIds, customFields };
  }
}
