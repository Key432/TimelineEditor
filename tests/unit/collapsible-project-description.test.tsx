import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CollapsibleProjectDescription } from "@/features/projects/collapsible-project-description";

const scrollHeight = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollHeight",
);
const clientHeight = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "clientHeight",
);

describe("CollapsibleProjectDescription", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get: () => 40,
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get: () => 20,
    });
  });

  afterEach(() => {
    if (scrollHeight) {
      Object.defineProperty(
        HTMLElement.prototype,
        "scrollHeight",
        scrollHeight,
      );
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "scrollHeight");
    }
    if (clientHeight) {
      Object.defineProperty(
        HTMLElement.prototype,
        "clientHeight",
        clientHeight,
      );
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
    }
  });

  it("shows a one-line description until the user expands it", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <CollapsibleProjectDescription description="長いプロジェクト説明" />,
    );
    const view = within(container);
    const paragraph = view.getByText("長いプロジェクト説明");
    expect(paragraph).toHaveClass("line-clamp-1");
    await user.click(view.getByRole("button", { name: "続きを読む" }));
    expect(paragraph).not.toHaveClass("line-clamp-1");
    expect(view.getByRole("button", { name: "閉じる" })).toBeVisible();
  });
});
