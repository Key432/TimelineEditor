import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  MissingSourceEntity,
  Source,
  SourceCitation,
  SourceReference,
} from "@/features/sources/types";
import type {
  SourceCitationValues,
  SourceValues,
} from "@/features/sources/validation";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type SourceRow = Database["public"]["Tables"]["sources"]["Row"];
type CitationRow = Database["public"]["Tables"]["source_citations"]["Row"];

function mapSource(row: SourceRow, references: SourceReference[] = []): Source {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    authors: row.authors,
    publisher: row.publisher,
    publicationYear: row.publication_year,
    isbn: row.isbn,
    url: row.url,
    accessedOn: row.accessed_on,
    citationKey: row.citation_key,
    notes: row.notes,
    references,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function persistenceValues(input: SourceValues) {
  return {
    title: input.title,
    authors: input.authors,
    publisher: input.publisher,
    publication_year: input.publicationYear,
    isbn: input.isbn,
    url: input.url,
    accessed_on: input.accessedOn,
    citation_key: input.citationKey,
    notes: input.notes,
  };
}

export class SourceRepository {
  constructor(private readonly client: Client) {}

  async list(projectId: string): Promise<Source[]> {
    const { data, error } = await this.client
      .from("sources")
      .select("*")
      .eq("project_id", projectId)
      .order("title")
      .order("id");
    if (error) throw error;
    const references = await this.listReferences(projectId);
    return data.map((row) =>
      mapSource(
        row,
        references.filter((reference) => reference.sourceId === row.id),
      ),
    );
  }

  async findById(projectId: string, sourceId: string): Promise<Source | null> {
    const { data, error } = await this.client
      .from("sources")
      .select("*")
      .eq("project_id", projectId)
      .eq("id", sourceId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const references = await this.listReferences(projectId, sourceId);
    return mapSource(
      data,
      references.map((reference) => ({
        entityType: reference.entityType,
        entityId: reference.entityId,
        title: reference.title,
      })),
    );
  }

  private async listReferences(projectId: string, sourceId?: string) {
    let query = this.client
      .from("source_citations")
      .select("source_id, entity_type, entity_id")
      .eq("project_id", projectId);
    if (sourceId) query = query.eq("source_id", sourceId);
    const { data, error } = await query;
    if (error) throw error;
    const itemIds = data
      .filter((row) => row.entity_type === "timeline_item")
      .map((row) => row.entity_id);
    const eventIds = data
      .filter((row) => row.entity_type === "timeline_event")
      .map((row) => row.entity_id);
    const [items, events] = await Promise.all([
      itemIds.length
        ? this.client
            .from("timeline_items")
            .select("id, title")
            .eq("project_id", projectId)
            .in("id", itemIds)
            .is("deleted_at", null)
        : Promise.resolve({ data: [], error: null }),
      eventIds.length
        ? this.client
            .from("timeline_events")
            .select("id, title")
            .eq("project_id", projectId)
            .in("id", eventIds)
            .is("deleted_at", null)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (items.error) throw items.error;
    if (events.error) throw events.error;
    const titles = new Map([
      ...(items.data ?? []).map((row) => [row.id, row.title] as const),
      ...(events.data ?? []).map((row) => [row.id, row.title] as const),
    ]);
    return data.flatMap((row) => {
      const title = titles.get(row.entity_id);
      return title
        ? [
            {
              sourceId: row.source_id,
              entityType: row.entity_type,
              entityId: row.entity_id,
              title,
            },
          ]
        : [];
    });
  }

  async listMissingEntities(projectId: string): Promise<MissingSourceEntity[]> {
    const { data: citations, error: citationError } = await this.client
      .from("source_citations")
      .select("entity_type, entity_id")
      .eq("project_id", projectId);
    if (citationError) throw citationError;
    const cited = new Set(
      citations.map((row) => `${row.entity_type}:${row.entity_id}`),
    );
    const [items, events] = await Promise.all([
      this.client
        .from("timeline_items")
        .select("id, title, source_text")
        .eq("project_id", projectId)
        .is("deleted_at", null),
      this.client
        .from("timeline_events")
        .select("id, title, source_text")
        .eq("project_id", projectId)
        .is("deleted_at", null),
    ]);
    if (items.error) throw items.error;
    if (events.error) throw events.error;
    return [
      ...items.data
        .filter(
          (row) => !row.source_text && !cited.has(`timeline_item:${row.id}`),
        )
        .map((row) => ({
          entityType: "timeline_item" as const,
          entityId: row.id,
          title: row.title,
        })),
      ...events.data
        .filter(
          (row) => !row.source_text && !cited.has(`timeline_event:${row.id}`),
        )
        .map((row) => ({
          entityType: "timeline_event" as const,
          entityId: row.id,
          title: row.title,
        })),
    ];
  }

  async create(projectId: string, input: SourceValues) {
    const { data, error } = await this.client
      .from("sources")
      .insert({ project_id: projectId, ...persistenceValues(input) })
      .select("*")
      .single();
    if (error) throw error;
    return mapSource(data);
  }

  async update(projectId: string, sourceId: string, input: SourceValues) {
    const { data, error } = await this.client
      .from("sources")
      .update(persistenceValues(input))
      .eq("project_id", projectId)
      .eq("id", sourceId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const current = await this.findById(projectId, sourceId);
    return current
      ? { ...mapSource(data), references: current.references }
      : null;
  }

  async delete(projectId: string, sourceId: string) {
    const { data, error } = await this.client
      .from("sources")
      .delete()
      .eq("project_id", projectId)
      .eq("id", sourceId)
      .select("id");
    if (error) throw error;
    return data.length === 1;
  }

  async listForEntity(
    projectId: string,
    entityType: "timeline_item" | "timeline_event",
    entityId: string,
  ): Promise<SourceCitation[]> {
    const { data, error } = await this.client
      .from("source_citations")
      .select("*, sources (*)")
      .eq("project_id", projectId)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at");
    if (error) throw error;
    return (data as unknown as (CitationRow & { sources: SourceRow })[]).map(
      (row) => ({
        id: row.id,
        sourceId: row.source_id,
        source: mapSource(row.sources),
        pages: row.pages,
        chapter: row.chapter,
        quote: row.quote,
        notes: row.notes,
      }),
    );
  }

  async replaceForEntity(
    projectId: string,
    entityType: "timeline_item" | "timeline_event",
    entityId: string,
    citations: SourceCitationValues[],
  ) {
    const { error } = await this.client.rpc("replace_source_citations", {
      p_project_id: projectId,
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_citations: citations.map((citation) => ({
        source_id: citation.sourceId,
        pages: citation.pages,
        chapter: citation.chapter,
        quote: citation.quote,
        notes: citation.notes,
      })),
    });
    if (error) throw error;
  }

  async allBelongToProject(projectId: string, sourceIds: string[]) {
    if (!sourceIds.length) return true;
    const { count, error } = await this.client
      .from("sources")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .in("id", sourceIds);
    if (error) throw error;
    return count === new Set(sourceIds).size;
  }
}
