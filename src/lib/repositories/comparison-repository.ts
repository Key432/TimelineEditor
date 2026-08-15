import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ComparisonProjectOption,
  ComparisonSavedView,
  ComparisonViewConfiguration,
} from "@/features/comparison/types";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type SavedViewRow =
  Database["public"]["Tables"]["comparison_saved_views"]["Row"];

function mapSavedView(row: SavedViewRow): ComparisonSavedView {
  return {
    id: row.id,
    name: row.name,
    configuration: row.configuration as ComparisonViewConfiguration,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ComparisonRepository {
  constructor(private readonly client: Client) {}

  async listProjects(userId: string): Promise<ComparisonProjectOption[]> {
    const { data, error } = await this.client
      .from("projects")
      .select("id, owner_id, name, description, public_id")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      publicId: row.public_id,
      access: row.owner_id === userId ? "owned" : "public",
    }));
  }

  async listSavedViews() {
    const { data, error } = await this.client
      .from("comparison_saved_views")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data.map(mapSavedView);
  }

  async createSavedView(
    ownerId: string,
    name: string,
    configuration: ComparisonViewConfiguration,
  ) {
    const { data, error } = await this.client
      .from("comparison_saved_views")
      .insert({ owner_id: ownerId, name, configuration })
      .select("*")
      .single();
    if (error) throw error;
    return mapSavedView(data);
  }

  async updateSavedView(
    viewId: string,
    values: { name?: string; configuration?: ComparisonViewConfiguration },
  ) {
    const { data, error } = await this.client
      .from("comparison_saved_views")
      .update(values)
      .eq("id", viewId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data ? mapSavedView(data) : null;
  }

  async deleteSavedView(viewId: string) {
    const { data, error } = await this.client
      .from("comparison_saved_views")
      .delete()
      .eq("id", viewId)
      .select("id");
    if (error) throw error;
    return data.length === 1;
  }
}
