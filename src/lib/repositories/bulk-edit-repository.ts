import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/lib/supabase/database.types";

export class BulkEditRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async dependencyCounts(
    projectId: string,
    entityType: "timeline_item" | "timeline_event",
    ids: string[],
  ) {
    if (entityType === "timeline_event")
      return { selected: ids.length, references: 0 };
    const { count, error } = await this.client
      .from("timeline_event_item_links")
      .select("timeline_event_id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .in("timeline_item_id", ids);
    if (error) throw error;
    return { selected: ids.length, references: count ?? 0 };
  }

  async record(input: {
    projectId: string;
    ownerId: string;
    entityType: "timeline_item" | "timeline_event";
    label: string;
    inversePatch: Json;
    affectedCount: number;
  }) {
    const { data, error } = await this.client
      .from("bulk_edit_operations")
      .insert({
        project_id: input.projectId,
        owner_id: input.ownerId,
        entity_type: input.entityType,
        label: input.label,
        inverse_patch: input.inversePatch,
        affected_count: input.affectedCount,
      })
      .select("id, label, affected_count, created_at")
      .single();
    if (error) throw error;
    return data;
  }

  async find(projectId: string, operationId: string) {
    const { data, error } = await this.client
      .from("bulk_edit_operations")
      .select("*")
      .eq("project_id", projectId)
      .eq("id", operationId)
      .is("undone_at", null)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async markUndone(projectId: string, operationId: string) {
    const { error } = await this.client
      .from("bulk_edit_operations")
      .update({ undone_at: new Date().toISOString() })
      .eq("project_id", projectId)
      .eq("id", operationId);
    if (error) throw error;
  }
}
