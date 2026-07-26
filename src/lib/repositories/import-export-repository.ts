import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ProjectBackup,
  ImportMode,
} from "@/features/import-export/schema";
import type { Database, Json } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

const date = (year: number | null, month: number | null, day: number | null) =>
  year === null ? null : { year, month, day };

export class ImportExportRepository {
  constructor(private readonly client: Client) {}

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

  async export(projectId: string): Promise<ProjectBackup | null> {
    const [projectResult, settingsResult, types, items, events] =
      await Promise.all([
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
      ]);
    for (const result of [projectResult, settingsResult])
      if (result.error) throw result.error;
    const project = projectResult.data;
    const settings = settingsResult.data;
    if (!project || !settings) return null;
    return {
      schemaVersion: 1,
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
      timelineItems: items.map((item) => ({
        id: item.id,
        typeId: item.type_id,
        title: item.title,
        description: item.description,
        sourceText: item.source_text,
        externalUrl: item.external_url,
        temporalType: item.temporal_type,
        colorOverride: item.color_override,
        manualOrder: item.manual_order,
        isVisible: item.is_visible,
        start: date(item.start_year, item.start_month, item.start_day),
        isStartApproximate: item.is_start_approximate,
        startUncertaintyYears: item.start_uncertainty_years,
        endDateStatus: item.end_date_status,
        end: date(item.end_year, item.end_month, item.end_day),
        isEndApproximate: item.is_end_approximate,
        endUncertaintyYears: item.end_uncertainty_years,
        lastConfirmed: date(
          item.last_confirmed_year,
          item.last_confirmed_month,
          item.last_confirmed_day,
        ),
        point: date(item.point_year, item.point_month, item.point_day),
        isPointApproximate: item.is_point_approximate,
      })),
      timelineEvents: events.map((event) => ({
        id: event.id,
        timelineItemId: event.timeline_item_id,
        title: event.title,
        date: {
          year: event.event_year,
          month: event.event_month,
          day: event.event_day,
        },
        isApproximate: event.is_approximate,
        description: event.description,
        sourceText: event.source_text,
        externalUrl: event.external_url,
      })),
    };
  }

  async import(projectId: string, mode: ImportMode, payload: ProjectBackup) {
    const { data, error } = await this.client.rpc("import_project_data", {
      p_target_project_id: projectId,
      p_mode: mode,
      p_payload: payload as unknown as Json,
    });
    if (error) throw error;
    return data;
  }
}
