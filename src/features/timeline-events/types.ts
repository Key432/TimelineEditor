import type { HistoricalDate } from "@/features/timeline-items/types";
import type { SourceCitation } from "@/features/sources/types";
import type {
  CustomFieldEntry,
  EventType,
  Tag,
} from "@/features/classification/types";

export type TimelineEventParent = {
  id: string;
  title: string;
  start: HistoricalDate;
  endDateStatus: "specified" | "ongoing" | "unknown";
  end: HistoricalDate | null;
  lastConfirmed: HistoricalDate | null;
  sortOrder: number;
};

export type TimelineEvent = {
  id: string;
  projectId: string;
  timelineItemIds: string[];
  eventTypeId?: string | null;
  eventType?: EventType | null;
  tags?: Tag[];
  customFields?: CustomFieldEntry[];
  title: string;
  aliases: string[];
  date: HistoricalDate;
  isApproximate: boolean;
  description: string | null;
  sourceText: string | null;
  citations?: SourceCitation[];
  externalUrl: string | null;
  parents: TimelineEventParent[];
  createdAt: string;
  updatedAt: string;
};

export type TimelineEventSummary = Omit<
  TimelineEvent,
  | "description"
  | "sourceText"
  | "externalUrl"
  | "parents"
  | "aliases"
  | "customFields"
>;
