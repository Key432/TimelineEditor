import type { TimelineEventSummary } from "@/features/timeline-events/types";
import { historicalDateOrdinal } from "@/features/timeline-items/historical-date";
import { timelineItemVisualBounds } from "@/features/timeline-items/timeline-math";
import type {
  HistoricalDate,
  TimelineItemSummary,
} from "@/features/timeline-items/types";

export const COMPACT_LANE_GAP_PX = 16;
export const COMPACT_EVENT_RESERVE_RADIUS_PX = 12;
const POINT_MARKER_RADIUS_PX = 8;
const TITLE_SAFETY_PADDING_PX = 8;

export type CompactLanePlacement = {
  itemId: string;
  laneIndex: number;
  startX: number;
  endX: number;
};

export type CompactLane = {
  index: number;
  itemIds: string[];
};

type CompactLaneLayoutInput = {
  items: TimelineItemSummary[];
  events: TimelineEventSummary[];
  currentDate: HistoricalDate;
  defaultUncertaintyYears: number;
  domainStart: number;
  pixelsPerDay: number;
  titleWidth: (item: TimelineItemSummary) => number;
};

function xForOrdinal(
  ordinal: number,
  domainStart: number,
  pixelsPerDay: number,
) {
  return (ordinal - domainStart) * pixelsPerDay;
}

function itemStartOrdinal(item: TimelineItemSummary) {
  const date = item.temporalType === "point" ? item.point : item.start;
  return date ? historicalDateOrdinal(date) : 0;
}

export function measureCompactLaneTitle(title: string) {
  return (
    Array.from(title).reduce(
      (width, character) => width + (/^[\x00-\x7F]$/.test(character) ? 9 : 16),
      0,
    ) + TITLE_SAFETY_PADDING_PX
  );
}

export function calculateCompactLaneLayout({
  items,
  events,
  currentDate,
  defaultUncertaintyYears,
  domainStart,
  pixelsPerDay,
  titleWidth,
}: CompactLaneLayoutInput): {
  lanes: CompactLane[];
  placements: CompactLanePlacement[];
} {
  const eventsByParent = new Map<string, TimelineEventSummary[]>();
  for (const timelineEvent of events) {
    for (const parentId of timelineEvent.timelineItemIds) {
      const parentEvents = eventsByParent.get(parentId) ?? [];
      parentEvents.push(timelineEvent);
      eventsByParent.set(parentId, parentEvents);
    }
  }

  const intervals = items.map((item) => {
    const visualBounds = timelineItemVisualBounds(
      item,
      currentDate,
      defaultUncertaintyYears,
    );
    const registeredStartX = xForOrdinal(
      itemStartOrdinal(item),
      domainStart,
      pixelsPerDay,
    );
    const visualStartX = xForOrdinal(
      visualBounds.start,
      domainStart,
      pixelsPerDay,
    );
    const visualEndX = xForOrdinal(visualBounds.end, domainStart, pixelsPerDay);
    const markerRadius =
      item.temporalType === "point" ? POINT_MARKER_RADIUS_PX : 0;
    let startX = Math.min(visualStartX - markerRadius, registeredStartX);
    let endX = Math.max(
      visualEndX + markerRadius,
      registeredStartX + Math.max(0, titleWidth(item)),
    );

    for (const timelineEvent of eventsByParent.get(item.id) ?? []) {
      const eventX = xForOrdinal(
        historicalDateOrdinal(timelineEvent.date),
        domainStart,
        pixelsPerDay,
      );
      startX = Math.min(startX, eventX - COMPACT_EVENT_RESERVE_RADIUS_PX);
      endX = Math.max(endX, eventX + COMPACT_EVENT_RESERVE_RADIUS_PX);
    }

    return {
      itemId: item.id,
      itemStart: itemStartOrdinal(item),
      startX,
      endX,
    };
  });

  intervals.sort(
    (left, right) =>
      left.itemStart - right.itemStart ||
      left.endX - right.endX ||
      left.itemId.localeCompare(right.itemId),
  );

  const laneEnds: number[] = [];
  const lanes: CompactLane[] = [];
  const placements: CompactLanePlacement[] = [];

  for (const interval of intervals) {
    let laneIndex = laneEnds.findIndex(
      (laneEnd) => laneEnd + COMPACT_LANE_GAP_PX <= interval.startX,
    );
    if (laneIndex === -1) {
      laneIndex = laneEnds.length;
      laneEnds.push(interval.endX);
      lanes.push({ index: laneIndex, itemIds: [] });
    } else {
      laneEnds[laneIndex] = interval.endX;
    }
    lanes[laneIndex]!.itemIds.push(interval.itemId);
    placements.push({
      itemId: interval.itemId,
      laneIndex,
      startX: interval.startX,
      endX: interval.endX,
    });
  }

  return { lanes, placements };
}
