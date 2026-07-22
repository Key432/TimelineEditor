import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/app-shell";
import { QueryProvider } from "@/components/query-provider";

afterEach(cleanup);

describe("AppShell", () => {
  it("renders the authenticated shell and keyboard logout action", async () => {
    const user = userEvent.setup();
    const logoutAction = vi.fn(async () => undefined);

    render(
      <QueryProvider>
        <AppShell email="reader@example.com" logoutAction={logoutAction}>
          <h1>プロジェクト</h1>
        </AppShell>
      </QueryProvider>,
    );

    expect(
      screen.getAllByRole("link", { name: "すべてのプロジェクト" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("reader@example.com")).toBeInTheDocument();

    const logout = screen.getByRole("button", { name: "ログアウト" });
    logout.focus();
    await user.keyboard("{Enter}");
    expect(logoutAction).toHaveBeenCalledOnce();
  });

  it("toggles the sidebar collapsed state when clicking the collapse button", async () => {
    const user = userEvent.setup();
    const logoutAction = vi.fn(async () => undefined);

    render(
      <QueryProvider>
        <AppShell email="reader@example.com" logoutAction={logoutAction}>
          <h1>プロジェクト</h1>
        </AppShell>
      </QueryProvider>,
    );

    const navs = screen.getAllByRole("navigation", {
      name: "メインナビゲーション",
    });
    const nav = navs.find((n) => n.closest("aside")) ?? navs[0];
    const allProjectsLink = within(nav).getByRole("link", {
      name: "すべてのプロジェクト",
    });
    expect(allProjectsLink).toBeVisible();

    const aside = nav.closest("aside");
    const toggle = within(aside as HTMLElement).getByRole("button", {
      name: "サイドパネルを折りたたむ",
    });
    await user.click(toggle);

    expect(aside).toHaveAttribute("aria-hidden", "true");

    await user.click(toggle);
    expect(aside).toHaveAttribute("aria-hidden", "false");
  });

  it("closes the mobile navigation after choosing a project", async () => {
    const user = userEvent.setup();

    render(
      <QueryProvider>
        <AppShell
          logoutAction={vi.fn(async () => undefined)}
          projects={[
            {
              id: "11111111-1111-4111-8111-111111111111",
              name: "日本文学史",
              description: null,
              visibility: "private",
              publicId: null,
              publishedAt: null,
              updatedAt: "2026-07-21T00:00:00Z",
            },
          ]}
        >
          <h1>プロジェクト</h1>
        </AppShell>
      </QueryProvider>,
    );

    await user.click(
      screen.getByRole("button", { name: "ナビゲーションを開く" }),
    );
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("link", { name: "日本文学史" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
