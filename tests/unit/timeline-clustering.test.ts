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

  it("keeps markers about one year apart separate at the century zoom scale", () => {
    const groups = clusterTimelineMarkers([
      marker("1968", 0),
      marker("1969", 10.9),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("merges a cluster with a regular marker that its larger glyph would overlap", () => {
    const groups = clusterTimelineMarkers([
      marker("cluster-a", 0),
      marker("cluster-b", 1),
      marker("regular", 12),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.markers.map((entry) => entry.value)).toEqual([
      "cluster-a",
      "cluster-b",
      "regular",
    ]);
  });

  it("merges neighboring clusters when their larger glyphs would overlap", () => {
    const groups = clusterTimelineMarkers([
      marker("left-a", 0),
      marker("left-b", 1),
      marker("right-a", 20),
      marker("right-b", 21),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.markers).toHaveLength(4);
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
