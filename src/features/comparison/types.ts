import type { TimelineItemType } from "@/features/item-types/types";
import type { Project } from "@/features/projects/types";
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
  project: Project;
  access: ComparisonProjectOption["access"];
  items: TimelineItemSummary[];
  events: TimelineEventSummary[];
  itemTypes: TimelineItemType[];
};
