import type { SupabaseClient } from "@supabase/supabase-js";

import type { TimelineItemType } from "@/features/item-types/types";
import type { TimelineEventDraftValues } from "@/features/timeline-events/validation";
import type {
  HistoricalDate,
  TimelineItem,
  TimelineEventCreationFailure,
  TimelineItemSummary,
} from "@/features/timeline-items/types";
import type { TimelineItemValues } from "@/features/timeline-items/validation";
import type { Database, Json } from "@/lib/supabase/database.types";
import { SourceRepository } from "@/lib/repositories/source-repository";
import { ClassificationRepository } from "@/lib/repositories/classification-repository";
import type { Tag } from "@/features/classification/types";

type Client = SupabaseClient<Database>;
type ItemRow = Database["public"]["Tables"]["timeline_items"]["Row"];
type ItemTypeRow = Database["public"]["Tables"]["timeline_item_types"]["Row"];
type TagRow = Database["public"]["Tables"]["tags"]["Row"];
type JoinedRow = ItemRow & {
  timeline_item_types: ItemTypeRow;
  timeline_item_tags?: { tags: TagRow }[];
};

const LIST_COLUMNS = `
  id, project_id, type_id, title, temporal_type, color_override,
  manual_order, is_visible, start_year, start_month, start_day,
  start_era, start_precision, start_original_text, start_calendar,
  is_start_approximate, start_uncertainty_years, end_date_status, end_year,
  end_month, end_day, is_end_approximate, end_uncertainty_years,
  end_era, end_precision, end_original_text, end_calendar,
  is_point_approximate, created_at, updated_at,
  timeline_item_types (*), timeline_item_tags (tags (*))
`;

function mapTag(row: TagRow): Tag {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    color: row.color,
    description: row.description,
    usageCount: 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

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
  era: "ce" | "bce",
  precision: "day" | "month" | "year" | "decade" | "century",
  originalText: string | null,
  calendar: string,
): HistoricalDate | null {
  return year === null
    ? null
    : { era, precision, year, month, day, originalText, calendar };
}

function mapItem(row: JoinedRow): TimelineItem {
  const storedStart = date(
    row.start_year,
    row.start_month,
    row.start_day,
    row.start_era,
    row.start_precision,
    row.start_original_text,
    row.start_calendar,
  );
  const storedEnd = date(
    row.end_year,
    row.end_month,
    row.end_day,
    row.end_era,
    row.end_precision,
    row.end_original_text,
    row.end_calendar,
  );
  const isRange = row.temporal_type === "range";
  return {
    id: row.id,
    projectId: row.project_id,
    typeId: row.type_id,
    itemType: mapItemType(row.timeline_item_types),
    title: row.title,
    aliases: row.aliases,
    tags: (row.timeline_item_tags ?? []).map((entry) => mapTag(entry.tags)),
    customFields: [],
    description: row.description,
    sourceText: row.source_text,
    externalUrl: row.external_url,
    temporalType: row.temporal_type,
    colorOverride: row.color_override,
    manualOrder: row.manual_order,
    isVisible: row.is_visible,
    start: isRange ? storedStart : null,
    isStartApproximate: row.is_start_approximate,
    startUncertaintyYears: row.start_uncertainty_years,
    endDateStatus: row.end_date_status,
    end: row.end_date_status === "specified" ? storedEnd : null,
    isEndApproximate: row.is_end_approximate,
    endUncertaintyYears: row.end_uncertainty_years,
    lastConfirmed: row.end_date_status === "unknown" ? storedEnd : null,
    point: isRange ? null : storedStart,
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
    [`${prefix}_era`]: value?.era ?? "ce",
    [`${prefix}_precision`]: value?.precision ?? "year",
    [`${prefix}_original_text`]: value?.originalText ?? null,
    [`${prefix}_calendar`]: value?.calendar ?? "proleptic_gregorian",
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
    aliases: input.aliases,
    description: input.description,
    source_text: input.sourceText,
    external_url: input.externalUrl,
    temporal_type: input.temporalType,
    color_override: input.colorOverride,
    is_visible: input.isVisible,
    ...dateFields("start", isRange ? input.start : input.point),
    is_start_approximate: isRange && input.isStartApproximate,
    start_uncertainty_years: null,
    end_date_status: isRange ? input.endDateStatus : null,
    ...dateFields(
      "end",
      isSpecified ? input.end : isUnknown ? input.lastConfirmed : null,
    ),
    is_end_approximate: isSpecified && input.isEndApproximate,
    end_uncertainty_years: null,
    is_point_approximate: !isRange && input.isPointApproximate,
  };
}

function eventPersistenceValues(input: TimelineEventDraftValues) {
  return {
    title: input.title,
    event_year: input.date.year,
    event_month: input.date.month,
    event_day: input.date.day,
    event_era: input.date.era,
    event_precision: input.date.precision,
    event_original_text: input.date.originalText,
    event_calendar: input.date.calendar,
    is_approximate: input.isApproximate,
    description: input.description,
    source_text: input.sourceText,
    external_url: input.externalUrl,
  };
}

function parseFailures(value: Json): TimelineEventCreationFailure[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((failure) => {
    if (
      typeof failure !== "object" ||
      failure === null ||
      Array.isArray(failure) ||
      typeof failure.title !== "string" ||
      typeof failure.reason !== "string"
    ) {
      return [];
    }
    return [{ title: failure.title, reason: failure.reason }];
  });
}

export class TimelineItemRepository {
  private readonly sources: SourceRepository;
  private readonly classification: ClassificationRepository;

  constructor(private readonly client: Client) {
    this.sources = new SourceRepository(client);
    this.classification = new ClassificationRepository(client);
  }

  async list(projectId: string): Promise<TimelineItemSummary[]> {
    const { data, error } = await this.client
      .from("timeline_items")
      .select(LIST_COLUMNS)
      .eq("project_id", projectId)
      .is("deleted_at", null)
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
      .select("*, timeline_item_types (*), timeline_item_tags (tags (*))")
      .eq("project_id", projectId)
      .eq("id", itemId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      ...mapItem(data as unknown as JoinedRow),
      customFields: await this.classification.listValues(
        projectId,
        "timeline_item",
        itemId,
      ),
      citations: await this.sources.listForEntity(
        projectId,
        "timeline_item",
        itemId,
      ),
    };
  }

  async create(projectId: string, input: TimelineItemValues) {
    const { data: last, error: orderError } = await this.client
      .from("timeline_items")
      .select("manual_order")
      .eq("project_id", projectId)
      .is("deleted_at", null)
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
      .select("*, timeline_item_types (*), timeline_item_tags (tags (*))")
      .single();
    if (error) throw error;
    return mapItem(data as unknown as JoinedRow);
  }

  async createWithEvents(
    projectId: string,
    input: TimelineItemValues,
    events: TimelineEventDraftValues[],
  ) {
    const itemValues = persistenceValues(input);
    const { data, error } = await this.client.rpc(
      "create_timeline_item_with_events",
      {
        p_project_id: projectId,
        p_item: {
          ...itemValues,
          type_id: input.typeId,
          title: input.title,
          temporal_type: input.temporalType,
        } as Json,
        p_events: events.map(eventPersistenceValues) as Json,
      },
    );
    if (error) throw error;
    const result = data[0];
    if (!result) throw new Error("Timeline item batch result is missing.");
    await this.sources.replaceForEntity(
      projectId,
      "timeline_item",
      result.item_id,
      input.citations,
    );
    const item = await this.findById(projectId, result.item_id);
    if (!item) throw new Error("Created timeline item could not be loaded.");
    return {
      item,
      createdEventIds: result.created_event_ids,
      failedEvents: parseFailures(result.failed_events),
    };
  }

  async update(
    projectId: string,
    itemId: string,
    input: TimelineItemValues,
    expectedUpdatedAt: string,
  ) {
    const { data, error } = await this.client
      .from("timeline_items")
      .update(persistenceValues(input))
      .eq("project_id", projectId)
      .eq("id", itemId)
      .eq("updated_at", expectedUpdatedAt)
      .is("deleted_at", null)
      .select("*, timeline_item_types (*), timeline_item_tags (tags (*))")
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    await this.sources.replaceForEntity(
      projectId,
      "timeline_item",
      itemId,
      input.citations,
    );
    return {
      ...mapItem(data as unknown as JoinedRow),
      citations: await this.sources.listForEntity(
        projectId,
        "timeline_item",
        itemId,
      ),
    };
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
    const { data, error } = await this.client.rpc("trash_timeline_item", {
      p_project_id: projectId,
      p_item_id: itemId,
    });
    if (error) throw error;
    return data;
  }
}
