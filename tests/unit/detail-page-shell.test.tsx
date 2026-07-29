import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { DetailPageShell } from "@/features/timeline-items/detail-page-shell";
import { DetailEditShell } from "@/features/timeline-items/detail-edit-shell";

describe("DetailPageShell", () => {
  it("keeps search and timeline routes while placing detail options on the breadcrumb row", () => {
    const { container } = render(
      <DetailPageShell
        projectId="project-id"
        projectName="文学史"
        returnTo="/search?q=猫"
        title="代表作刊行"
      >
        <DetailEditShell
          placement="page"
          preferenceKey="/projects/project-id/items/item-id"
          readOnly
        >
          <article>詳細</article>
        </DetailEditShell>
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

    expect(view.getByRole("button", { name: "詳細オプション" })).toBeVisible();
    expect(container.firstElementChild).toHaveClass("relative", "max-w-none");
    expect(
      view.queryByRole("button", { name: "左右の余白を縮小" }),
    ).not.toBeInTheDocument();
  });

  it("uses the linked timeline item as the event breadcrumb parent", () => {
    const { container } = render(
      <DetailPageShell
        breadcrumbParent={{
          href: "/projects/project-id/items/item-id",
          label: "ヴィクトル・セガレン",
        }}
        projectId="project-id"
        projectName="文学史"
        returnTo={null}
        title="『記憶なき人々』"
      >
        <article>詳細</article>
      </DetailPageShell>,
    );

    const breadcrumb = within(container).getByRole("navigation", {
      name: "パンくず",
    });
    expect(
      within(breadcrumb).getByRole("link", { name: "ヴィクトル・セガレン" }),
    ).toHaveAttribute("href", "/projects/project-id/items/item-id");
    expect(within(breadcrumb).getByText("『記憶なき人々』")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(breadcrumb).queryByText("文学史")).not.toBeInTheDocument();
  });

  it("lists equal-status event parents in manual order from a collapsed breadcrumb", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DetailPageShell
        breadcrumbParents={[
          { href: "/projects/project-id/items/second", label: "手動順1" },
          { href: "/projects/project-id/items/first", label: "手動順2" },
        ]}
        projectId="project-id"
        projectName="文学史"
        returnTo={null}
        title="共通イベント"
      >
        <article>詳細</article>
      </DetailPageShell>,
    );
    const breadcrumb = within(container).getByRole("navigation", {
      name: "パンくず",
    });
    await user.click(
      within(breadcrumb).getByRole("button", {
        name: "親タイムラインアイテムを選択",
      }),
    );
    const links = within(within(document.body).getByRole("menu")).getAllByRole(
      "menuitem",
    );
    expect(links.map((link) => link.textContent)).toEqual([
      "手動順1",
      "手動順2",
    ]);
  });
});
