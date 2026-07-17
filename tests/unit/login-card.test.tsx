import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LoginCard } from "@/features/auth/login-card";

describe("LoginCard", () => {
  it("offers a keyboard-accessible Google login action", async () => {
    const user = userEvent.setup();
    const loginAction = vi.fn(async () => undefined);

    render(<LoginCard loginAction={loginAction} />);

    await user.tab();
    const button = screen.getByRole("button", { name: "Googleでログイン" });
    expect(button).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(loginAction).toHaveBeenCalledOnce();
  });

  it("announces authentication errors", () => {
    render(
      <LoginCard
        errorMessage="認証を完了できませんでした。"
        loginAction={async () => undefined}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "認証を完了できませんでした。",
    );
  });
});
