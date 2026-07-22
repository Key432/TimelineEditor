import type { HistoricalDate } from "@/features/timeline-items/types";

export const SEARCH_ENTITY_TYPES = [
  "project",
  "timeline_item",
  "timeline_event",
] as const;

export type SearchEntityType = (typeof SEARCH_ENTITY_TYPES)[number];

export type SearchResult = {
  entityType: SearchEntityType;
  entityId: string;
  projectId: string;
  title: string;
  projectName: string;
  excerpt: string;
  detailPath: string;
  start: HistoricalDate | null;
  end: HistoricalDate | null;
  endDateStatus: "specified" | "ongoing" | "unknown" | null;
  isStartApproximate: boolean;
  isEndApproximate: boolean;
};

export type SearchResponse = {
  results: SearchResult[];
  total: number;
  page: number;
  pageSize: number;
};

export type TimelineSearchMatches = {
  itemIds: string[];
  eventIds: string[];
};
