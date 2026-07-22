import { describe, expect, it } from "vitest";

import { globalSearchSchema } from "@/features/search/validation";
import { searchExcerpt } from "@/lib/repositories/search-repository";

describe("search validation and excerpts", () => {
  it("accepts Japanese queries and normalizes pagination", () => {
    expect(
      globalSearchSchema.parse({
        q: "  夏目漱石  ",
        page: "2",
        pageSize: "12",
      }),
    ).toEqual({ q: "夏目漱石", page: 2, pageSize: 12 });
  });

  it("rejects blank, oversized, invalid type, and oversized pages", () => {
    expect(globalSearchSchema.safeParse({ q: " " }).success).toBe(false);
    expect(globalSearchSchema.safeParse({ q: "a".repeat(101) }).success).toBe(
      false,
    );
    expect(
      globalSearchSchema.safeParse({ q: "文学", type: "owner" }).success,
    ).toBe(false);
    expect(
      globalSearchSchema.safeParse({ q: "文学", pageSize: 51 }).success,
    ).toBe(false);
  });

  it("extracts plain text around a Japanese match", () => {
    const excerpt = searchExcerpt(
      `${"前置き".repeat(40)} 吾輩は猫である ${"後続".repeat(100)}`,
      "吾輩 猫",
    );
    expect(excerpt).toContain("吾輩は猫である");
    expect(excerpt.startsWith("…")).toBe(true);
    expect(excerpt.endsWith("…")).toBe(true);
  });
});
