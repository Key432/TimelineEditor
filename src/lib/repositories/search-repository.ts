import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  SearchEntityType,
  SearchResult,
  TimelineSearchMatches,
} from "@/features/search/types";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type GlobalRow =
  Database["public"]["Functions"]["search_global_documents"]["Returns"][number];

function date(year: number | null, month: number | null, day: number | null) {
  return year === null ? null : { year, month, day };
}

export function searchExcerpt(content: string, query: string) {
  const normalized = content.replace(/\s+/g, " ").trim();
  const terms = query
    .trim()
    .split(/\s+/)
    .map((term) => term.toLocaleLowerCase("ja"))
    .filter(Boolean);
  const lower = normalized.toLocaleLowerCase("ja");
  const indexes = terms
    .map((term) => lower.indexOf(term))
    .filter((index) => index >= 0);
  const match = indexes.length > 0 ? Math.min(...indexes) : 0;
  const start = Math.max(0, match - 55);
  const end = Math.min(normalized.length, match + 125);
  return `${start > 0 ? "…" : ""}${normalized.slice(start, end)}${end < normalized.length ? "…" : ""}`;
}

function mapResult(row: GlobalRow, query: string): SearchResult {
  return {
    entityType: row.entity_type as SearchEntityType,
    entityId: row.entity_id,
    projectId: row.project_id,
    title: row.title,
    projectName: row.project_name,
    excerpt: searchExcerpt(row.content, query),
    detailPath: row.detail_path,
    start: date(row.start_year, row.start_month, row.start_day),
    end: date(row.end_year, row.end_month, row.end_day),
    endDateStatus: row.end_date_status,
    isStartApproximate: row.is_start_approximate,
    isEndApproximate: row.is_end_approximate,
  };
}

export class SearchRepository {
  constructor(private readonly client: Client) {}

  async global(input: {
    query: string;
    entityType?: SearchEntityType;
    page: number;
    pageSize: number;
  }) {
    const { data, error } = await this.client.rpc("search_global_documents", {
      p_query: input.query,
      p_entity_type: input.entityType ?? null,
      p_page: input.page,
      p_page_size: input.pageSize,
    });
    if (error) throw error;
    return {
      results: data.map((row) => mapResult(row, input.query)),
      total: Number(data[0]?.total_count ?? 0),
    };
  }

  async timeline(
    projectId: string,
    query: string,
  ): Promise<TimelineSearchMatches> {
    const { data, error } = await this.client.rpc(
      "match_project_search_documents",
      { p_project_id: projectId, p_query: query },
    );
    if (error) throw error;
    return {
      itemIds: data
        .filter((row) => row.entity_type === "timeline_item")
        .map((row) => row.entity_id),
      eventIds: data
        .filter((row) => row.entity_type === "timeline_event")
        .map((row) => row.entity_id),
    };
  }
}
