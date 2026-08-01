import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDraftRelationships,
  deleteRelationship,
} from "@/features/relationships/api";

describe("Phase L14 relationship API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("accepts a successful 204 delete response without parsing JSON", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      deleteRelationship("project", "relationship"),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/project/relationships/relationship",
      { method: "DELETE" },
    );
  });

  it("creates new-entity relationship drafts and reports partial failures", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          relationship: {
            id: "relationship-1",
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json(
          { error: { message: "関係先が見つかりません。" } },
          { status: 404 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const failures = await createDraftRelationships(
      "project",
      "timeline_item",
      "new-item",
      [
        {
          targetType: "timeline_item",
          targetId: "target-1",
          relationType: "影響",
          lineStyle: "single",
          sourceMarker: "none",
          targetMarker: "arrow",
          note: null,
        },
        {
          targetType: "timeline_event",
          targetId: "missing",
          relationType: "参照",
          lineStyle: "double",
          sourceMarker: "none",
          targetMarker: "none",
          note: null,
        },
      ],
    );

    expect(failures).toEqual([
      { label: "参照", reason: "関係先が見つかりません。" },
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/projects/project/relationships",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"sourceId":"new-item"'),
      }),
    );
  });
});
