import { describe, expect, it } from "vitest";

import { relationshipInputSchema } from "@/features/relationships/validation";

const base = {
  sourceType: "timeline_item" as const,
  sourceId: "11111111-1111-4111-8111-111111111111",
  targetType: "timeline_event" as const,
  targetId: "22222222-2222-4222-8222-222222222222",
  relationType: "影響",
  lineStyle: "single" as const,
  sourceMarker: "none" as const,
  targetMarker: "arrow" as const,
  note: null,
};

describe("Phase L14 relationship validation", () => {
  it("accepts Japanese defaults and freely-created relationship types", () => {
    expect(relationshipInputSchema.safeParse(base).success).toBe(true);
    expect(
      relationshipInputSchema.safeParse({
        ...base,
        relationType: "翻案・再構成",
        lineStyle: "double",
        sourceMarker: "arrow",
      }).success,
    ).toBe(true);
  });

  it("rejects self-relations, empty types, and oversized notes", () => {
    expect(
      relationshipInputSchema.safeParse({
        ...base,
        targetType: base.sourceType,
        targetId: base.sourceId,
      }).success,
    ).toBe(false);
    expect(
      relationshipInputSchema.safeParse({ ...base, relationType: "   " })
        .success,
    ).toBe(false);
    expect(
      relationshipInputSchema.safeParse({ ...base, note: "あ".repeat(2001) })
        .success,
    ).toBe(false);
  });
});
