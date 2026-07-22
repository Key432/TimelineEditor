import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { DetailPageShell } from "@/features/timeline-items/detail-page-shell";

describe("DetailPageShell", () => {
  it("keeps search and timeline routes while toggling horizontal margins", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DetailPageShell
        projectId="project-id"
        projectName="文学史"
        returnTo="/search?q=猫"
        title="代表作刊行"
      >
        <article>詳細</article>
      </DetailPageShell>,
    );
    const view = within(container);
    expect(view.getByRole("link", { name: "検索結果" })).toHaveAttribute(
      "href",
      "/search?q=猫",
    );
    expect(
      view.getByRole("link", { name: "タイムラインを表示" }),
    ).toHaveAttribute("href", "/projects/project-id/timeline");

    const toggle = view.getByRole("button", { name: "左右の余白を縮小" });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(container.firstElementChild).toHaveClass("max-w-[1400px]");
  });
});
