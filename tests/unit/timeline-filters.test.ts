import { describe, expect, it } from "vitest";

import type { TimelineEventSummary } from "@/features/timeline-events/types";
import {
  DEFAULT_TIMELINE_FILTERS,
  filterTimelineItems,
  parseTimelineFilters,
  writeTimelineFilters,
} from "@/features/timeline-items/timeline-filters";
import type { TimelineItemSummary } from "@/features/timeline-items/types";

const type = {
  id: "11111111-1111-4111-8111-111111111111",
  projectId: "22222222-2222-4222-8222-222222222222",
  name: "人物",
  defaultColor: "#00B0B0",
  icon: null,
  sortOrder: 0,
  isVisible: true,
  isSystemSeed: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function item(id: string, title: string): TimelineItemSummary {
  return {
    id,
    projectId: type.projectId,
    typeId: type.id,
    itemType: type,
    title,
    temporalType: "range",
    colorOverride: null,
    manualOrder: 0,
    isVisible: true,
    start: { year: 1867, month: 2, day: 9 },
    isStartApproximate: false,
    startUncertaintyYears: null,
    endDateStatus: "specified",
    end: { year: 1916, month: 12, day: 9 },
    isEndApproximate: false,
    endUncertaintyYears: null,
    lastConfirmed: null,
    point: null,
    isPointApproximate: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

function event(
  id: string,
  parentId: string,
  approximate = false,
): TimelineEventSummary {
  return {
    id,
    projectId: type.projectId,
    timelineItemId: parentId,
    title: "作品発表",
    date: { year: 1905, month: 1, day: 1 },
    isApproximate: approximate,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

describe("timeline filters", () => {
  it("round-trips URL state while preserving unrelated timeline state", () => {
    const initial = new URLSearchParams("layout=compact&sort=startDate");
    const written = writeTimelineFilters(initial, {
      ...DEFAULT_TIMELINE_FILTERS,
      query: "漱石",
      typeIds: [type.id],
      fromYear: 1860,
      toYear: 1930,
      hasEvents: "yes",
      approximate: "any",
      mode: "dim",
    });
    expect(written.get("layout")).toBe("compact");
    expect(written.get("sort")).toBe("startDate");
    expect(parseTimelineFilters(written)).toMatchObject({
      query: "漱石",
      typeIds: [type.id],
      fromYear: 1860,
      toYear: 1930,
      hasEvents: "yes",
      approximate: "any",
      mode: "dim",
    });
  });

  it("keeps the parent when only its child event matches", () => {
    const parent = item("33333333-3333-4333-8333-333333333333", "夏目金之助");
    const child = event("44444444-4444-4444-8444-444444444444", parent.id);
    const result = filterTimelineItems({
      items: [parent],
      events: [child],
      filters: { ...DEFAULT_TIMELINE_FILTERS, query: "吾輩は猫である" },
      matches: { itemIds: [], eventIds: [child.id] },
      currentDate: { year: 2026, month: 7, day: 22 },
      uncertaintyYears: 5,
    });
    expect(result.matchedIds).toEqual(new Set([parent.id]));
    expect(result.matchingEventIds).toEqual(new Set([child.id]));
  });

  it("combines date, event, approximate, color, and visibility conditions", () => {
    const matching = {
      ...item("33333333-3333-4333-8333-333333333333", "一致"),
      colorOverride: "#FF3399",
      isStartApproximate: true,
    };
    const outside = {
      ...item("44444444-4444-4444-8444-444444444444", "年代外"),
      start: { year: 2000, month: null, day: null },
      end: { year: 2010, month: null, day: null },
    };
    const child = event("55555555-5555-4555-8555-555555555555", matching.id);
    const result = filterTimelineItems({
      items: [matching, outside],
      events: [child],
      filters: {
        ...DEFAULT_TIMELINE_FILTERS,
        fromYear: 1900,
        toYear: 1950,
        hasEvents: "yes",
        approximate: "start",
        hasCustomColor: "yes",
        visibility: "visible",
      },
      matches: { itemIds: [], eventIds: [] },
      currentDate: { year: 2026, month: 7, day: 22 },
      uncertaintyYears: 5,
    });
    expect(result.matchedIds).toEqual(new Set([matching.id]));
  });
});
