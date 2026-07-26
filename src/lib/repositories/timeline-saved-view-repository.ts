import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  TimelineSavedView,
  TimelineViewConfiguration,
} from "@/features/timeline-views/types";
import type { Database } from "@/lib/supabase/database.types";

type Row = Database["public"]["Tables"]["timeline_saved_views"]["Row"];

function mapRow(row: Row): TimelineSavedView {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    configuration: row.configuration as TimelineViewConfiguration,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class TimelineSavedViewRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async list(projectId: string) {
    const { data, error } = await this.client
      .from("timeline_saved_views")
      .select("*")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data.map(mapRow);
  }

  async create(
    projectId: string,
    name: string,
    configuration: TimelineViewConfiguration,
  ) {
    const { data, error } = await this.client
      .from("timeline_saved_views")
      .insert({ project_id: projectId, name, configuration })
      .select("*")
      .single();
    if (error) throw error;
    return mapRow(data);
  }

  async update(
    projectId: string,
    viewId: string,
    values: { name?: string; configuration?: TimelineViewConfiguration },
  ) {
    const { data, error } = await this.client
      .from("timeline_saved_views")
      .update(values)
      .eq("project_id", projectId)
      .eq("id", viewId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data ? mapRow(data) : null;
  }

  async delete(projectId: string, viewId: string) {
    const { data, error } = await this.client
      .from("timeline_saved_views")
      .delete()
      .eq("project_id", projectId)
      .eq("id", viewId)
      .select("id");
    if (error) throw error;
    return data.length === 1;
  }
}
