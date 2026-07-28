import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  EntityHistoryChange,
  EntityHistoryEntry,
  HistoryEntityType,
  TrashEntry,
} from "@/features/history/types";
import type { Database, Json } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type HistoryRow = Database["public"]["Tables"]["entity_history"]["Row"];

function isChange(value: Json | undefined): value is {
  before?: Json;
  after?: Json;
} {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function changes(value: Json): Record<string, EntityHistoryChange> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).flatMap(([field, change]) =>
      isChange(change)
        ? [[field, { before: change.before, after: change.after }]]
        : [],
    ),
  );
}

function mapHistory(row: HistoryRow): EntityHistoryEntry {
  return {
    id: row.id,
    projectId: row.project_id,
    entityType: row.entity_type as HistoryEntityType,
    entityId: row.entity_id,
    revision: row.revision,
    changes: changes(row.changes),
    operation: row.operation as EntityHistoryEntry["operation"],
    isCheckpoint: row.is_checkpoint,
    createdAt: row.created_at,
  };
}

export class HistoryRepository {
  constructor(private readonly client: Client) {}

  async isProjectOwner(projectId: string, ownerId: string) {
    const { data, error } = await this.client
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (error) throw error;
    return data !== null;
  }

  async list(
    projectId: string,
    entityType: HistoryEntityType,
    entityId: string,
  ) {
    const { data, error } = await this.client
      .from("entity_history")
      .select("*")
      .eq("project_id", projectId)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("revision", { ascending: false });
    if (error) throw error;
    return data.map(mapHistory);
  }

  async checkpoint(
    projectId: string,
    entityType: HistoryEntityType,
    entityId: string,
  ) {
    const { data, error } = await this.client.rpc("create_entity_checkpoint", {
      p_project_id: projectId,
      p_entity_type: entityType,
      p_entity_id: entityId,
    });
    if (error) throw error;
    return mapHistory(data);
  }

  async restoreHistory(projectId: string, historyId: string) {
    const { data, error } = await this.client.rpc("restore_entity_history", {
      p_project_id: projectId,
      p_history_id: historyId,
    });
    if (error) throw error;
    return data;
  }

  async listTrash(projectId: string): Promise<TrashEntry[]> {
    const [itemsResult, eventsResult] = await Promise.all([
      this.client
        .from("timeline_items")
        .select("id, title, deleted_at")
        .eq("project_id", projectId)
        .not("deleted_at", "is", null),
      this.client
        .from("timeline_events")
        .select("id, title, deleted_at, timeline_item_id")
        .eq("project_id", projectId)
        .not("deleted_at", "is", null),
    ]);
    if (itemsResult.error) throw itemsResult.error;
    if (eventsResult.error) throw eventsResult.error;
    const deletedItemIds = new Set(itemsResult.data.map((item) => item.id));
    return [
      ...itemsResult.data.map((item) => ({
        entityType: "timeline_item" as const,
        entityId: item.id,
        title: item.title,
        deletedAt: item.deleted_at!,
      })),
      ...eventsResult.data
        .filter((event) => !deletedItemIds.has(event.timeline_item_id))
        .map((event) => ({
          entityType: "timeline_event" as const,
          entityId: event.id,
          title: event.title,
          deletedAt: event.deleted_at!,
        })),
    ].sort((left, right) => right.deletedAt.localeCompare(left.deletedAt));
  }

  async restoreTrash(
    projectId: string,
    entityType: HistoryEntityType,
    entityId: string,
  ) {
    const { data, error } = await this.client.rpc("restore_trashed_entity", {
      p_project_id: projectId,
      p_entity_type: entityType,
      p_entity_id: entityId,
    });
    if (error) throw error;
    return data;
  }

  async purgeTrash(
    projectId: string,
    entityType: HistoryEntityType,
    entityId: string,
  ) {
    const { data, error } = await this.client.rpc("purge_trashed_entity", {
      p_project_id: projectId,
      p_entity_type: entityType,
      p_entity_id: entityId,
    });
    if (error) throw error;
    return data;
  }
}
