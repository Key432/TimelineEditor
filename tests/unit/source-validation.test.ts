import { describe, expect, it } from "vitest";

import {
  sourceCitationsSchema,
  sourceSchema,
} from "@/features/sources/validation";

describe("structured source validation", () => {
  it("normalizes optional bibliography fields", () => {
    expect(
      sourceSchema.parse({
        title: "  日本文学史  ",
        authors: [" 夏目 金之助 "],
        publisher: "",
        publicationYear: "1905",
        isbn: "",
        url: "",
        accessedOn: "",
        citationKey: "soseki1905",
        notes: "",
      }),
    ).toMatchObject({
      title: "日本文学史",
      authors: ["夏目 金之助"],
      publicationYear: 1905,
      publisher: null,
      url: null,
    });
  });

  it("rejects unsafe URLs and duplicate source links", () => {
    expect(
      sourceSchema.safeParse({
        title: "資料",
        authors: [],
        url: "javascript:alert(1)",
      }).success,
    ).toBe(false);
    const sourceId = "11111111-1111-4111-8111-111111111111";
    expect(
      sourceCitationsSchema.safeParse([{ sourceId }, { sourceId, pages: "12" }])
        .success,
    ).toBe(false);
  });
});
