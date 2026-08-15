import { describe, expect, it } from "vitest";

import {
  comparisonPaneHeight,
  moveComparedProject,
} from "@/features/comparison/comparison-layout";

const ids = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
];

describe("Phase L18 timeline comparison layout", () => {
  it("fits at most four timeline panes in the visible comparison area", () => {
    expect(comparisonPaneHeight(1)).toBe("100%");
    expect(comparisonPaneHeight(3)).toBe("33.333333333333336%");
    expect(comparisonPaneHeight(4)).toBe("25%");
    expect(comparisonPaneHeight(5)).toBe("25%");
  });

  it("reorders compared projects while preserving every selection", () => {
    expect(moveComparedProject(ids, ids[0]!, ids[2]!)).toEqual([
      ids[1],
      ids[2],
      ids[0],
      ids[3],
    ]);
    expect(moveComparedProject(ids, ids[0]!, "missing")).toEqual(ids);
  });
});
