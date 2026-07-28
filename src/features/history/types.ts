import type { Json } from "@/lib/supabase/database.types";

export type HistoryEntityType = "timeline_item" | "timeline_event";

export type EntityHistoryChange = {
  before: Json | undefined;
  after: Json | undefined;
};

export type EntityHistoryEntry = {
  id: string;
  projectId: string;
  entityType: HistoryEntityType;
  entityId: string;
  revision: number;
  changes: Record<string, EntityHistoryChange>;
  operation: "update" | "restore" | "checkpoint";
  isCheckpoint: boolean;
  createdAt: string;
};

export type TrashEntry = {
  entityType: HistoryEntityType;
  entityId: string;
  title: string;
  deletedAt: string;
};
