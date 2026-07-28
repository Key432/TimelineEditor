import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  InternalLinkCandidate,
  InternalLinkEntityType,
  ResolvedInternalLink,
} from "@/features/internal-links/types";
import type { Database } from "@/lib/supabase/database.types";

export class InternalLinkRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async candidates(projectId: string, query: string) {
    const { data, error } = await this.client.rpc(
      "get_internal_link_candidates",
      { p_project_id: projectId, p_query: query },
    );
    if (error) throw error;
    return data.map((row): InternalLinkCandidate => ({
      entityType: row.entity_type,
      entityId: row.entity_id,
      title: row.title,
      aliases: row.aliases,
      kindLabel: row.kind_label,
      dateLabel: row.date_label,
      parentTitle: row.parent_title,
    }));
  }

  async resolve(projectId: string, itemIds: string[], eventIds: string[]) {
    const { data, error } = await this.client.rpc("resolve_internal_links", {
      p_project_id: projectId,
      p_item_ids: itemIds,
      p_event_ids: eventIds,
    });
    if (error) throw error;
    return data.map((row): ResolvedInternalLink => ({
      entityType: row.entity_type,
      entityId: row.entity_id,
      title: row.title,
    }));
  }

  async referenceCount(
    projectId: string,
    entityType: InternalLinkEntityType,
    entityId: string,
  ) {
    const { count, error } = await this.client
      .from("internal_links")
      .select("source_entity_id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq(
        "target_entity_type",
        entityType === "item" ? "timeline_item" : "timeline_event",
      )
      .eq("target_entity_id", entityId);
    if (error) throw error;
    return count ?? 0;
  }
}
