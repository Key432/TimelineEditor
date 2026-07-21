import type { SupabaseClient } from "@supabase/supabase-js";

import type { TimelineItemType } from "@/features/item-types/types";
import type {
  HistoricalDate,
  TimelineItem,
  TimelineItemSummary,
} from "@/features/timeline-items/types";
import type { TimelineItemValues } from "@/features/timeline-items/validation";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type ItemRow = Database["public"]["Tables"]["timeline_items"]["Row"];
type ItemTypeRow = Database["public"]["Tables"]["timeline_item_types"]["Row"];
type JoinedRow = ItemRow & { timeline_item_types: ItemTypeRow };

const LIST_COLUMNS = `
  id, project_id, type_id, title, temporal_type, color_override,
  manual_order, is_visible, start_year, start_month, start_day,
  is_start_approximate, start_uncertainty_years, end_date_status, end_year,
  end_month, end_day, is_end_approximate, end_uncertainty_years,
  last_confirmed_year, last_confirmed_month, last_confirmed_day, point_year,
  point_month, point_day, is_point_approximate, created_at, updated_at,
  timeline_item_types (*)
`;

function mapItemType(row: ItemTypeRow): TimelineItemType {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    defaultColor: row.default_color,
    icon: row.icon,
    sortOrder: row.sort_order,
    isVisible: row.is_visible,
    isSystemSeed: row.is_system_seed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function date(
  year: number | null,
  month: number | null,
  day: number | null,
): HistoricalDate | null {
  return year === null ? null : { year, month, day };
}

function mapItem(row: JoinedRow): TimelineItem {
  return {
    id: row.id,
    projectId: row.project_id,
    typeId: row.type_id,
    itemType: mapItemType(row.timeline_item_types),
    title: row.title,
    description: row.description,
    sourceText: row.source_text,
    externalUrl: row.external_url,
    temporalType: row.temporal_type,
    colorOverride: row.color_override,
    manualOrder: row.manual_order,
    isVisible: row.is_visible,
    start: date(row.start_year, row.start_month, row.start_day),
    isStartApproximate: row.is_start_approximate,
    startUncertaintyYears: row.start_uncertainty_years,
    endDateStatus: row.end_date_status,
    end: date(row.end_year, row.end_month, row.end_day),
    isEndApproximate: row.is_end_approximate,
    endUncertaintyYears: row.end_uncertainty_years,
    lastConfirmed: date(
      row.last_confirmed_year,
      row.last_confirmed_month,
      row.last_confirmed_day,
    ),
    point: date(row.point_year, row.point_month, row.point_day),
    isPointApproximate: row.is_point_approximate,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function dateFields(prefix: string, value: HistoricalDate | null) {
  return {
    [`${prefix}_year`]: value?.year ?? null,
    [`${prefix}_month`]: value?.month ?? null,
    [`${prefix}_day`]: value?.day ?? null,
  };
}

function persistenceValues(
  input: TimelineItemValues,
): Database["public"]["Tables"]["timeline_items"]["Update"] {
  const isRange = input.temporalType === "range";
  const isSpecified = isRange && input.endDateStatus === "specified";
  const isUnknown = isRange && input.endDateStatus === "unknown";

  return {
    type_id: input.typeId,
    title: input.title,
    description: input.description,
    source_text: input.sourceText,
    external_url: input.externalUrl,
    temporal_type: input.temporalType,
    color_override: input.colorOverride,
    is_visible: input.isVisible,
    ...dateFields("start", isRange ? input.start : null),
    is_start_approximate: isRange && input.isStartApproximate,
    start_uncertainty_years: null,
    end_date_status: isRange ? input.endDateStatus : null,
    ...dateFields("end", isSpecified ? input.end : null),
    is_end_approximate: isSpecified && input.isEndApproximate,
    end_uncertainty_years: null,
    ...dateFields("last_confirmed", isUnknown ? input.lastConfirmed : null),
    ...dateFields("point", isRange ? null : input.point),
    is_point_approximate: !isRange && input.isPointApproximate,
  };
}

export class TimelineItemRepository {
  constructor(private readonly client: Client) {}

  async list(projectId: string): Promise<TimelineItemSummary[]> {
    const { data, error } = await this.client
      .from("timeline_items")
      .select(LIST_COLUMNS)
      .eq("project_id", projectId)
      .order("manual_order")
      .order("id");
    if (error) throw error;
    return (data as unknown as JoinedRow[]).map((row) =>
      mapItem({
        ...row,
        description: null,
        source_text: null,
        external_url: null,
      }),
    );
  }

  async findById(
    projectId: string,
    itemId: string,
  ): Promise<TimelineItem | null> {
    const { data, error } = await this.client
      .from("timeline_items")
      .select("*, timeline_item_types (*)")
      .eq("project_id", projectId)
      .eq("id", itemId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapItem(data as unknown as JoinedRow) : null;
  }

  async create(projectId: string, input: TimelineItemValues) {
    const { data: last, error: orderError } = await this.client
      .from("timeline_items")
      .select("manual_order")
      .eq("project_id", projectId)
      .order("manual_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (orderError) throw orderError;

    const values = persistenceValues(input);
    const { data, error } = await this.client
      .from("timeline_items")
      .insert({
        ...(values as Database["public"]["Tables"]["timeline_items"]["Insert"]),
        project_id: projectId,
        type_id: input.typeId,
        title: input.title,
        temporal_type: input.temporalType,
        manual_order: (last?.manual_order ?? -1) + 1,
      })
      .select("*, timeline_item_types (*)")
      .single();
    if (error) throw error;
    return mapItem(data as unknown as JoinedRow);
  }

  async update(projectId: string, itemId: string, input: TimelineItemValues) {
    const { data, error } = await this.client
      .from("timeline_items")
      .update(persistenceValues(input))
      .eq("project_id", projectId)
      .eq("id", itemId)
      .select("*, timeline_item_types (*)")
      .maybeSingle();
    if (error) throw error;
    return data ? mapItem(data as unknown as JoinedRow) : null;
  }

  async move(
    projectId: string,
    itemId: string,
    manualOrder: number,
    typeId?: string,
  ) {
    const { error } = await this.client.rpc("move_timeline_item", {
      p_project_id: projectId,
      p_item_id: itemId,
      p_new_position: manualOrder,
      p_new_type_id: typeId ?? null,
    });
    if (error) throw error;
  }

  async delete(projectId: string, itemId: string) {
    const { data, error } = await this.client
      .from("timeline_items")
      .delete()
      .eq("project_id", projectId)
      .eq("id", itemId)
      .select("id");
    if (error) throw error;
    return data.length === 1;
  }
}
