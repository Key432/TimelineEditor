import type { TimelineItemType } from "@/features/item-types/types";

export const TEMPORAL_TYPES = ["range", "point"] as const;
export type TemporalType = (typeof TEMPORAL_TYPES)[number];

export const END_DATE_STATUSES = ["specified", "ongoing", "unknown"] as const;
export type EndDateStatus = (typeof END_DATE_STATUSES)[number];

export const TIMELINE_SORT_MODES = [
  "manual",
  "startDate",
  "endDate",
  "title",
  "itemType",
  "createdAt",
  "updatedAt",
] as const;
export type TimelineSortMode = (typeof TIMELINE_SORT_MODES)[number];

export const TIMELINE_LAYOUT_MODES = ["row", "compact"] as const;
export type TimelineLayoutMode = (typeof TIMELINE_LAYOUT_MODES)[number];

export const HISTORICAL_ERAS = ["ce", "bce"] as const;
export type HistoricalEra = (typeof HISTORICAL_ERAS)[number];

export const HISTORICAL_DATE_PRECISIONS = [
  "day",
  "month",
  "year",
  "decade",
  "century",
] as const;
export type HistoricalDatePrecision =
  (typeof HISTORICAL_DATE_PRECISIONS)[number];

export type HistoricalDate = {
  /** Omitted only by legacy in-memory callers; persistence always writes it. */
  era?: HistoricalEra;
  /** Omitted only by legacy in-memory callers and inferred from month/day. */
  precision?: HistoricalDatePrecision;
  year: number;
  month: number | null;
  day: number | null;
  originalText?: string | null;
  calendar?: string;
};

export type TimelineItem = {
  id: string;
  projectId: string;
  typeId: string;
  itemType: TimelineItemType;
  title: string;
  description: string | null;
  sourceText: string | null;
  externalUrl: string | null;
  temporalType: TemporalType;
  colorOverride: string | null;
  manualOrder: number;
  isVisible: boolean;
  start: HistoricalDate | null;
  isStartApproximate: boolean;
  startUncertaintyYears: number | null;
  endDateStatus: EndDateStatus | null;
  end: HistoricalDate | null;
  isEndApproximate: boolean;
  endUncertaintyYears: number | null;
  lastConfirmed: HistoricalDate | null;
  point: HistoricalDate | null;
  isPointApproximate: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TimelineItemSummary = Omit<
  TimelineItem,
  "description" | "sourceText" | "externalUrl"
>;

export type TimelineEventCreationFailure = {
  title: string;
  reason: string;
};

export type TimelineItemCreateResult = {
  item: TimelineItem;
  createdEventIds: string[];
  failedEvents: TimelineEventCreationFailure[];
};

export const TIMELINE_SORT_LABELS: Record<TimelineSortMode, string> = {
  manual: "手動順",
  startDate: "開始・時点日",
  endDate: "終了日",
  title: "名称",
  itemType: "対象種別",
  createdAt: "作成日時",
  updatedAt: "更新日時",
};
