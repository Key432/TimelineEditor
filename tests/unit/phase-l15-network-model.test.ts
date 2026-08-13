import { describe, expect, it } from "vitest";

import type { EntityRelationship } from "@/features/relationships/types";
import {
  buildNetworkEdges,
  buildNetworkNodes,
  EMPTY_NETWORK_FILTERS,
  filterNetwork,
  networkNeighborhood,
  stageNetwork,
} from "@/features/relationship-network/network-model";
import {
  layoutNetwork,
  networkEdgePath,
} from "@/features/relationship-network/network-layout";
import type { TimelineEventSummary } from "@/features/timeline-events/types";
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

function item(
  id: string,
  title: string,
  year: number,
  bce = false,
): TimelineItemSummary {
  return {
    id,
    projectId,
    typeId: itemType.id,
    itemType,
    title,
    tags: [
      {
        id: "tag-1",
        projectId,
        name: "文学",
        color: "#FF3399",
        description: null,
        usageCount: 1,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ],
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
    point: { era: bce ? "bce" : "ce", year, month: null, day: null },
    isPointApproximate: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

function event(id: string, title: string, year: number): TimelineEventSummary {
  return {
    id,
    projectId,
    timelineItemIds: [],
    eventTypeId: null,
    eventType: null,
    tags: [],
    title,
    date: { year, month: 1, day: 1 },
    isApproximate: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

function relationship(
  id: string,
  sourceId: string,
  targetType: "timeline_item" | "timeline_event",
  targetId: string,
  relationType = "影響",
): EntityRelationship {
  return {
    id,
    projectId,
    sourceType: "timeline_item",
    sourceId,
    targetType,
    targetId,
    relationType,
    direction: "directed",
    lineStyle: "single",
    sourceMarker: "none",
    targetMarker: "arrow",
    note: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

describe("Phase L15 network model", () => {
  it("builds item and event nodes and filters BCE/CE years without Date", () => {
    const nodes = buildNetworkNodes(
      [item("item-bce", "古代", 2, true), item("item-ce", "近代", 1900)],
      [event("event-ce", "出来事", 1910)],
    );
    const result = filterNetwork(nodes, [], {
      ...EMPTY_NETWORK_FILTERS,
      fromYear: -10,
      toYear: 1,
      tagIds: ["tag-1"],
    });
    expect(result.nodes.map((node) => node.title)).toEqual(["古代"]);
    expect(result.nodes[0]).toMatchObject({ startYear: -1, typeLabel: "人物" });
  });

  it("filters relation types and calculates direct and second-degree neighbors", () => {
    const nodes = buildNetworkNodes(
      [item("a", "A", 1900), item("b", "B", 1901)],
      [event("c", "C", 1902)],
    );
    const edges = buildNetworkEdges([
      relationship("r1", "a", "timeline_item", "b"),
      relationship("r2", "b", "timeline_event", "c", "参照"),
    ]);
    const filtered = filterNetwork(nodes, edges, {
      ...EMPTY_NETWORK_FILTERS,
      relationTypes: ["影響"],
    });
    expect(filtered.nodes.map((node) => node.title)).toEqual(["A", "B"]);
    expect(filtered.edges).toHaveLength(1);
    const neighborhood = networkNeighborhood("timeline_item:a", edges);
    expect([...neighborhood.direct]).toEqual(["timeline_item:b"]);
    expect([...neighborhood.second]).toEqual(["timeline_event:c"]);
  });

  it("stages large datasets by degree and expands a type cluster", () => {
    const nodes = buildNetworkNodes(
      Array.from({ length: 8 }, (_, index) =>
        item(`item-${index}`, `項目${index}`, 1900 + index),
      ),
      [],
    );
    const edges = buildNetworkEdges([
      relationship("r1", "item-0", "timeline_item", "item-1"),
      relationship("r2", "item-0", "timeline_item", "item-2"),
    ]);
    const staged = stageNetwork(nodes, edges, new Map(), 3);
    expect(staged.nodes.filter((node) => node.kind === "entity")).toHaveLength(
      3,
    );
    expect(staged.nodes.filter((node) => node.kind === "cluster")).toHaveLength(
      1,
    );
    expect(staged.hiddenCount).toBe(5);
    expect(
      stageNetwork(nodes, edges, new Map([["item:type-1", 1]]), 3).hiddenCount,
    ).toBe(2);
    expect(
      stageNetwork(nodes, edges, new Map([["item:type-1", 2]]), 3).hiddenCount,
    ).toBe(0);
  });

  it("keeps a 1,000-node graph bounded until clusters are explicitly expanded", () => {
    const nodes = buildNetworkNodes(
      Array.from({ length: 1000 }, (_, index) =>
        item(`large-${index}`, `大量項目${index}`, 1900 + (index % 100)),
      ),
      [],
    );
    const firstStage = stageNetwork(nodes, [], new Map());
    expect(
      firstStage.nodes.filter((node) => node.kind === "entity"),
    ).toHaveLength(160);
    expect(firstStage.hiddenCount).toBe(840);
    const nextStage = stageNetwork(nodes, [], new Map([["item:type-1", 1]]));
    expect(
      nextStage.nodes.filter((node) => node.kind === "entity"),
    ).toHaveLength(320);
    expect(nextStage.hiddenCount).toBe(680);
  });

  it("creates deterministic, non-overlapping force positions and rectangle edge paths", () => {
    const nodes = buildNetworkNodes(
      [item("a", "A", 1900), item("b", "B", 1901), item("c", "C", 1902)],
      [],
    );
    const edges = buildNetworkEdges([
      relationship("r1", "a", "timeline_item", "b"),
      relationship("r2", "b", "timeline_item", "c"),
    ]);
    const first = layoutNetwork(nodes, edges);
    expect(layoutNetwork(nodes, edges)).toEqual(first);
    for (let left = 0; left < first.length; left += 1) {
      for (let right = left + 1; right < first.length; right += 1) {
        expect(
          Math.hypot(
            first[left]!.x - first[right]!.x,
            first[left]!.y - first[right]!.y,
          ),
        ).toBeGreaterThan(100);
      }
    }
    expect(networkEdgePath(first[0]!, first[1]!)).toMatch(/^M .* Q .*$/);
  });
});
