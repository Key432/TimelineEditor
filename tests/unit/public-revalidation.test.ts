import { beforeEach, describe, expect, it, vi } from "vitest";

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { revalidatePublicProject } from "@/lib/public-revalidation";

const project = {
  id: "11111111-1111-4111-8111-111111111111",
  ownerId: "22222222-2222-4222-8222-222222222222",
  name: "公開史",
  description: null,
  visibility: "public" as const,
  publicId: "0123456789abcdef0123456789abcdef",
  publishedAt: "2026-07-30T00:00:00.000Z",
  createdAt: "2026-07-30T00:00:00.000Z",
  updatedAt: "2026-07-30T00:00:00.000Z",
};

describe("public ISR revalidation", () => {
  beforeEach(() => revalidatePath.mockClear());

  it("invalidates the complete public project subtree after a published save", () => {
    revalidatePublicProject(project);
    expect(revalidatePath).toHaveBeenNthCalledWith(
      1,
      "/public/0123456789abcdef0123456789abcdef",
    );
    expect(revalidatePath).toHaveBeenNthCalledWith(
      2,
      "/public/[publicId]/items/[itemId]",
      "page",
    );
    expect(revalidatePath).toHaveBeenNthCalledWith(
      3,
      "/public/[publicId]/events/[eventId]",
      "page",
    );
  });

  it("does not invalidate private projects", () => {
    revalidatePublicProject({
      ...project,
      visibility: "private",
      publicId: null,
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
