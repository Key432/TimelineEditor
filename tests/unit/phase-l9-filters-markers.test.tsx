import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { TimelineEventMarkers } from "@/features/timeline-events/timeline-event-markers";
import type { TimelineEventSummary } from "@/features/timeline-events/types";
import {
  filterTimelineItems,
  DEFAULT_TIMELINE_FILTERS,
} from "@/features/timeline-items/timeline-filters";
import type { TimelineItemSummary } from "@/features/timeline-items/types";

const tag = (id: string) => ({
  id,
  projectId: "p",
  name: id,
  color: "#E5E7EB",
  description: null,
  usageCount: 0,
  createdAt: "",
  updatedAt: "",
});
const eventType = (
  id: string,
  color: string,
  markerShape: "diamond" | "triangle",
) => ({
  id,
  projectId: "p",
  name: id,
  color,
  markerShape,
  description: null,
  sortOrder: 0,
  usageCount: 0,
  createdAt: "",
  updatedAt: "",
});
function event(
  id: string,
  day: number,
  type = eventType("type-a", "#FF3399", "diamond"),
): TimelineEventSummary {
  return {
    id,
    projectId: "p",
    timelineItemId: "item",
    title: id,
    date: { year: 1900, month: 1, day },
    isApproximate: false,
    eventTypeId: type.id,
    eventType: type,
    tags: [],
    createdAt: "",
    updatedAt: "",
  };
}

describe("Phase L9 timeline classification", () => {
  it("supports tag AND and OR filters across an item and its events", () => {
    const item = {
      id: "item",
      projectId: "p",
      typeId: "type",
      itemType: {
        id: "type",
        projectId: "p",
        name: "人物",
        defaultColor: "#00B0B0",
        icon: null,
        sortOrder: 0,
        isVisible: true,
        isSystemSeed: false,
        createdAt: "",
        updatedAt: "",
      },
      title: "項目",
      tags: [tag("a")],
      temporalType: "point",
      colorOverride: null,
      manualOrder: 0,
      isVisible: true,
      start: null,
      isStartApproximate: false,
      startUncertaintyYears: null,
      endDateStatus: null,
      end: null,
      isEndApproximate: false,
      endUncertaintyYears: null,
      lastConfirmed: null,
      point: { year: 1900, month: null, day: null },
      isPointApproximate: false,
      createdAt: "",
      updatedAt: "",
    } satisfies TimelineItemSummary;
    const child = { ...event("e", 1), tags: [tag("b")] };
    const base = {
      items: [item],
      events: [child],
      matches: { itemIds: [], eventIds: [] },
      currentDate: { year: 2026, month: 1, day: 1 },
      uncertaintyYears: 5,
    };
    expect(
      filterTimelineItems({
        ...base,
        filters: {
          ...DEFAULT_TIMELINE_FILTERS,
          tagIds: ["a", "b"],
          tagMode: "and",
        },
      }).matchedIds.has("item"),
    ).toBe(true);
    expect(
      filterTimelineItems({
        ...base,
        filters: {
          ...DEFAULT_TIMELINE_FILTERS,
          tagIds: ["a", "missing"],
          tagMode: "and",
        },
      }).matchedIds.has("item"),
    ).toBe(false);
    expect(
      filterTimelineItems({
        ...base,
        filters: {
          ...DEFAULT_TIMELINE_FILTERS,
          tagIds: ["missing", "b"],
          tagMode: "or",
        },
      }).matchedIds.has("item"),
    ).toBe(true);
  });

  it("uses a gray circle for mixed-type clusters and a custom glyph for one type", () => {
    const props = {
      domainStart: 0,
      horizontalPadding: 0,
      pixelsPerDay: 0,
      visibleStart: -20,
      visibleEnd: 20,
      onOpenEvent: vi.fn(),
    };
    const { rerender } = render(
      <TooltipProvider>
        <TimelineEventMarkers
          {...props}
          events={[
            event("a", 1),
            event("b", 2, eventType("type-b", "#00B0B0", "triangle")),
          ]}
        />
      </TooltipProvider>,
    );
    expect(screen.getByTestId("timeline-event-cluster")).toHaveClass(
      "rounded-full",
    );
    expect(
      screen.getByTestId("timeline-event-cluster").style.backgroundColor,
    ).toBe("rgb(107, 114, 128)");
    rerender(
      <TooltipProvider>
        <TimelineEventMarkers
          {...props}
          events={[event("a", 1), event("b", 2)]}
        />
      </TooltipProvider>,
    );
    expect(
      screen.getByTestId("timeline-event-cluster").style.backgroundColor,
    ).toBe("rgb(255, 51, 153)");
    expect(
      screen.getByTestId("timeline-event-cluster").style.clipPath,
    ).toContain("polygon");
  });
});
