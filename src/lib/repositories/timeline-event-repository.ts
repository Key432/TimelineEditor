import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  TimelineEvent,
  TimelineEventParent,
  TimelineEventSummary,
} from "@/features/timeline-events/types";
import type { TimelineEventValues } from "@/features/timeline-events/validation";
import type { Database } from "@/lib/supabase/database.types";

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
type JoinedRow = EventRow & { timeline_items: ParentRow };

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

function mapParent(row: ParentRow): TimelineEventParent {
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
  };
}

function mapEvent(row: JoinedRow): TimelineEvent {
  return {
    id: row.id,
    projectId: row.project_id,
    timelineItemId: row.timeline_item_id,
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
    description: row.description,
    sourceText: row.source_text,
    externalUrl: row.external_url,
    parent: mapParent(row.timeline_items),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function persistenceValues(input: TimelineEventValues) {
  return {
    timeline_item_id: input.timelineItemId,
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

const DETAIL_COLUMNS = `
  *, timeline_items (
    id, title, start_year, start_month, start_day, end_date_status,
    start_era, start_precision, start_original_text, start_calendar,
    end_year, end_month, end_day, end_era, end_precision,
    end_original_text, end_calendar
  )
`;

export class TimelineEventRepository {
  constructor(private readonly client: Client) {}

  async list(projectId: string): Promise<TimelineEventSummary[]> {
    const { data, error } = await this.client
      .from("timeline_events")
      .select(
        "id, project_id, timeline_item_id, title, event_year, event_month, event_day, event_era, event_precision, event_original_text, event_calendar, is_approximate, created_at, updated_at",
      )
      .eq("project_id", projectId)
      .order("event_year")
      .order("event_month")
      .order("event_day")
      .order("id");
    if (error) throw error;
    return data.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      timelineItemId: row.timeline_item_id,
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
      .maybeSingle();
    if (error) throw error;
    return data ? mapEvent(data as unknown as JoinedRow) : null;
  }

  async create(projectId: string, input: TimelineEventValues) {
    const { data, error } = await this.client
      .from("timeline_events")
      .insert({ project_id: projectId, ...persistenceValues(input) })
      .select(DETAIL_COLUMNS)
      .single();
    if (error) throw error;
    return mapEvent(data as unknown as JoinedRow);
  }

  async update(projectId: string, eventId: string, input: TimelineEventValues) {
    const { data, error } = await this.client
      .from("timeline_events")
      .update(persistenceValues(input))
      .eq("project_id", projectId)
      .eq("id", eventId)
      .select(DETAIL_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    return data ? mapEvent(data as unknown as JoinedRow) : null;
  }

  async delete(projectId: string, eventId: string) {
    const { data, error } = await this.client
      .from("timeline_events")
      .delete()
      .eq("project_id", projectId)
      .eq("id", eventId)
      .select("id");
    if (error) throw error;
    return data.length === 1;
  }
}
