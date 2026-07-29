import { describe, expect, it } from "vitest";

import type { TimelineItemType } from "@/features/item-types/types";
import type { TimelineEventSummary } from "@/features/timeline-events/types";
import {
  calculateCompactLaneLayout,
  COMPACT_LANE_GAP_PX,
} from "@/features/timeline-items/compact-lane-layout";
import { historicalDateOrdinal } from "@/features/timeline-items/historical-date";
import type { TimelineItemSummary } from "@/features/timeline-items/types";

const itemType: TimelineItemType = {
  id: "type-person",
  projectId: "project-1",
  name: "人物",
  defaultColor: "#2878B5",
  icon: null,
  sortOrder: 0,
  isVisible: true,
  isSystemSeed: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function rangeItem(
  id: string,
  startDay: number,
  endDay: number,
  overrides: Partial<TimelineItemSummary> = {},
): TimelineItemSummary {
  return {
    id,
    projectId: "project-1",
    typeId: itemType.id,
    itemType,
    title: id,
    temporalType: "range",
    colorOverride: null,
    manualOrder: 0,
    isVisible: true,
    start: { year: 1900, month: 1, day: startDay },
    isStartApproximate: false,
    startUncertaintyYears: null,
    endDateStatus: "specified",
    end: { year: 1900, month: 1, day: endDay },
    isEndApproximate: false,
    endUncertaintyYears: null,
    lastConfirmed: null,
    point: null,
    isPointApproximate: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function timelineEvent(
  id: string,
  timelineItemId: string,
  day: number,
): TimelineEventSummary {
  return {
    id,
    projectId: "project-1",
    timelineItemIds: [timelineItemId],
    title: id,
    date: { year: 1900, month: 1, day },
    isApproximate: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

const domainStart = historicalDateOrdinal({ year: 1900, month: 1, day: 1 });
const currentDate = { year: 2026, month: 7, day: 22 } as const;

function layout(
  items: TimelineItemSummary[],
  events: TimelineEventSummary[] = [],
  titleWidths: Record<string, number> = {},
) {
  return calculateCompactLaneLayout({
    items,
    events,
    currentDate,
    defaultUncertaintyYears: 5,
    domainStart,
    pixelsPerDay: 10,
    titleWidth: (item) => titleWidths[item.id] ?? 0,
  });
}

describe("calculateCompactLaneLayout", () => {
  it("reuses the highest available lane while preserving the fixed gap", () => {
    const first = rangeItem("first", 1, 3);
    const touching = rangeItem("touching", 4, 5);
    const later = rangeItem("later", 6, 8);

    const result = layout([later, touching, first]);

    expect(
      result.placements.map(({ itemId, laneIndex }) => [itemId, laneIndex]),
    ).toEqual([
      ["first", 0],
      ["touching", 1],
      ["later", 0],
    ]);
    expect(
      result.placements.find(({ itemId }) => itemId === "later")!.startX -
        result.placements.find(({ itemId }) => itemId === "first")!.endX,
    ).toBeGreaterThanOrEqual(COMPACT_LANE_GAP_PX);
  });

  it("extends occupancy through out-of-range events and cluster-sized marker bounds", () => {
    const parent = rangeItem("parent", 1, 3);
    const afterEvent = rangeItem("after-event", 10, 12);

    const result = layout(
      [parent, afterEvent],
      [timelineEvent("posthumous", parent.id, 9)],
    );

    expect(result.lanes).toHaveLength(2);
    expect(
      result.placements.find(({ itemId }) => itemId === parent.id),
    ).toMatchObject({ laneIndex: 0 });
    expect(
      result.placements.find(({ itemId }) => itemId === afterEvent.id),
    ).toMatchObject({ laneIndex: 1 });
  });

  it("includes the full title width in an item's occupied interval", () => {
    const longTitle = rangeItem("long-title", 1, 2);
    const next = rangeItem("next", 10, 12);

    const result = layout([longTitle, next], [], { "long-title": 120 });

    expect(result.lanes).toHaveLength(2);
  });

  it("uses ongoing and unknown visual endpoints and remains deterministic", () => {
    const ongoing = rangeItem("ongoing", 1, 2, {
      endDateStatus: "ongoing",
      end: null,
    });
    const unknown = rangeItem("unknown", 1, 2, {
      endDateStatus: "unknown",
      end: null,
      lastConfirmed: { year: 1900, month: 1, day: 4 },
      endUncertaintyYears: 1,
    });

    const first = layout([unknown, ongoing]);
    const second = layout([ongoing, unknown]);

    expect(first.placements).toEqual(second.placements);
    expect(first.placements.map(({ itemId }) => itemId)).toEqual([
      "unknown",
      "ongoing",
    ]);
    expect(first.lanes).toHaveLength(2);
  });

  it("packs 1,000 items with 10,000 events within the unit-test budget", () => {
    const items = Array.from({ length: 1000 }, (_, index) =>
      rangeItem(`item-${index}`, 1, 2, {
        start: { year: 1800 + (index % 200), month: 1, day: 1 },
        end: { year: 1801 + (index % 200), month: 1, day: 1 },
      }),
    );
    const events = items.flatMap((item, itemIndex) =>
      Array.from({ length: 10 }, (_, eventIndex) => ({
        ...timelineEvent(`event-${itemIndex}-${eventIndex}`, item.id, 1),
        date: {
          year: 1800 + (itemIndex % 200),
          month: eventIndex + 1,
          day: 1,
        },
      })),
    );

    const result = calculateCompactLaneLayout({
      items,
      events,
      currentDate,
      defaultUncertaintyYears: 5,
      domainStart: historicalDateOrdinal({ year: 1700, month: 1, day: 1 }),
      pixelsPerDay: 0.03,
      titleWidth: () => 80,
    });

    expect(result.placements).toHaveLength(1000);
    expect(result.lanes.length).toBeGreaterThan(0);
    expect(result.lanes.flatMap((lane) => lane.itemIds)).toHaveLength(1000);
  });
});
