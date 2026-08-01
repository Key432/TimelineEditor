import { describe, expect, it } from "vitest";

import {
  buildOrthogonalRelationshipPath,
  relationshipEndpointKey,
} from "@/features/relationships/routing";

describe("Phase L14 orthogonal relationship routing", () => {
  it("uses only horizontal and vertical segments", () => {
    const path = buildOrthogonalRelationshipPath(
      { x: 120, y: 44 },
      { x: 420, y: 196 },
      18,
    );
    expect(path.points[0]).toEqual({ x: 120, y: 44 });
    expect(path.points.at(-1)).toEqual({ x: 420, y: 196 });
    for (let index = 1; index < path.points.length; index += 1) {
      const before = path.points[index - 1]!;
      const current = path.points[index]!;
      expect(before.x === current.x || before.y === current.y).toBe(true);
    }
    expect(path.d).not.toMatch(/[CQAST]/);
  });

  it("keeps polymorphic item and event endpoints distinct", () => {
    expect(relationshipEndpointKey("timeline_item", "same-id")).not.toBe(
      relationshipEndpointKey("timeline_event", "same-id"),
    );
  });
});
