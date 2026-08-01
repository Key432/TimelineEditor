import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RelationshipLayer } from "@/features/relationships/relationship-layer";
import { relationshipEndpointKey } from "@/features/relationships/routing";
import type { EntityRelationship } from "@/features/relationships/types";

const relationship: EntityRelationship = {
  id: "33333333-3333-4333-8333-333333333333",
  projectId: "44444444-4444-4444-8444-444444444444",
  sourceType: "timeline_item",
  sourceId: "11111111-1111-4111-8111-111111111111",
  targetType: "timeline_event",
  targetId: "22222222-2222-4222-8222-222222222222",
  relationType: "影響",
  direction: "directed",
  lineStyle: "double",
  sourceMarker: "none",
  targetMarker: "arrow",
  note: "注記",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

const entities = [
  { type: "timeline_item" as const, id: relationship.sourceId, title: "人物A" },
  {
    type: "timeline_event" as const,
    id: relationship.targetId,
    title: "事件B",
  },
];
const anchors = new Map([
  [
    relationshipEndpointKey("timeline_item", relationship.sourceId),
    {
      entityType: "timeline_item" as const,
      entityId: relationship.sourceId,
      x: 80,
      y: 30,
    },
  ],
  [
    relationshipEndpointKey("timeline_event", relationship.targetId),
    {
      entityType: "timeline_event" as const,
      entityId: relationship.targetId,
      x: 260,
      y: 140,
    },
  ],
]);

afterEach(cleanup);

describe("Phase L14 relationship timeline layer", () => {
  it("shows standard relationships in translucent gray and colors them on hover", () => {
    const { rerender } = render(
      <RelationshipLayer
        anchors={anchors}
        entities={entities}
        height={200}
        left={0}
        relationships={[relationship]}
        displayMode="hidden"
        visibleEnd={400}
        visibleStart={0}
        width={400}
      />,
    );
    expect(screen.queryByRole("button", { name: /人物Aと事件B/ })).toBeNull();

    rerender(
      <RelationshipLayer
        anchors={anchors}
        entities={entities}
        height={200}
        relationships={[relationship]}
        displayMode="standard"
        visibleEnd={400}
        visibleStart={0}
        width={400}
      />,
    );
    const line = screen.getByRole("button", { name: /人物Aと事件B.*影響/ });
    const visibleLine = screen.getByTestId(
      `relationship-stroke-${relationship.id}`,
    );
    expect(visibleLine).toHaveAttribute("stroke", "rgba(107, 114, 128, 0.42)");
    fireEvent.mouseEnter(line);
    expect(visibleLine).toHaveAttribute("stroke", "#FF3399");
    fireEvent.click(line);
    expect(screen.getByText("注記")).toBeInTheDocument();
  });

  it("shows colored relationships in all mode only when an endpoint is visible", () => {
    const { rerender } = render(
      <RelationshipLayer
        anchors={anchors}
        entities={entities}
        height={200}
        relationships={[relationship]}
        displayMode="all"
        visibleEnd={300}
        visibleStart={0}
        width={400}
      />,
    );
    expect(
      screen.getByRole("button", { name: /人物Aと事件B/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`relationship-stroke-${relationship.id}`),
    ).toHaveAttribute("stroke", "#007F7F");
    rerender(
      <RelationshipLayer
        anchors={anchors}
        entities={entities}
        height={200}
        relationships={[relationship]}
        displayMode="all"
        visibleEnd={700}
        visibleStart={500}
        width={400}
      />,
    );
    expect(screen.queryByRole("button", { name: /人物Aと事件B/ })).toBeNull();
  });

  it("clips relationship strokes to the currently visible timeline canvas", () => {
    render(
      <RelationshipLayer
        anchors={anchors}
        displayMode="standard"
        entities={entities}
        height={200}
        relationships={[relationship]}
        visibleEnd={300}
        visibleStart={50}
        width={400}
      />,
    );

    expect(screen.getByTestId("relationship-layer")).toHaveStyle({
      clipPath: "inset(0px 100px 0px 50px)",
    });
  });
});
