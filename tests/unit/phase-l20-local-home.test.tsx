import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocalHome } from "@/features/local-projects/local-home";
import { createLocalProject } from "@/features/local-projects/model";
import { listLocalProjects } from "@/features/local-projects/store";

vi.mock("@/features/local-projects/store", () => ({
  listLocalProjects: vi.fn(),
  putLocalProject: vi.fn(),
  deleteLocalProject: vi.fn(),
  estimateLocalStorage: vi.fn().mockResolvedValue({
    usage: 0,
    quota: 1_000_000,
    projectBytes: 1_000,
    isNearLimit: false,
  }),
}));

vi.mock("@/features/timeline-items/timeline-workspace", () => ({
  TimelineWorkspace: () => <div data-testid="timeline-workspace" />,
}));

describe("Phase L20 LocalHome", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    const localStorage: Storage = {
      get length() {
        return values.size;
      },
      clear: () => values.clear(),
      getItem: (key) => values.get(key) ?? null,
      key: (index) => [...values.keys()][index] ?? null,
      removeItem: (key) => values.delete(key),
      setItem: (key, value) => values.set(key, value),
    };
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: localStorage,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders item and event editors with unique keys", async () => {
    vi.mocked(listLocalProjects).mockResolvedValue([
      createLocalProject({ name: "キー確認", template: "empty" }),
    ]);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    render(<LocalHome />);
    await screen.findByRole("heading", { name: "キー確認" });

    expect(
      consoleError.mock.calls.some((call) =>
        call.some((value) => String(value).includes("same key")),
      ),
    ).toBe(false);
  });

  it("dismisses the remote-mode callout and remembers the choice", async () => {
    vi.mocked(listLocalProjects).mockResolvedValue([]);
    const user = userEvent.setup();
    render(<LocalHome />);
    const callout = await screen.findByRole("note", {
      name: "ログインするとできること",
    });

    await user.click(screen.getByRole("button", { name: "案内を閉じる" }));
    await waitFor(() => expect(callout).not.toBeInTheDocument());
    expect(
      window.localStorage.getItem("timeline-editor:hide-login-callout:v1"),
    ).toBe("true");
  });
});
