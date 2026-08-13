import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RelationshipNetwork } from "@/features/relationship-network/relationship-network";
import type { RelationshipDataset } from "@/features/relationships/types";
import type { TimelineEventSummary } from "@/features/timeline-events/types";
import { DEFAULT_TIMELINE_FILTERS } from "@/features/timeline-items/timeline-filters";
import type { TimelineItemSummary } from "@/features/timeline-items/types";

const projectId = "22222222-2222-4222-8222-222222222222";
const itemType = {
  id: "type-1",
  projectId,
  name: "人物",
  defaultColor: "#00B0B0",
  icon: "user-round" as const,
  sortOrder: 0,
  isVisible: true,
  isSystemSeed: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function item(id: string, title: string): TimelineItemSummary {
  return {
    id,
    projectId,
    typeId: itemType.id,
    itemType,
    title,
    tags: [],
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
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

function event(
  id: string,
  title: string,
  typeName = "分類名が一行では収まりきらないほど非常に長いイベント分類名",
): TimelineEventSummary {
  return {
    id,
    projectId,
    timelineItemIds: [],
    eventTypeId: "event-type-1",
    eventType: {
      id: "event-type-1",
      projectId,
      name: typeName,
      color: "#FF3399",
      markerShape: "circle",
      description: null,
      sortOrder: 0,
      usageCount: 1,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
    tags: [],
    title,
    date: { year: 1901, month: 1, day: 1 },
    isApproximate: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

const dataset: RelationshipDataset = {
  entities: [
    { type: "timeline_item", id: "a", title: "源流A" },
    { type: "timeline_item", id: "b", title: "後継B" },
  ],
  relationships: [
    {
      id: "relationship-1",
      projectId,
      sourceType: "timeline_item",
      sourceId: "a",
      targetType: "timeline_item",
      targetId: "b",
      relationType: "継承",
      direction: "directed",
      lineStyle: "double",
      sourceMarker: "arrow",
      targetMarker: "arrow",
      note: null,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
  ],
};

describe("Phase L15 relationship network", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    Object.defineProperties(SVGSVGElement.prototype, {
      setPointerCapture: { configurable: true, value: vi.fn() },
      releasePointerCapture: { configurable: true, value: vi.fn() },
      hasPointerCapture: { configurable: true, value: vi.fn(() => true) },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("distinguishes item and event shapes and keeps entity labels out of the nodes", async () => {
    const user = userEvent.setup();
    const onOpenItem = vi.fn();
    render(
      <RelationshipNetwork
        dataset={dataset}
        events={[]}
        initialTimelineFilters={DEFAULT_TIMELINE_FILTERS}
        items={[item("a", "源流A"), item("b", "後継B")]}
        onOpenItem={onOpenItem}
      />,
    );

    const source = screen.getByRole("button", { name: /源流A/ });
    expect(source.querySelector("rect")?.getAttribute("rx")).toBe("0");
    const edge = screen.getByTestId("network-edge-relationship-1");
    const paths = edge.querySelectorAll("path");
    expect(paths).toHaveLength(2);
    expect(paths[0]).toHaveAttribute("marker-start", "url(#network-arrow)");
    expect(paths[0]).toHaveAttribute("marker-end", "url(#network-arrow)");

    await user.click(source);
    expect(screen.getByText("直接 1")).toBeInTheDocument();
    expect(screen.getByText("2段階 0")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "詳細を開く" }));
    expect(onOpenItem).toHaveBeenCalledWith("a");
  });

  it("wraps long titles to two fixed-height lines and truncates the classification", () => {
    const title =
      "最大幅を超えて二行でも収まりきらない非常に長いイベントタイトルの残りを省略する";
    render(
      <RelationshipNetwork
        dataset={{ entities: [], relationships: [] }}
        events={[event("long-event", title)]}
        initialTimelineFilters={DEFAULT_TIMELINE_FILTERS}
        items={[]}
      />,
    );

    const node = screen.getByRole("button", { name: new RegExp(title) });
    const rect = node.querySelector("rect");
    const titleText = screen.getByTestId(
      "network-node-title-timeline_event:long-event",
    );
    const subtitleText = screen.getByTestId(
      "network-node-subtitle-timeline_event:long-event",
    );
    expect(rect).toHaveAttribute("rx", "12");
    expect(rect).toHaveAttribute("width", "250");
    expect(node.querySelectorAll("[data-title-line]")).toHaveLength(2);
    expect(titleText.textContent).toMatch(/…$/);
    expect(subtitleText).not.toHaveTextContent("イベント");
    expect(subtitleText.textContent).toMatch(/…$/);
    expect(node).toHaveAttribute("data-node-height", "76");
  });

  it("filters nodes and supports wheel zoom plus canvas panning", async () => {
    const user = userEvent.setup();
    render(
      <RelationshipNetwork
        dataset={dataset}
        events={[]}
        initialTimelineFilters={DEFAULT_TIMELINE_FILTERS}
        items={[item("a", "源流A"), item("b", "後継B")]}
      />,
    );
    const canvas = screen.getByTestId("relationship-network-canvas");
    const graph = canvas.querySelector(":scope > g:last-of-type")!;
    const beforeZoom = graph.getAttribute("transform");
    fireEvent.wheel(canvas, { clientX: 400, clientY: 300, deltaY: -100 });
    expect(graph.getAttribute("transform")).not.toBe(beforeZoom);

    const beforePan = graph.getAttribute("transform");
    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 300,
      clientY: 250,
      pointerId: 1,
    });
    fireEvent.pointerMove(canvas, { clientX: 340, clientY: 280, pointerId: 1 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    expect(graph.getAttribute("transform")).not.toBe(beforePan);

    await user.type(
      screen.getByPlaceholderText("ノード名、種別、タグを検索"),
      "源流",
    );
    expect(screen.getByRole("button", { name: /源流A/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /後継B/ })).toBeNull();
  });
});
