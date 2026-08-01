import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  TimelineBackgroundLayer,
  TimelineBackgroundPeriod,
} from "@/features/background-layers/types";
import type { Database } from "@/lib/supabase/database.types";
import type { z } from "zod";
import type {
  backgroundPeriodSchema,
  createBackgroundLayerSchema,
  updateBackgroundLayerSchema,
} from "@/features/background-layers/validation";

type LayerRow =
  Database["public"]["Tables"]["timeline_background_layers"]["Row"];
type PeriodRow =
  Database["public"]["Tables"]["timeline_background_periods"]["Row"];

function mapPeriod(row: PeriodRow): TimelineBackgroundPeriod {
  return {
    id: row.id,
    projectId: row.project_id,
    layerId: row.layer_id,
    title: row.title,
    description: row.description,
    color: row.color,
    start: {
      era: row.start_era,
      precision: row.start_precision,
      year: row.start_year,
      month: row.start_month,
      day: row.start_day,
      originalText: row.start_original_text,
      calendar: row.start_calendar,
    },
    end: {
      era: row.end_era,
      precision: row.end_precision,
      year: row.end_year,
      month: row.end_month,
      day: row.end_day,
      originalText: row.end_original_text,
      calendar: row.end_calendar,
    },
    isStartApproximate: row.is_start_approximate,
    isEndApproximate: row.is_end_approximate,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLayer(
  row: LayerRow,
  periods: PeriodRow[],
): TimelineBackgroundLayer {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    isVisible: row.is_visible,
    periods: periods
      .filter((period) => period.layer_id === row.id)
      .map(mapPeriod),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function periodValues(
  projectId: string,
  layerId: string,
  input: z.output<typeof backgroundPeriodSchema>,
) {
  return {
    project_id: projectId,
    layer_id: layerId,
    title: input.title,
    description: input.description,
    color: input.color,
    start_era: input.start.era,
    start_precision: input.start.precision,
    start_year: input.start.year,
    start_month: input.start.month,
    start_day: input.start.day,
    start_original_text: input.start.originalText,
    start_calendar: input.start.calendar,
    is_start_approximate: input.isStartApproximate,
    end_era: input.end.era,
    end_precision: input.end.precision,
    end_year: input.end.year,
    end_month: input.end.month,
    end_day: input.end.day,
    end_original_text: input.end.originalText,
    end_calendar: input.end.calendar,
    is_end_approximate: input.isEndApproximate,
  };
}

export class BackgroundLayerRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async list(projectId: string) {
    const [layersResult, periodsResult] = await Promise.all([
      this.client
        .from("timeline_background_layers")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order")
        .order("id"),
      this.client
        .from("timeline_background_periods")
        .select("*")
        .eq("project_id", projectId)
        .order("start_normalized_min")
        .order("id"),
    ]);
    if (layersResult.error) throw layersResult.error;
    if (periodsResult.error) throw periodsResult.error;
    return layersResult.data.map((layer) =>
      mapLayer(layer, periodsResult.data),
    );
  }

  async findLayer(projectId: string, layerId: string) {
    return (
      (await this.list(projectId)).find((layer) => layer.id === layerId) ?? null
    );
  }

  async createLayer(
    projectId: string,
    input: z.output<typeof createBackgroundLayerSchema>,
  ) {
    const existing = await this.list(projectId);
    const { data, error } = await this.client
      .from("timeline_background_layers")
      .insert({
        project_id: projectId,
        name: input.name,
        description: input.description,
        is_visible: input.isVisible,
        sort_order: existing.length,
      })
      .select("*")
      .single();
    if (error) throw error;
    return mapLayer(data, []);
  }

  async updateLayer(
    projectId: string,
    layerId: string,
    input: z.output<typeof updateBackgroundLayerSchema>,
  ) {
    const values: Database["public"]["Tables"]["timeline_background_layers"]["Update"] =
      {};
    if (input.name !== undefined) values.name = input.name;
    if (input.description !== undefined) values.description = input.description;
    if (input.isVisible !== undefined) values.is_visible = input.isVisible;
    if (input.sortOrder !== undefined) {
      const layers = await this.list(projectId);
      const current = layers.find((layer) => layer.id === layerId);
      const target = layers[input.sortOrder];
      if (current && target && target.id !== current.id) {
        const targetResult = await this.client
          .from("timeline_background_layers")
          .update({ sort_order: current.sortOrder })
          .eq("project_id", projectId)
          .eq("id", target.id);
        if (targetResult.error) throw targetResult.error;
      }
      values.sort_order = input.sortOrder;
    }
    const { data, error } = await this.client
      .from("timeline_background_layers")
      .update(values)
      .eq("project_id", projectId)
      .eq("id", layerId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data ? this.findLayer(projectId, layerId) : null;
  }

  async deleteLayer(projectId: string, layerId: string) {
    const { data, error } = await this.client
      .from("timeline_background_layers")
      .delete()
      .eq("project_id", projectId)
      .eq("id", layerId)
      .select("id");
    if (error) throw error;
    return data.length === 1;
  }

  async createPeriod(
    projectId: string,
    layerId: string,
    input: z.output<typeof backgroundPeriodSchema>,
  ) {
    const { error } = await this.client
      .from("timeline_background_periods")
      .insert(periodValues(projectId, layerId, input));
    if (error) throw error;
  }

  async updatePeriod(
    projectId: string,
    layerId: string,
    periodId: string,
    input: z.output<typeof backgroundPeriodSchema>,
  ) {
    const { data, error } = await this.client
      .from("timeline_background_periods")
      .update(periodValues(projectId, layerId, input))
      .eq("project_id", projectId)
      .eq("layer_id", layerId)
      .eq("id", periodId)
      .select("id");
    if (error) throw error;
    return data.length === 1;
  }

  async deletePeriod(projectId: string, layerId: string, periodId: string) {
    const { data, error } = await this.client
      .from("timeline_background_periods")
      .delete()
      .eq("project_id", projectId)
      .eq("layer_id", layerId)
      .eq("id", periodId)
      .select("id");
    if (error) throw error;
    return data.length === 1;
  }
}
