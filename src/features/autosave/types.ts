import type { Json } from "@/lib/supabase/database.types";

export const cloudDraftEntityTypes = [
  "timeline_item",
  "timeline_event",
] as const;

export type CloudDraftEntityType = (typeof cloudDraftEntityTypes)[number];

export type CloudDraft<T = Json> = {
  id: string;
  projectId: string;
  entityType: CloudDraftEntityType;
  draftScope: string;
  value: T;
  baseVersion: string | null;
  fingerprint: string;
  writerId: string;
  version: number;
  savedAt: string;
};

export type SaveCloudDraftInput = {
  value: Json;
  baseVersion: string | null;
  fingerprint: string;
  writerId: string;
  expectedVersion: number | null;
};
