import type { SupabaseClient } from "@supabase/supabase-js";

import type { TimelineItemType } from "@/features/item-types/types";
import type {
  createItemTypeSchema,
  updateItemTypeSchema,
} from "@/features/item-types/validation";
import type { Database } from "@/lib/supabase/database.types";
import type { z } from "zod";

type Client = SupabaseClient<Database>;
type ItemTypeRow = Database["public"]["Tables"]["timeline_item_types"]["Row"];
type CreateItemType = z.output<typeof createItemTypeSchema>;
type UpdateItemType = z.output<typeof updateItemTypeSchema>;

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

export class ItemTypeRepository {
  constructor(private readonly client: Client) {}

  async list(projectId: string): Promise<TimelineItemType[]> {
    const { data, error } = await this.client
      .from("timeline_item_types")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order")
      .order("id");
    if (error) throw error;
    return data.map(mapItemType);
  }

  async findById(
    projectId: string,
    typeId: string,
  ): Promise<TimelineItemType | null> {
    const { data, error } = await this.client
      .from("timeline_item_types")
      .select("*")
      .eq("project_id", projectId)
      .eq("id", typeId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapItemType(data) : null;
  }

  async create(
    projectId: string,
    input: CreateItemType,
  ): Promise<TimelineItemType> {
    const existing = await this.list(projectId);
    const nextSortOrder = (existing.at(-1)?.sortOrder ?? -1) + 1;
    const { data, error } = await this.client
      .from("timeline_item_types")
      .insert({
        project_id: projectId,
        name: input.name,
        default_color: input.defaultColor,
        icon: input.icon,
        sort_order: nextSortOrder,
      })
      .select("*")
      .single();
    if (error) throw error;
    return mapItemType(data);
  }

  async update(
    projectId: string,
    typeId: string,
    input: Omit<UpdateItemType, "sortOrder">,
  ): Promise<TimelineItemType | null> {
    const values: Database["public"]["Tables"]["timeline_item_types"]["Update"] =
      {};
    if (input.name !== undefined) values.name = input.name;
    if (input.defaultColor !== undefined)
      values.default_color = input.defaultColor;
    if (input.icon !== undefined) values.icon = input.icon;
    if (input.isVisible !== undefined) values.is_visible = input.isVisible;

    if (Object.keys(values).length === 0) {
      return this.findById(projectId, typeId);
    }

    const { data, error } = await this.client
      .from("timeline_item_types")
      .update(values)
      .eq("project_id", projectId)
      .eq("id", typeId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data ? mapItemType(data) : null;
  }

  async move(projectId: string, typeId: string, sortOrder: number) {
    const { error } = await this.client.rpc("move_timeline_item_type", {
      p_project_id: projectId,
      p_type_id: typeId,
      p_new_position: sortOrder,
    });
    if (error) throw error;
  }

  async delete(projectId: string, typeId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from("timeline_item_types")
      .delete()
      .eq("project_id", projectId)
      .eq("id", typeId)
      .select("id");
    if (error) throw error;
    return data.length === 1;
  }
}
