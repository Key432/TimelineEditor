import { describe, expect, it } from "vitest";

import { clusterTimelineMarkers } from "@/features/timeline-events/clustering";

function marker(id: string, x: number) {
  return { x, value: id };
}

describe("clusterTimelineMarkers", () => {
  it("clusters markers with identical coordinates", () => {
    const groups = clusterTimelineMarkers([marker("a", 10), marker("b", 10)]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.markers.map((entry) => entry.value)).toEqual(["a", "b"]);
  });

  it("clusters marker borders that exactly touch", () => {
    const groups = clusterTimelineMarkers(
      [marker("a", 0), marker("b", 18)],
      18,
      0,
    );
    expect(groups).toHaveLength(1);
  });

  it("uses collision padding and keeps markers outside it separate", () => {
    expect(
      clusterTimelineMarkers([marker("a", 0), marker("b", 20)], 18, 2),
    ).toHaveLength(1);
    expect(
      clusterTimelineMarkers([marker("a", 0), marker("b", 20.01)], 18, 2),
    ).toHaveLength(2);
  });

  it("forms one cluster through chained collisions", () => {
    const groups = clusterTimelineMarkers(
      [marker("c", 40), marker("a", 0), marker("b", 20)],
      18,
      2,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.markers.map((entry) => entry.value)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("automatically separates markers when zoom increases their spacing", () => {
    expect(
      clusterTimelineMarkers([marker("a", 0), marker("b", 10)]),
    ).toHaveLength(1);
    expect(
      clusterTimelineMarkers([marker("a", 0), marker("b", 40)]),
    ).toHaveLength(2);
  });
});
