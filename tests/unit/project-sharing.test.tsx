import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QueryProvider } from "@/components/query-provider";
import { ProjectSharing } from "@/features/projects/project-sharing";
import type { Project } from "@/features/projects/types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const project: Project = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "文学史",
  description: null,
  visibility: "private",
  publicId: null,
  publishedAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  settings: {
    defaultUncertaintyYears: 5,
    initialStartYear: 1800,
    initialEndYear: 2026,
    initialZoomPreset: "fit-range",
    timelineDensity: "comfortable",
    minimumTimeUnit: "day",
  },
};

describe("ProjectSharing", () => {
  it("confirms publication and exposes copy and new-tab actions", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          project: {
            ...project,
            visibility: "public",
            publicId: "a".repeat(32),
            publishedAt: "2026-07-23T00:00:00Z",
          },
        }),
        { status: 200 },
      ),
    );
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(
      <QueryProvider>
        <ProjectSharing project={project} />
      </QueryProvider>,
    );

    await user.click(screen.getByRole("button", { name: "公開する" }));
    expect(screen.getByText(/noindexは検索結果/)).toBeVisible();
    await user.click(
      screen.getAllByRole("button", { name: "公開する" }).at(-1)!,
    );
    expect(await screen.findByDisplayValue(/\/public\/a{32}$/)).toBeVisible();
    expect(screen.getByRole("link", { name: "別タブで表示" })).toHaveAttribute(
      "target",
      "_blank",
    );
    await user.click(screen.getByRole("button", { name: "コピー" }));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringMatching(/\/public\/a{32}$/),
    );
  });
});
