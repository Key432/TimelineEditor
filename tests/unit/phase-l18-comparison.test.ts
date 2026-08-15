import { describe, expect, it } from "vitest";

import {
  comparisonPaneHeight,
  replaceComparedProject,
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

  it("replaces a lower pane without allowing duplicate projects", () => {
    expect(replaceComparedProject(ids.slice(0, 3), 1, ids[3]!)).toEqual([
      ids[0],
      ids[3],
      ids[2],
    ]);
    expect(replaceComparedProject(ids.slice(0, 3), 1, ids[0]!)).toEqual(
      ids.slice(0, 3),
    );
  });
});
