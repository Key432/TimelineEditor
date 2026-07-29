import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  TimelineEvent,
  TimelineEventParent,
  TimelineEventSummary,
} from "@/features/timeline-events/types";
import type { TimelineEventValues } from "@/features/timeline-events/validation";
import type { Database } from "@/lib/supabase/database.types";
import { SourceRepository } from "@/lib/repositories/source-repository";
import { ClassificationRepository } from "@/lib/repositories/classification-repository";
import type { EventType, Tag } from "@/features/classification/types";

type Client = SupabaseClient<Database>;
type EventRow = Database["public"]["Tables"]["timeline_events"]["Row"];
type ParentRow = Pick<
  Database["public"]["Tables"]["timeline_items"]["Row"],
  | "id"
  | "title"
  | "start_year"
  | "start_month"
  | "start_day"
  | "start_era"
  | "start_precision"
  | "start_original_text"
  | "start_calendar"
  | "end_date_status"
  | "end_year"
  | "end_month"
  | "end_day"
  | "end_era"
  | "end_precision"
  | "end_original_text"
  | "end_calendar"
>;
type EventTypeRow = Database["public"]["Tables"]["event_types"]["Row"];
type TagRow = Database["public"]["Tables"]["tags"]["Row"];
type JoinedRow = EventRow & {
  timeline_event_item_links?: {
    sort_order: number;
    timeline_item_id?: string;
    timeline_items: ParentRow;
  }[];
  event_types: EventTypeRow | null;
  timeline_event_tags?: { tags: TagRow }[];
};

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
function mapEventType(row: EventTypeRow | null): EventType | null {
  return row
    ? {
        id: row.id,
        projectId: row.project_id,
        name: row.name,
        color: row.color,
        markerShape: row.marker_shape,
        description: row.description,
        sortOrder: row.sort_order,
        usageCount: 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    : null;
}

function parentDate(
  year: number | null,
  month: number | null,
  day: number | null,
  era: "ce" | "bce",
  precision: "day" | "month" | "year" | "decade" | "century",
  originalText: string | null,
  calendar: string,
) {
  return year === null
    ? null
    : { era, precision, year, month, day, originalText, calendar };
}

function mapParent(row: ParentRow, sortOrder: number): TimelineEventParent {
  const start = parentDate(
    row.start_year,
    row.start_month,
    row.start_day,
    row.start_era,
    row.start_precision,
    row.start_original_text,
    row.start_calendar,
  );
  if (!start || !row.end_date_status) {
    throw new Error("Timeline event parent must be a range item.");
  }
  return {
    id: row.id,
    title: row.title,
    start,
    endDateStatus: row.end_date_status,
    end: parentDate(
      row.end_year,
      row.end_month,
      row.end_day,
      row.end_era,
      row.end_precision,
      row.end_original_text,
      row.end_calendar,
    ),
    lastConfirmed:
      row.end_date_status === "unknown"
        ? parentDate(
            row.end_year,
            row.end_month,
            row.end_day,
            row.end_era,
            row.end_precision,
            row.end_original_text,
            row.end_calendar,
          )
        : null,
    sortOrder,
  };
}

function mapEvent(row: JoinedRow): TimelineEvent {
  return {
    id: row.id,
    projectId: row.project_id,
    timelineItemIds: (row.timeline_event_item_links ?? [])
      .sort((left, right) => left.sort_order - right.sort_order)
      .map((link) => link.timeline_items.id),
    eventTypeId: row.event_type_id,
    eventType: mapEventType(row.event_types),
    tags: (row.timeline_event_tags ?? []).map((entry) => mapTag(entry.tags)),
    customFields: [],
    title: row.title,
    aliases: row.aliases,
    date: {
      era: row.event_era,
      precision: row.event_precision,
      year: row.event_year,
      month: row.event_month,
      day: row.event_day,
      originalText: row.event_original_text,
      calendar: row.event_calendar,
    },
    isApproximate: row.is_approximate,
    description: row.description,
    sourceText: row.source_text,
    externalUrl: row.external_url,
    parents: (row.timeline_event_item_links ?? [])
      .sort((left, right) => left.sort_order - right.sort_order)
      .map((link) => mapParent(link.timeline_items, link.sort_order)),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function persistenceValues(input: TimelineEventValues) {
  return {
    event_type_id: input.eventTypeId,
    title: input.title,
    aliases: input.aliases,
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

const DETAIL_COLUMNS = `
  *, event_types (*), timeline_event_tags (tags (*)),
  timeline_event_item_links (
    sort_order, timeline_items (
      id, title, start_year, start_month, start_day, end_date_status,
      start_era, start_precision, start_original_text, start_calendar,
      end_year, end_month, end_day, end_era, end_precision,
      end_original_text, end_calendar
    )
  )
`;

export class TimelineEventRepository {
  private readonly sources: SourceRepository;
  private readonly classification: ClassificationRepository;

  constructor(private readonly client: Client) {
    this.sources = new SourceRepository(client);
    this.classification = new ClassificationRepository(client);
  }

  async list(projectId: string): Promise<TimelineEventSummary[]> {
    const { data, error } = await this.client
      .from("timeline_events")
      .select(
        "id, project_id, event_type_id, title, event_year, event_month, event_day, event_era, event_precision, event_original_text, event_calendar, is_approximate, created_at, updated_at, event_types (*), timeline_event_tags (tags (*)), timeline_event_item_links (sort_order, timeline_item_id)",
      )
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("event_year")
      .order("event_month")
      .order("event_day")
      .order("id");
    if (error) throw error;
    return (data as unknown as JoinedRow[]).map((row) => ({
      id: row.id,
      projectId: row.project_id,
      timelineItemIds: (row.timeline_event_item_links ?? [])
        .sort((left, right) => left.sort_order - right.sort_order)
        .flatMap((link) =>
          link.timeline_item_id ? [link.timeline_item_id] : [],
        ),
      eventTypeId: row.event_type_id,
      eventType: mapEventType(row.event_types),
      tags: (row.timeline_event_tags ?? []).map((entry) => mapTag(entry.tags)),
      title: row.title,
      date: {
        era: row.event_era,
        precision: row.event_precision,
        year: row.event_year,
        month: row.event_month,
        day: row.event_day,
        originalText: row.event_original_text,
        calendar: row.event_calendar,
      },
      isApproximate: row.is_approximate,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async findById(projectId: string, eventId: string) {
    const { data, error } = await this.client
      .from("timeline_events")
      .select(DETAIL_COLUMNS)
      .eq("project_id", projectId)
      .eq("id", eventId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      ...mapEvent(data as unknown as JoinedRow),
      customFields: await this.classification.listValues(
        projectId,
        "timeline_event",
        eventId,
      ),
      citations: await this.sources.listForEntity(
        projectId,
        "timeline_event",
        eventId,
      ),
    };
  }

  async create(projectId: string, input: TimelineEventValues) {
    const { data, error } = await this.client
      .from("timeline_events")
      .insert({
        project_id: projectId,
        timeline_item_id: input.timelineItemIds[0]!,
        ...persistenceValues(input),
      })
      .select("id")
      .single();
    if (error) throw error;
    await this.replaceParents(projectId, data.id, input.timelineItemIds);
    await this.sources.replaceForEntity(
      projectId,
      "timeline_event",
      data.id,
      input.citations,
    );
    return (await this.findById(projectId, data.id))!;
  }

  async update(
    projectId: string,
    eventId: string,
    input: TimelineEventValues,
    expectedUpdatedAt: string,
  ) {
    const { data, error } = await this.client
      .from("timeline_events")
      .update(persistenceValues(input))
      .eq("project_id", projectId)
      .eq("id", eventId)
      .eq("updated_at", expectedUpdatedAt)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    await this.replaceParents(projectId, eventId, input.timelineItemIds);
    await this.sources.replaceForEntity(
      projectId,
      "timeline_event",
      eventId,
      input.citations,
    );
    return this.findById(projectId, eventId);
  }

  private async replaceParents(
    projectId: string,
    eventId: string,
    timelineItemIds: string[],
  ) {
    const { error } = await this.client.rpc("replace_timeline_event_parents", {
      p_project_id: projectId,
      p_event_id: eventId,
      p_timeline_item_ids: timelineItemIds,
    });
    if (error) throw error;
  }

  async delete(projectId: string, eventId: string) {
    const { data, error } = await this.client.rpc("trash_timeline_event", {
      p_project_id: projectId,
      p_event_id: eventId,
    });
    if (error) throw error;
    return data;
  }
}
