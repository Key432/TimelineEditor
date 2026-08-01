import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { QueryProvider } from "@/components/query-provider";
import { RelationshipManager } from "@/features/relationships/relationship-manager";
import type { RelationshipDataset } from "@/features/relationships/types";

const dataset: RelationshipDataset = {
  entities: [
    { type: "timeline_item", id: "item-a", title: "AAAA" },
    { type: "timeline_item", id: "item-b", title: "BBBB" },
  ],
  relationships: [
    {
      id: "relationship-1",
      projectId: "project-1",
      sourceType: "timeline_item",
      sourceId: "item-a",
      targetType: "timeline_item",
      targetId: "item-b",
      relationType: "影響",
      direction: "directed",
      lineStyle: "single",
      sourceMarker: "none",
      targetMarker: "arrow",
      note: null,
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-01T00:00:00Z",
    },
  ],
};

afterEach(cleanup);

describe("relationship detail display", () => {
  it("renders a read-only semantic row with links to both detail pages", () => {
    render(
      <QueryProvider>
        <RelationshipManager
          basePath="/projects/project-1"
          entity={{ type: "timeline_item", id: "item-a" }}
          initialData={dataset}
          projectId="project-1"
          readOnly
        />
      </QueryProvider>,
    );

    expect(screen.getByText("影響", { exact: true })).toBeVisible();
    expect(screen.getByLabelText("関係の向き")).toHaveTextContent("⇒");
    expect(screen.getByRole("link", { name: "AAAA" })).toHaveAttribute(
      "href",
      "/projects/project-1/items/item-a",
    );
    expect(screen.getByRole("link", { name: "BBBB" })).toHaveAttribute(
      "href",
      "/projects/project-1/items/item-b",
    );
    expect(screen.queryByRole("button", { name: "編集" })).toBeNull();
    expect(screen.queryByRole("button", { name: "関係性を追加" })).toBeNull();
  });
});
