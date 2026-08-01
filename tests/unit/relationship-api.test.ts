import { afterEach, describe, expect, it, vi } from "vitest";

import { deleteRelationship } from "@/features/relationships/api";

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
});
