import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ProjectBackup,
  ImportMode,
} from "@/features/import-export/schema";
import { IMPORT_SCHEMA_VERSION } from "@/features/import-export/schema";
import type { Database, Json } from "@/lib/supabase/database.types";
import { ClassificationRepository } from "@/lib/repositories/classification-repository";
import type { CustomFieldEntry } from "@/features/classification/types";

type Client = SupabaseClient<Database>;

const date = (
  year: number | null,
  month: number | null,
  day: number | null,
  era: "ce" | "bce",
  precision: "day" | "month" | "year" | "decade" | "century",
  originalText: string | null,
  calendar: string,
) =>
  year === null
    ? null
    : { year, month, day, era, precision, originalText, calendar };

function mapCustomValue(
  row: Database["public"]["Tables"]["custom_field_values"]["Row"],
): CustomFieldEntry {
  const value =
    row.text_value ??
    row.number_value ??
    row.boolean_value ??
    row.multi_value ??
    (row.date_year !== null
      ? {
          era: row.date_era!,
          precision: row.date_precision!,
          year: row.date_year,
          month: row.date_month,
          day: row.date_day,
          originalText: row.date_original_text,
          calendar: row.date_calendar!,
        }
      : {
          entityType: row.reference_entity_type!,
          entityId: row.reference_entity_id!,
        });
  return { fieldId: row.field_id, value };
}

export class ImportExportRepository {
  private readonly classification: ClassificationRepository;
  constructor(private readonly client: Client) {
    this.classification = new ClassificationRepository(client);
  }

  private async listItemTypes(projectId: string) {
    const rows: Database["public"]["Tables"]["timeline_item_types"]["Row"][] =
      [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await this.client
        .from("timeline_item_types")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order")
        .range(from, from + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) return rows;
    }
  }

  private async listItems(projectId: string) {
    const rows: Database["public"]["Tables"]["timeline_items"]["Row"][] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await this.client
        .from("timeline_items")
        .select("*")
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .order("manual_order")
        .order("id")
        .range(from, from + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) return rows;
    }
  }

  private async listEvents(projectId: string) {
    const rows: Database["public"]["Tables"]["timeline_events"]["Row"][] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await this.client
        .from("timeline_events")
        .select("*")
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .order("event_year")
        .order("event_month")
        .order("event_day")
        .order("id")
        .range(from, from + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) return rows;
    }
  }

  private async listEventParentLinks(projectId: string) {
    const rows: Database["public"]["Tables"]["timeline_event_item_links"]["Row"][] =
      [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await this.client
        .from("timeline_event_item_links")
        .select("*")
        .eq("project_id", projectId)
        .order("timeline_event_id")
        .order("sort_order")
        .range(from, from + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) return rows;
    }
  }

  private async listItemTagLinks(projectId: string) {
    const rows: Database["public"]["Tables"]["timeline_item_tags"]["Row"][] =
      [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await this.client
        .from("timeline_item_tags")
        .select("*")
        .eq("project_id", projectId)
        .range(from, from + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) return rows;
    }
  }
  private async listEventTagLinks(projectId: string) {
    const rows: Database["public"]["Tables"]["timeline_event_tags"]["Row"][] =
      [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await this.client
        .from("timeline_event_tags")
        .select("*")
        .eq("project_id", projectId)
        .range(from, from + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) return rows;
    }
  }
  private async listCustomValues(projectId: string) {
    const rows: Database["public"]["Tables"]["custom_field_values"]["Row"][] =
      [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await this.client
        .from("custom_field_values")
        .select("*")
        .eq("project_id", projectId)
        .range(from, from + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) return rows;
    }
  }

  async export(projectId: string): Promise<ProjectBackup | null> {
    const [
      projectResult,
      settingsResult,
      types,
      items,
      events,
      eventParentLinks,
      tags,
      eventTypes,
      customFields,
      itemTagLinks,
      eventTagLinks,
      customValues,
    ] = await Promise.all([
      this.client
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle(),
      this.client
        .from("project_settings")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle(),
      this.listItemTypes(projectId),
      this.listItems(projectId),
      this.listEvents(projectId),
      this.listEventParentLinks(projectId),
      this.classification.listTags(projectId),
      this.classification.listEventTypes(projectId),
      this.classification.listDefinitions(projectId),
      this.listItemTagLinks(projectId),
      this.listEventTagLinks(projectId),
      this.listCustomValues(projectId),
    ]);
    for (const result of [projectResult, settingsResult])
      if (result.error) throw result.error;
    const project = projectResult.data;
    const settings = settingsResult.data;
    if (!project || !settings) return null;
    const itemTags = new Map<string, string[]>();
    for (const link of itemTagLinks)
      itemTags.set(link.timeline_item_id, [
        ...(itemTags.get(link.timeline_item_id) ?? []),
        link.tag_id,
      ]);
    const eventTags = new Map<string, string[]>();
    for (const link of eventTagLinks)
      eventTags.set(link.timeline_event_id, [
        ...(eventTags.get(link.timeline_event_id) ?? []),
        link.tag_id,
      ]);
    const eventParents = new Map<string, string[]>();
    for (const link of eventParentLinks)
      eventParents.set(link.timeline_event_id, [
        ...(eventParents.get(link.timeline_event_id) ?? []),
        link.timeline_item_id,
      ]);
    const itemValues = new Map<string, CustomFieldEntry[]>();
    const eventValues = new Map<string, CustomFieldEntry[]>();
    for (const value of customValues) {
      const target =
        value.entity_type === "timeline_item" ? itemValues : eventValues;
      target.set(value.entity_id, [
        ...(target.get(value.entity_id) ?? []),
        mapCustomValue(value),
      ]);
    }
    return {
      schemaVersion: IMPORT_SCHEMA_VERSION,
      appVersion: "0.1.0",
      exportedAt: new Date().toISOString(),
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        visibility: project.visibility,
        publicId: project.public_id,
        publishedAt: project.published_at,
      },
      settings: {
        defaultUncertaintyYears: settings.default_uncertainty_years,
        initialStartYear: settings.initial_start_year,
        initialEndYear: settings.initial_end_year,
        initialZoomPreset: settings.initial_zoom_preset,
        timelineDensity: settings.timeline_density,
        minimumTimeUnit: settings.minimum_time_unit,
      },
      itemTypes: types.map((type) => ({
        id: type.id,
        name: type.name,
        defaultColor: type.default_color,
        icon: type.icon,
        sortOrder: type.sort_order,
        isVisible: type.is_visible,
      })),
      tags: tags.map(({ id, name, color, description }) => ({
        id,
        name,
        color,
        description,
      })),
      eventTypes: eventTypes.map(
        ({ id, name, color, markerShape, description, sortOrder }) => ({
          id,
          name,
          color,
          markerShape,
          description,
          sortOrder,
        }),
      ),
      customFields: customFields.map(
        ({
          id,
          entityType,
          scope,
          targetTypeId,
          name,
          fieldType,
          isRequired,
          options,
          description,
          sortOrder,
        }) => ({
          id,
          entityType,
          scope,
          targetTypeId,
          name,
          fieldType,
          isRequired,
          options,
          description,
          sortOrder,
        }),
      ),
      timelineItems: items.map((item) => ({
        id: item.id,
        typeId: item.type_id,
        title: item.title,
        aliases: item.aliases,
        tagIds: itemTags.get(item.id) ?? [],
        customFields: itemValues.get(item.id) ?? [],
        description: item.description,
        sourceText: item.source_text,
        externalUrl: item.external_url,
        temporalType: item.temporal_type,
        colorOverride: item.color_override,
        manualOrder: item.manual_order,
        isVisible: item.is_visible,
        start: date(
          item.start_year,
          item.start_month,
          item.start_day,
          item.start_era,
          item.start_precision,
          item.start_original_text,
          item.start_calendar,
        ),
        isStartApproximate: item.is_start_approximate,
        startUncertaintyYears: item.start_uncertainty_years,
        endDateStatus: item.end_date_status,
        end: date(
          item.end_year,
          item.end_month,
          item.end_day,
          item.end_era,
          item.end_precision,
          item.end_original_text,
          item.end_calendar,
        ),
        isEndApproximate: item.is_end_approximate,
        endUncertaintyYears: item.end_uncertainty_years,
        lastConfirmed:
          item.end_date_status === "unknown"
            ? date(
                item.end_year,
                item.end_month,
                item.end_day,
                item.end_era,
                item.end_precision,
                item.end_original_text,
                item.end_calendar,
              )
            : null,
        point:
          item.temporal_type === "point"
            ? date(
                item.start_year,
                item.start_month,
                item.start_day,
                item.start_era,
                item.start_precision,
                item.start_original_text,
                item.start_calendar,
              )
            : null,
        isPointApproximate: item.is_point_approximate,
      })),
      timelineEvents: events.map((event) => ({
        id: event.id,
        timelineItemIds: eventParents.get(event.id) ?? [],
        title: event.title,
        aliases: event.aliases,
        eventTypeId: event.event_type_id,
        tagIds: eventTags.get(event.id) ?? [],
        customFields: eventValues.get(event.id) ?? [],
        date: {
          era: event.event_era,
          precision: event.event_precision,
          year: event.event_year,
          month: event.event_month,
          day: event.event_day,
          originalText: event.event_original_text,
          calendar: event.event_calendar,
        },
        isApproximate: event.is_approximate,
        description: event.description,
        sourceText: event.source_text,
        externalUrl: event.external_url,
      })),
    };
  }

  async import(
    projectId: string | null,
    mode: ImportMode,
    payload: ProjectBackup,
  ) {
    const { data, error } = await this.client.rpc("import_project_data", {
      p_target_project_id: projectId,
      p_mode: mode,
      p_payload: payload as unknown as Json,
    });
    if (error) throw error;
    return data;
  }
}
