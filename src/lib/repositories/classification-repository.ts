import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CustomFieldEntry,
  CustomFieldEntityType,
} from "@/features/classification/types";
import type {
  CustomFieldDefinitionInput,
  EventTypeInput,
  TagInput,
} from "@/features/classification/validation";
import type { HistoricalDate } from "@/features/timeline-items/types";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export class ClassificationRepository {
  constructor(private readonly client: Client) {}

  async listTags(projectId: string) {
    const [{ data, error }, itemUses, eventUses] = await Promise.all([
      this.client
        .from("tags")
        .select("*")
        .eq("project_id", projectId)
        .order("name"),
      this.client
        .from("timeline_item_tags")
        .select("tag_id")
        .eq("project_id", projectId),
      this.client
        .from("timeline_event_tags")
        .select("tag_id")
        .eq("project_id", projectId),
    ]);
    if (error) throw error;
    if (itemUses.error) throw itemUses.error;
    if (eventUses.error) throw eventUses.error;
    const counts = new Map<string, number>();
    for (const row of [...itemUses.data, ...eventUses.data])
      counts.set(row.tag_id, (counts.get(row.tag_id) ?? 0) + 1);
    return data.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      color: row.color,
      description: row.description,
      usageCount: counts.get(row.id) ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async createTag(projectId: string, input: TagInput) {
    const { data, error } = await this.client
      .from("tags")
      .insert({
        project_id: projectId,
        name: input.name,
        color: input.color,
        description: input.description,
      })
      .select("*")
      .single();
    if (error) throw error;
    return {
      id: data.id,
      projectId: data.project_id,
      name: data.name,
      color: data.color,
      description: data.description,
      usageCount: 0,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async updateTag(projectId: string, tagId: string, input: TagInput) {
    const { data, error } = await this.client
      .from("tags")
      .update(input)
      .eq("project_id", projectId)
      .eq("id", tagId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async deleteTag(projectId: string, tagId: string, unusedOnly = false) {
    if (unusedOnly) {
      const tags = await this.listTags(projectId);
      const tag = tags.find((candidate) => candidate.id === tagId);
      if (!tag || tag.usageCount > 0) return false;
    }
    const { data, error } = await this.client
      .from("tags")
      .delete()
      .eq("project_id", projectId)
      .eq("id", tagId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }

  async mergeTags(projectId: string, sourceTagId: string, targetTagId: string) {
    const { error } = await this.client.rpc("merge_tags", {
      p_project_id: projectId,
      p_source_tag_id: sourceTagId,
      p_target_tag_id: targetTagId,
    });
    if (error) throw error;
  }

  async listEventTypes(projectId: string) {
    const [{ data, error }, uses] = await Promise.all([
      this.client
        .from("event_types")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order")
        .order("name"),
      this.client
        .from("timeline_events")
        .select("event_type_id")
        .eq("project_id", projectId)
        .not("event_type_id", "is", null)
        .is("deleted_at", null),
    ]);
    if (error) throw error;
    if (uses.error) throw uses.error;
    const counts = new Map<string, number>();
    for (const row of uses.data)
      if (row.event_type_id)
        counts.set(row.event_type_id, (counts.get(row.event_type_id) ?? 0) + 1);
    return data.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      color: row.color,
      markerShape: row.marker_shape,
      description: row.description,
      sortOrder: row.sort_order,
      usageCount: counts.get(row.id) ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async createEventType(projectId: string, input: EventTypeInput) {
    const existing = await this.listEventTypes(projectId);
    const { data, error } = await this.client
      .from("event_types")
      .insert({
        project_id: projectId,
        name: input.name,
        color: input.color,
        marker_shape: input.markerShape,
        description: input.description,
        sort_order: existing.length,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async updateEventType(projectId: string, id: string, input: EventTypeInput) {
    const { data, error } = await this.client
      .from("event_types")
      .update({
        name: input.name,
        color: input.color,
        marker_shape: input.markerShape,
        description: input.description,
      })
      .eq("project_id", projectId)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async deleteEventType(projectId: string, id: string) {
    const { data, error } = await this.client
      .from("event_types")
      .delete()
      .eq("project_id", projectId)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }

  async listDefinitions(projectId: string) {
    const { data, error } = await this.client
      .from("custom_field_definitions")
      .select("*")
      .eq("project_id", projectId)
      .order("entity_type")
      .order("sort_order")
      .order("name");
    if (error) throw error;
    return data.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      entityType: row.entity_type,
      scope: row.scope,
      targetTypeId: row.target_type_id,
      name: row.name,
      fieldType: row.field_type,
      isRequired: row.is_required,
      options: row.options,
      description: row.description,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async createDefinition(projectId: string, input: CustomFieldDefinitionInput) {
    const definitions = await this.listDefinitions(projectId);
    const { data, error } = await this.client
      .from("custom_field_definitions")
      .insert({
        project_id: projectId,
        entity_type: input.entityType,
        scope: input.scope,
        target_type_id: input.targetTypeId,
        name: input.name,
        field_type: input.fieldType,
        is_required: input.isRequired,
        options: input.options,
        description: input.description,
        sort_order: definitions.filter(
          (field) => field.entityType === input.entityType,
        ).length,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async updateDefinition(
    projectId: string,
    id: string,
    input: CustomFieldDefinitionInput,
  ) {
    const { data, error } = await this.client
      .from("custom_field_definitions")
      .update({
        entity_type: input.entityType,
        scope: input.scope,
        target_type_id: input.targetTypeId,
        name: input.name,
        field_type: input.fieldType,
        is_required: input.isRequired,
        options: input.options,
        description: input.description,
      })
      .eq("project_id", projectId)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async deleteDefinition(projectId: string, id: string) {
    const { data, error } = await this.client
      .from("custom_field_definitions")
      .delete()
      .eq("project_id", projectId)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }

  async listEntityTags(
    projectId: string,
    entityType: CustomFieldEntityType,
    entityId: string,
  ) {
    const result =
      entityType === "timeline_item"
        ? await this.client
            .from("timeline_item_tags")
            .select("tag_id")
            .eq("project_id", projectId)
            .eq("timeline_item_id", entityId)
        : await this.client
            .from("timeline_event_tags")
            .select("tag_id")
            .eq("project_id", projectId)
            .eq("timeline_event_id", entityId);
    const { data, error } = result;
    if (error) throw error;
    return data.map((row) => row.tag_id);
  }

  async replaceEntityTags(
    projectId: string,
    entityType: CustomFieldEntityType,
    entityId: string,
    tagIds: string[],
  ) {
    const deletion =
      entityType === "timeline_item"
        ? await this.client
            .from("timeline_item_tags")
            .delete()
            .eq("project_id", projectId)
            .eq("timeline_item_id", entityId)
        : await this.client
            .from("timeline_event_tags")
            .delete()
            .eq("project_id", projectId)
            .eq("timeline_event_id", entityId);
    if (deletion.error) throw deletion.error;
    if (tagIds.length === 0) return;
    const result =
      entityType === "timeline_item"
        ? await this.client.from("timeline_item_tags").insert(
            tagIds.map((tagId) => ({
              project_id: projectId,
              timeline_item_id: entityId,
              tag_id: tagId,
            })),
          )
        : await this.client.from("timeline_event_tags").insert(
            tagIds.map((tagId) => ({
              project_id: projectId,
              timeline_event_id: entityId,
              tag_id: tagId,
            })),
          );
    const { error } = result;
    if (error) throw error;
  }

  async listValues(
    projectId: string,
    entityType: CustomFieldEntityType,
    entityId: string,
  ): Promise<CustomFieldEntry[]> {
    const { data, error } = await this.client
      .from("custom_field_values")
      .select("*")
      .eq("project_id", projectId)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId);
    if (error) throw error;
    return data.map((row) => ({
      fieldId: row.field_id,
      value:
        row.text_value ??
        row.number_value ??
        row.boolean_value ??
        row.multi_value ??
        (row.date_year
          ? ({
              era: row.date_era!,
              precision: row.date_precision!,
              year: row.date_year,
              month: row.date_month,
              day: row.date_day,
              originalText: row.date_original_text,
              calendar: row.date_calendar!,
            } satisfies HistoricalDate)
          : {
              entityType: row.reference_entity_type!,
              entityId: row.reference_entity_id!,
            }),
    }));
  }

  async replaceValues(
    projectId: string,
    entityType: CustomFieldEntityType,
    entityId: string,
    values: CustomFieldEntry[],
  ) {
    const deletion = await this.client
      .from("custom_field_values")
      .delete()
      .eq("project_id", projectId)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId);
    if (deletion.error) throw deletion.error;
    if (values.length === 0) return;
    const rows = values.map(({ fieldId, value }) => {
      const base = {
        project_id: projectId,
        field_id: fieldId,
        entity_type: entityType,
        entity_id: entityId,
      };
      if (typeof value === "string") return { ...base, text_value: value };
      if (typeof value === "number") return { ...base, number_value: value };
      if (typeof value === "boolean") return { ...base, boolean_value: value };
      if (Array.isArray(value)) return { ...base, multi_value: value };
      if ("year" in value)
        return {
          ...base,
          date_era: value.era ?? "ce",
          date_precision: value.precision ?? "year",
          date_year: value.year,
          date_month: value.month,
          date_day: value.day,
          date_original_text: value.originalText ?? null,
          date_calendar: value.calendar ?? "proleptic_gregorian",
        };
      return {
        ...base,
        reference_entity_type: value.entityType,
        reference_entity_id: value.entityId,
      };
    });
    const { error } = await this.client
      .from("custom_field_values")
      .insert(rows);
    if (error) throw error;
  }
}
