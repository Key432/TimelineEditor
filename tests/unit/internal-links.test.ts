import { describe, expect, it } from "vitest";

import {
  extractInternalLinkReferences,
  internalLinkToken,
  renderInternalLinks,
} from "@/features/internal-links/markdown";

const itemId = "11111111-1111-4111-8111-111111111111";
const eventId = "22222222-2222-4222-8222-222222222222";

describe("internal link Markdown", () => {
  it("extracts stable IDs once and normalizes a selected candidate", () => {
    expect(
      extractInternalLinkReferences(
        `[[item:${itemId}|旧名]] [[item:${itemId}|別表示]] [[event:${eventId}|出来事]]`,
      ),
    ).toEqual({ itemIds: [itemId], eventIds: [eventId] });
    expect(
      internalLinkToken({
        entityType: "item",
        entityId: itemId,
        title: "夏目漱石",
      }),
    ).toBe(`[[item:${itemId}|夏目漱石]]`);
  });

  it("renders resolved IDs as project links and preserves broken text", () => {
    const source = `[[item:${itemId}|旧表示名]] / [[event:${eventId}|削除済み]]`;
    expect(
      renderInternalLinks(
        source,
        [{ entityType: "item", entityId: itemId, title: "変更後の名称" }],
        "/projects/project-id",
      ),
    ).toBe(
      `[旧表示名](/projects/project-id/items/${itemId}) / 削除済み（リンク切れ）`,
    );
  });
});
