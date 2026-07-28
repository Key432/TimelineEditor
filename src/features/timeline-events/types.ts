import type { HistoricalDate } from "@/features/timeline-items/types";

export type TimelineEventParent = {
  id: string;
  title: string;
  start: HistoricalDate;
  endDateStatus: "specified" | "ongoing" | "unknown";
  end: HistoricalDate | null;
  lastConfirmed: HistoricalDate | null;
};

export type TimelineEvent = {
  id: string;
  projectId: string;
  timelineItemId: string;
  title: string;
  aliases: string[];
  date: HistoricalDate;
  isApproximate: boolean;
  description: string | null;
  sourceText: string | null;
  externalUrl: string | null;
  parent: TimelineEventParent;
  createdAt: string;
  updatedAt: string;
};

export type TimelineEventSummary = Omit<
  TimelineEvent,
  "description" | "sourceText" | "externalUrl" | "parent" | "aliases"
>;
