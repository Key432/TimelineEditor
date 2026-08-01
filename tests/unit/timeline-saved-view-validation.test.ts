import { describe, expect, it } from "vitest";

import { DEFAULT_TIMELINE_FILTERS } from "@/features/timeline-items/timeline-filters";
import { createTimelineSavedViewSchema } from "@/features/timeline-views/validation";

const configuration = {
  version: 1 as const,
  visibleStartOrdinal: 100,
  visibleEndOrdinal: 200,
  zoomLevel: 2,
  scrollLeft: 120,
  filters: DEFAULT_TIMELINE_FILTERS,
  sortMode: "manual" as const,
  sortDirection: "asc" as const,
  groupByType: false,
  layoutMode: "row" as const,
  density: "comfortable" as const,
  tags: [],
  backgroundLayerIds: [],
  showRelationships: false,
  visibleColumns: [],
};

describe("timeline saved view validation", () => {
  it("accepts a compact configuration without duplicated timeline data", () => {
    expect(
      createTimelineSavedViewSchema.parse({ name: "明治期", configuration }),
    ).toEqual({ name: "明治期", configuration });
  });

  it("stores selected background layer ids without storing rendered periods", () => {
    const backgroundLayerId = "11111111-1111-4111-8111-111111111111";
    const parsed = createTimelineSavedViewSchema.parse({
      name: "時代背景付き",
      configuration: {
        ...configuration,
        backgroundLayerIds: [backgroundLayerId],
      },
    });
    expect(parsed.configuration.backgroundLayerIds).toEqual([
      backgroundLayerId,
    ]);
    expect(parsed.configuration).not.toHaveProperty("backgroundPeriods");
  });

  it("rejects reversed ranges and oversized names", () => {
    expect(
      createTimelineSavedViewSchema.safeParse({
        name: "x".repeat(81),
        configuration,
      }).success,
    ).toBe(false);
    expect(
      createTimelineSavedViewSchema.safeParse({
        name: "不正",
        configuration: { ...configuration, visibleStartOrdinal: 300 },
      }).success,
    ).toBe(false);
  });
});
