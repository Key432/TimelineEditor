import type { SupabaseClient } from "@supabase/supabase-js";

import { historicalDateOrdinal } from "@/features/timeline-items/historical-date";
import type {
  AnalysisEntity,
  AnalysisEntityType,
  AnalysisReference,
  ProjectAnalysisDataset,
} from "@/features/project-analysis/analysis";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type DateRow = {
  start_era: "ce" | "bce";
  start_precision: "day" | "month" | "year" | "decade" | "century";
  start_year: number | null;
  start_month: number | null;
  start_day: number | null;
  end_era: "ce" | "bce";
  end_precision: "day" | "month" | "year" | "decade" | "century";
  end_year: number | null;
  end_month: number | null;
  end_day: number | null;
  end_date_status: "specified" | "ongoing" | "unknown" | null;
};

const DATE_FLOOR = -400_000_000;
const DATE_CEILING = 400_000_000;

function itemRange(row: DateRow & { temporal_type: "range" | "point" }) {
  if (row.start_year === null) return { start: DATE_FLOOR, end: DATE_CEILING };
  const start = historicalDateOrdinal({
    era: row.start_era,
    precision: row.start_precision,
    year: row.start_year,
    month: row.start_month,
    day: row.start_day,
  });
  if (row.temporal_type === "point") return { start, end: start };
  const end =
    row.end_date_status === "specified" && row.end_year !== null
      ? historicalDateOrdinal(
          {
            era: row.end_era,
            precision: row.end_precision,
            year: row.end_year,
            month: row.end_month,
            day: row.end_day,
          },
          "end",
        )
      : DATE_CEILING;
  return { start, end };
}

function targetState(
  entities: Map<string, { deleted_at: string | null }>,
  entityType: AnalysisEntityType,
  id: string,
): AnalysisReference["targetState"] {
  const entity = entities.get(`${entityType}:${id}`);
  return !entity ? "missing" : entity.deleted_at ? "deleted" : "active";
}

export class ProjectAnalysisRepository {
  constructor(private readonly client: Client) {}

  async isOwner(projectId: string, ownerId: string) {
    const { data, error } = await this.client
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }

  async dataset(projectId: string): Promise<ProjectAnalysisDataset> {
    const [
      itemsResult,
      eventsResult,
      parentLinksResult,
      itemTagsResult,
      eventTagsResult,
      definitionsResult,
      valuesResult,
      citationsResult,
      tagsResult,
      itemTypesResult,
      eventTypesResult,
      internalLinksResult,
      relationshipsResult,
    ] = await Promise.all([
      this.client
        .from("timeline_items")
        .select(
          "id, type_id, title, aliases, description, source_text, external_url, temporal_type, start_era, start_precision, start_year, start_month, start_day, end_era, end_precision, end_year, end_month, end_day, end_date_status, deleted_at",
        )
        .eq("project_id", projectId),
      this.client
        .from("timeline_events")
        .select(
          "id, event_type_id, title, aliases, description, source_text, external_url, event_era, event_precision, event_year, event_month, event_day, deleted_at",
        )
        .eq("project_id", projectId),
      this.client
        .from("timeline_event_item_links")
        .select("timeline_event_id, timeline_item_id")
        .eq("project_id", projectId),
      this.client
        .from("timeline_item_tags")
        .select("timeline_item_id, tag_id")
        .eq("project_id", projectId),
      this.client
        .from("timeline_event_tags")
        .select("timeline_event_id, tag_id")
        .eq("project_id", projectId),
      this.client
        .from("custom_field_definitions")
        .select("id, entity_type, scope, target_type_id, is_required")
        .eq("project_id", projectId),
      this.client
        .from("custom_field_values")
        .select(
          "field_id, entity_type, entity_id, reference_entity_type, reference_entity_id",
        )
        .eq("project_id", projectId),
      this.client
        .from("source_citations")
        .select("entity_type, entity_id")
        .eq("project_id", projectId),
      this.client.from("tags").select("id, name").eq("project_id", projectId),
      this.client
        .from("timeline_item_types")
        .select("id, name")
        .eq("project_id", projectId),
      this.client
        .from("event_types")
        .select("id, name")
        .eq("project_id", projectId),
      this.client
        .from("internal_links")
        .select(
          "source_entity_type, source_entity_id, target_entity_type, target_entity_id",
        )
        .eq("project_id", projectId),
      this.client
        .from("entity_relationships")
        .select("source_type, source_id, target_type, target_id")
        .eq("project_id", projectId),
    ]);
    for (const result of [
      itemsResult,
      eventsResult,
      parentLinksResult,
      itemTagsResult,
      eventTagsResult,
      definitionsResult,
      valuesResult,
      citationsResult,
      tagsResult,
      itemTypesResult,
      eventTypesResult,
      internalLinksResult,
      relationshipsResult,
    ])
      if (result.error) throw result.error;

    const items = itemsResult.data ?? [];
    const events = eventsResult.data ?? [];
    const parentLinks = parentLinksResult.data ?? [];
    const itemTags = itemTagsResult.data ?? [];
    const eventTags = eventTagsResult.data ?? [];
    const definitions = definitionsResult.data ?? [];
    const values = valuesResult.data ?? [];
    const citations = citationsResult.data ?? [];
    const tags = tagsResult.data ?? [];
    const itemTypes = itemTypesResult.data ?? [];
    const eventTypes = eventTypesResult.data ?? [];
    const internalLinks = internalLinksResult.data ?? [];
    const relationships = relationshipsResult.data ?? [];

    const allEntities = new Map<string, { deleted_at: string | null }>();
    for (const row of items) allEntities.set(`timeline_item:${row.id}`, row);
    for (const row of events) allEntities.set(`timeline_event:${row.id}`, row);
    const cited = new Set(
      citations.map((row) => `${row.entity_type}:${row.entity_id}`),
    );
    const tagsByEntity = new Map<string, string[]>();
    for (const row of itemTags)
      tagsByEntity.set(`timeline_item:${row.timeline_item_id}`, [
        ...(tagsByEntity.get(`timeline_item:${row.timeline_item_id}`) ?? []),
        row.tag_id,
      ]);
    for (const row of eventTags)
      tagsByEntity.set(`timeline_event:${row.timeline_event_id}`, [
        ...(tagsByEntity.get(`timeline_event:${row.timeline_event_id}`) ?? []),
        row.tag_id,
      ]);
    const parentsByEvent = new Map<string, string[]>();
    for (const row of parentLinks)
      parentsByEvent.set(row.timeline_event_id, [
        ...(parentsByEvent.get(row.timeline_event_id) ?? []),
        row.timeline_item_id,
      ]);
    const filledFields = new Map<string, string[]>();
    for (const row of values)
      filledFields.set(`${row.entity_type}:${row.entity_id}`, [
        ...(filledFields.get(`${row.entity_type}:${row.entity_id}`) ?? []),
        row.field_id,
      ]);
    const requiredFields = (
      entityType: AnalysisEntityType,
      typeId: string | null,
    ) =>
      definitions
        .filter(
          (field) =>
            field.entity_type === entityType &&
            field.is_required &&
            (field.scope === "project" || field.target_type_id === typeId),
        )
        .map((field) => field.id);

    const entities: AnalysisEntity[] = [
      ...items
        .filter((row) => !row.deleted_at)
        .map((row) => {
          const range = itemRange(row);
          return {
            id: row.id,
            entityType: "timeline_item" as const,
            title: row.title,
            aliases: row.aliases,
            typeId: row.type_id,
            tagIds: tagsByEntity.get(`timeline_item:${row.id}`) ?? [],
            parentIds: [],
            dateStart: range.start,
            dateEnd: range.end,
            description: row.description,
            sourceMissing:
              !row.source_text?.trim() && !cited.has(`timeline_item:${row.id}`),
            externalUrl: row.external_url,
            requiredFieldIds: requiredFields("timeline_item", row.type_id),
            filledFieldIds: filledFields.get(`timeline_item:${row.id}`) ?? [],
          };
        }),
      ...events
        .filter((row) => !row.deleted_at)
        .map((row) => {
          const ordinal = row.event_year
            ? historicalDateOrdinal({
                era: row.event_era,
                precision: row.event_precision,
                year: row.event_year,
                month: row.event_month,
                day: row.event_day,
              })
            : DATE_FLOOR;
          return {
            id: row.id,
            entityType: "timeline_event" as const,
            title: row.title,
            aliases: row.aliases,
            typeId: row.event_type_id,
            tagIds: tagsByEntity.get(`timeline_event:${row.id}`) ?? [],
            parentIds: parentsByEvent.get(row.id) ?? [],
            dateStart: ordinal,
            dateEnd: ordinal,
            description: row.description,
            sourceMissing:
              !row.source_text?.trim() &&
              !cited.has(`timeline_event:${row.id}`),
            externalUrl: row.external_url,
            requiredFieldIds: requiredFields(
              "timeline_event",
              row.event_type_id,
            ),
            filledFieldIds: filledFields.get(`timeline_event:${row.id}`) ?? [],
          };
        }),
    ];
    const usageByTag = new Map<string, number>();
    for (const tagIds of tagsByEntity.values())
      for (const id of tagIds)
        usageByTag.set(id, (usageByTag.get(id) ?? 0) + 1);
    const usageByType = new Map<string, number>();
    for (const entity of entities)
      if (entity.typeId)
        usageByType.set(
          entity.typeId,
          (usageByType.get(entity.typeId) ?? 0) + 1,
        );
    const references: AnalysisReference[] = [
      ...internalLinks.map((row) => ({
        kind: "internal_link" as const,
        sourceType: row.source_entity_type,
        sourceId: row.source_entity_id,
        targetType: row.target_entity_type,
        targetId: row.target_entity_id,
        targetState: targetState(
          allEntities,
          row.target_entity_type,
          row.target_entity_id,
        ),
      })),
      ...values
        .filter((row) => row.reference_entity_type && row.reference_entity_id)
        .map((row) => ({
          kind: "custom_field" as const,
          sourceType: row.entity_type,
          sourceId: row.entity_id,
          targetType: row.reference_entity_type!,
          targetId: row.reference_entity_id!,
          targetState: targetState(
            allEntities,
            row.reference_entity_type!,
            row.reference_entity_id!,
          ),
        })),
      ...relationships.map((row) => ({
        kind: "relationship" as const,
        sourceType: row.source_type,
        sourceId: row.source_id,
        targetType: row.target_type,
        targetId: row.target_id,
        targetState: targetState(allEntities, row.target_type, row.target_id),
      })),
    ];
    return {
      entities,
      masters: [
        ...tags.map((row) => ({
          kind: "tag" as const,
          id: row.id,
          name: row.name,
          usageCount: usageByTag.get(row.id) ?? 0,
        })),
        ...itemTypes.map((row) => ({
          kind: "timeline_item_type" as const,
          id: row.id,
          name: row.name,
          usageCount: usageByType.get(row.id) ?? 0,
        })),
        ...eventTypes.map((row) => ({
          kind: "event_type" as const,
          id: row.id,
          name: row.name,
          usageCount: usageByType.get(row.id) ?? 0,
        })),
      ],
      references,
    };
  }

  async mergePreview(
    projectId: string,
    entityType: AnalysisEntityType,
    survivorId: string,
    mergedId: string,
  ) {
    const tagQuery =
      entityType === "timeline_item"
        ? this.client
            .from("timeline_item_tags")
            .select("tag_id", { count: "exact", head: true })
            .eq("project_id", projectId)
            .eq("timeline_item_id", mergedId)
        : this.client
            .from("timeline_event_tags")
            .select("tag_id", { count: "exact", head: true })
            .eq("project_id", projectId)
            .eq("timeline_event_id", mergedId);
    const [
      tags,
      citations,
      mergedFields,
      survivorFields,
      parents,
      links,
      relationships,
    ] = await Promise.all([
      tagQuery,
      this.client
        .from("source_citations")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("entity_type", entityType)
        .eq("entity_id", mergedId),
      this.client
        .from("custom_field_values")
        .select("field_id")
        .eq("project_id", projectId)
        .eq("entity_type", entityType)
        .eq("entity_id", mergedId),
      this.client
        .from("custom_field_values")
        .select("field_id")
        .eq("project_id", projectId)
        .eq("entity_type", entityType)
        .eq("entity_id", survivorId),
      entityType === "timeline_item"
        ? this.client
            .from("timeline_event_item_links")
            .select("timeline_event_id", { count: "exact", head: true })
            .eq("project_id", projectId)
            .eq("timeline_item_id", mergedId)
        : this.client
            .from("timeline_event_item_links")
            .select("timeline_item_id", { count: "exact", head: true })
            .eq("project_id", projectId)
            .eq("timeline_event_id", mergedId),
      this.client
        .from("internal_links")
        .select("source_entity_id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("target_entity_type", entityType)
        .eq("target_entity_id", mergedId),
      this.client
        .from("entity_relationships")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .or(
          `and(source_type.eq.${entityType},source_id.eq.${mergedId}),and(target_type.eq.${entityType},target_id.eq.${mergedId})`,
        ),
    ]);
    for (const result of [
      tags,
      citations,
      mergedFields,
      survivorFields,
      parents,
      links,
      relationships,
    ])
      if (result.error) throw result.error;
    const survivorFieldIds = new Set(
      (survivorFields.data ?? []).map((row) => row.field_id),
    );
    return {
      tags: tags.count ?? 0,
      citations: citations.count ?? 0,
      customFields: mergedFields.data?.length ?? 0,
      customFieldConflicts:
        mergedFields.data?.filter((row) => survivorFieldIds.has(row.field_id))
          .length ?? 0,
      parentsOrEvents: parents.count ?? 0,
      internalLinks: links.count ?? 0,
      relationships: relationships.count ?? 0,
    };
  }

  async merge(
    projectId: string,
    entityType: AnalysisEntityType,
    survivorId: string,
    mergedId: string,
  ) {
    const { data, error } = await this.client.rpc("merge_timeline_entities", {
      p_project_id: projectId,
      p_entity_type: entityType,
      p_survivor_id: survivorId,
      p_merged_id: mergedId,
    });
    if (error) throw error;
    return data;
  }

  async undo(projectId: string, operationId: string) {
    const { data, error } = await this.client.rpc(
      "undo_timeline_entity_merge",
      {
        p_project_id: projectId,
        p_operation_id: operationId,
      },
    );
    if (error) throw error;
    return data;
  }
}
