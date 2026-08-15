import type { TimelineItemType } from "@/features/item-types/types";
import type { TimelineEventSummary } from "@/features/timeline-events/types";
import type { TimelineItemSummary } from "@/features/timeline-items/types";

export type ComparisonProjectOption = {
  id: string;
  name: string;
  description: string | null;
  publicId: string | null;
  access: "owned" | "public";
};

export type ComparisonDataset = {
  project: ComparisonProjectOption;
  items: TimelineItemSummary[];
  events: TimelineEventSummary[];
  itemTypes: TimelineItemType[];
};

export type ComparisonFilters = {
  tagNames: string[];
  typeNames: string[];
  eventTypeNames: string[];
};

export type ComparisonViewConfiguration = {
  version: 1;
  projectIds: string[];
  hiddenProjectIds: string[];
  visibleStartOrdinal: number;
  visibleEndOrdinal: number;
  zoomLevel: number;
  highlightStartOrdinal: number | null;
  highlightEndOrdinal: number | null;
  filters: ComparisonFilters;
};

export type ComparisonSavedView = {
  id: string;
  name: string;
  configuration: ComparisonViewConfiguration;
  createdAt: string;
  updatedAt: string;
};
