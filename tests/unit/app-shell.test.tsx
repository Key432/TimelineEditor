import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/app-shell";

describe("AppShell", () => {
  it("renders the authenticated shell and keyboard logout action", async () => {
    const user = userEvent.setup();
    const logoutAction = vi.fn(async () => undefined);

    render(
      <AppShell email="reader@example.com" logoutAction={logoutAction}>
        <h1>プロジェクト</h1>
      </AppShell>,
    );

    expect(
      screen.getAllByRole("link", { name: "プロジェクト" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("reader@example.com")).toBeInTheDocument();

    const logout = screen.getByRole("button", { name: "ログアウト" });
    logout.focus();
    await user.keyboard("{Enter}");
    expect(logoutAction).toHaveBeenCalledOnce();
  });
});
