import { describe, expect, it } from "vitest";

import {
  createItemTypeSchema,
  updateItemTypeSchema,
} from "@/features/item-types/validation";

describe("item type validation", () => {
  it("normalizes names, colors, and empty icons", () => {
    const result = createItemTypeSchema.parse({
      name: "  文学   運動  ",
      defaultColor: "#aabbcc",
      icon: " ",
    });

    expect(result).toEqual({
      name: "文学 運動",
      defaultColor: "#AABBCC",
      icon: null,
    });
  });

  it.each(["#fff", "00B0B0", "#GG0000"])(
    "rejects the invalid color %s",
    (defaultColor) => {
      expect(
        createItemTypeSchema.safeParse({
          name: "人物",
          defaultColor,
          icon: "",
        }).success,
      ).toBe(false);
    },
  );

  it("requires at least one update field", () => {
    expect(updateItemTypeSchema.safeParse({}).success).toBe(false);
    expect(updateItemTypeSchema.safeParse({ isVisible: false }).success).toBe(
      true,
    );
  });

  it("rejects a negative sort position", () => {
    expect(updateItemTypeSchema.safeParse({ sortOrder: -1 }).success).toBe(
      false,
    );
  });

  it("keeps reordering separate from content updates", () => {
    expect(
      updateItemTypeSchema.safeParse({
        name: "人物",
        sortOrder: 1,
      }).success,
    ).toBe(false);
  });
});
