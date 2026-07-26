import type { TimelineFilters } from "@/features/timeline-items/timeline-filters";
import type {
  TimelineLayoutMode,
  TimelineSortMode,
} from "@/features/timeline-items/types";

export type TimelineViewConfiguration = {
  version: 1;
  visibleStartOrdinal: number;
  visibleEndOrdinal: number;
  zoomLevel: number;
  scrollLeft: number;
  filters: TimelineFilters;
  sortMode: TimelineSortMode;
  sortDirection: "asc" | "desc";
  groupByType: boolean;
  layoutMode: TimelineLayoutMode;
  density: "comfortable" | "compact";
  tags: string[];
  backgroundLayerIds: string[];
  showRelationships: boolean;
  visibleColumns: string[];
};

export type TimelineSavedView = {
  id: string;
  projectId: string;
  name: string;
  configuration: TimelineViewConfiguration;
  createdAt: string;
  updatedAt: string;
};
