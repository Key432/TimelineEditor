import { describe, expect, it } from "vitest";

import {
  comparisonRangeSchema,
  createComparisonSavedViewSchema,
} from "@/features/comparison/validation";

const projectId = "11111111-1111-4111-8111-111111111111";
const configuration = {
  version: 1 as const,
  projectIds: [projectId],
  hiddenProjectIds: [],
  visibleStartOrdinal: -100,
  visibleEndOrdinal: 100,
  zoomLevel: 2,
  highlightStartOrdinal: -20,
  highlightEndOrdinal: 20,
  filters: {
    tagNames: ["政治"],
    typeNames: ["人物"],
    eventTypeNames: ["即位"],
  },
};

describe("Phase L18 comparison validation", () => {
  it("accepts a configuration containing settings only", () => {
    const parsed = createComparisonSavedViewSchema.parse({
      name: "王朝比較",
      configuration,
    });
    expect(parsed.configuration.projectIds).toEqual([projectId]);
    expect(parsed.configuration).not.toHaveProperty("items");
    expect(parsed.configuration).not.toHaveProperty("events");
  });

  it("rejects reversed ranges, unrelated hidden projects, and too many projects", () => {
    expect(
      createComparisonSavedViewSchema.safeParse({
        name: "逆転",
        configuration: { ...configuration, visibleStartOrdinal: 101 },
      }).success,
    ).toBe(false);
    expect(
      createComparisonSavedViewSchema.safeParse({
        name: "対象外",
        configuration: {
          ...configuration,
          hiddenProjectIds: ["22222222-2222-4222-8222-222222222222"],
        },
      }).success,
    ).toBe(false);
    expect(
      createComparisonSavedViewSchema.safeParse({
        name: "過剰",
        configuration: {
          ...configuration,
          projectIds: Array.from(
            { length: 7 },
            (_, index) =>
              `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
          ),
        },
      }).success,
    ).toBe(false);
  });

  it("validates finite ordered API ranges", () => {
    expect(comparisonRangeSchema.parse({ from: "-20", to: "40" })).toEqual({
      from: -20,
      to: 40,
    });
    expect(comparisonRangeSchema.safeParse({ from: 10, to: 9 }).success).toBe(
      false,
    );
    expect(
      comparisonRangeSchema.safeParse({ from: "NaN", to: 9 }).success,
    ).toBe(false);
  });
});
