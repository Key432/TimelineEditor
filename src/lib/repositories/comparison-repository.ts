import type { SupabaseClient } from "@supabase/supabase-js";

import type { ComparisonProjectOption } from "@/features/comparison/types";
import type { Database } from "@/lib/supabase/database.types";

export class ComparisonRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

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

  async ownerId(projectId: string) {
    const { data, error } = await this.client
      .from("projects")
      .select("owner_id")
      .eq("id", projectId)
      .single();
    if (error) throw error;
    return data.owner_id;
  }
}
