import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import type {
  EntityRelationship,
  RelationshipDataset,
} from "@/features/relationships/types";
import type { relationshipInputSchema } from "@/features/relationships/validation";
import type { Database } from "@/lib/supabase/database.types";

type RelationshipRow =
  Database["public"]["Tables"]["entity_relationships"]["Row"];

function mapRelationship(row: RelationshipRow): EntityRelationship {
  return {
    id: row.id,
    projectId: row.project_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    targetType: row.target_type,
    targetId: row.target_id,
    relationType: row.relation_type,
    direction: row.direction,
    lineStyle: row.line_style,
    sourceMarker: row.source_marker,
    targetMarker: row.target_marker,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function values(
  projectId: string,
  input: z.output<typeof relationshipInputSchema>,
) {
  const direction =
    input.sourceMarker === "none" && input.targetMarker === "none"
      ? ("undirected" as const)
      : ("directed" as const);
  return {
    project_id: projectId,
    source_type: input.sourceType,
    source_id: input.sourceId,
    target_type: input.targetType,
    target_id: input.targetId,
    relation_type: input.relationType,
    direction,
    line_style: input.lineStyle,
    source_marker: input.sourceMarker,
    target_marker: input.targetMarker,
    note: input.note,
  };
}

export class RelationshipRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async list(projectId: string): Promise<RelationshipDataset> {
    const [relationships, items, events] = await Promise.all([
      this.client
        .from("entity_relationships")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at")
        .order("id"),
      this.client
        .from("timeline_items")
        .select("id, title")
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .order("title"),
      this.client
        .from("timeline_events")
        .select("id, title")
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .order("title"),
    ]);
    if (relationships.error) throw relationships.error;
    if (items.error) throw items.error;
    if (events.error) throw events.error;
    return {
      relationships: relationships.data.map(mapRelationship),
      entities: [
        ...items.data.map((item) => ({
          type: "timeline_item" as const,
          id: item.id,
          title: item.title,
        })),
        ...events.data.map((event) => ({
          type: "timeline_event" as const,
          id: event.id,
          title: event.title,
        })),
      ],
    };
  }

  async create(
    projectId: string,
    input: z.output<typeof relationshipInputSchema>,
  ) {
    const { data, error } = await this.client
      .from("entity_relationships")
      .insert(values(projectId, input))
      .select("*")
      .single();
    if (error) throw error;
    return mapRelationship(data);
  }

  async update(
    projectId: string,
    relationshipId: string,
    input: z.output<typeof relationshipInputSchema>,
  ) {
    const { data, error } = await this.client
      .from("entity_relationships")
      .update(values(projectId, input))
      .eq("project_id", projectId)
      .eq("id", relationshipId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data ? mapRelationship(data) : null;
  }

  async delete(projectId: string, relationshipId: string) {
    const { data, error } = await this.client
      .from("entity_relationships")
      .delete()
      .eq("project_id", projectId)
      .eq("id", relationshipId)
      .select("id");
    if (error) throw error;
    return data.length === 1;
  }
}
