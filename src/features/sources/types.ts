export type SourceReference = {
  entityType: "timeline_item" | "timeline_event";
  entityId: string;
  title: string;
};

export type Source = {
  id: string;
  projectId: string;
  title: string;
  authors: string[];
  publisher: string | null;
  publicationYear: number | null;
  isbn: string | null;
  url: string | null;
  accessedOn: string | null;
  citationKey: string | null;
  notes: string | null;
  references: SourceReference[];
  createdAt: string;
  updatedAt: string;
};

export type SourceCitation = {
  id?: string;
  sourceId: string;
  source: Omit<Source, "references">;
  pages: string | null;
  chapter: string | null;
  quote: string | null;
  notes: string | null;
};

export type MissingSourceEntity = SourceReference;
