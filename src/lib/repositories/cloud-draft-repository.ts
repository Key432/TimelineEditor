import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CloudDraft,
  CloudDraftEntityType,
  SaveCloudDraftInput,
} from "@/features/autosave/types";
import type { Database, Json } from "@/lib/supabase/database.types";

type Row = Database["public"]["Tables"]["cloud_drafts"]["Row"];

function mapRow(row: Row): CloudDraft {
  return {
    id: row.id,
    projectId: row.project_id,
    entityType: row.entity_type,
    draftScope: row.draft_scope,
    value: row.payload,
    baseVersion: row.base_version,
    fingerprint: row.fingerprint,
    writerId: row.writer_id,
    version: row.draft_version,
    savedAt: row.updated_at,
  };
}

export class CloudDraftRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

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

  async find(
    projectId: string,
    entityType: CloudDraftEntityType,
    draftScope: string,
  ) {
    const { data, error } = await this.client
      .from("cloud_drafts")
      .select("*")
      .eq("project_id", projectId)
      .eq("entity_type", entityType)
      .eq("draft_scope", draftScope)
      .maybeSingle();
    if (error) throw error;
    return data ? mapRow(data) : null;
  }

  async create(
    projectId: string,
    entityType: CloudDraftEntityType,
    draftScope: string,
    input: SaveCloudDraftInput,
  ) {
    const { data, error } = await this.client
      .from("cloud_drafts")
      .insert({
        project_id: projectId,
        entity_type: entityType,
        draft_scope: draftScope,
        payload: input.value,
        base_version: input.baseVersion,
        fingerprint: input.fingerprint,
        writer_id: input.writerId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return mapRow(data);
  }

  async update(
    projectId: string,
    entityType: CloudDraftEntityType,
    draftScope: string,
    currentVersion: number,
    input: SaveCloudDraftInput,
  ) {
    const { data, error } = await this.client
      .from("cloud_drafts")
      .update({
        payload: input.value as Json,
        base_version: input.baseVersion,
        fingerprint: input.fingerprint,
        writer_id: input.writerId,
        draft_version: currentVersion + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("project_id", projectId)
      .eq("entity_type", entityType)
      .eq("draft_scope", draftScope)
      .eq("draft_version", currentVersion)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data ? mapRow(data) : null;
  }

  async delete(
    projectId: string,
    entityType: CloudDraftEntityType,
    draftScope: string,
  ) {
    const { error } = await this.client
      .from("cloud_drafts")
      .delete()
      .eq("project_id", projectId)
      .eq("entity_type", entityType)
      .eq("draft_scope", draftScope);
    if (error) throw error;
  }
}
