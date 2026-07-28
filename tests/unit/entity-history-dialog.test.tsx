import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EntityHistoryDialog } from "@/features/history/entity-history-dialog";

const mocks = vi.hoisted(() => ({
  createCheckpoint: vi.fn(),
  listEntityHistory: vi.fn(),
  restoreHistory: vi.fn(),
}));

vi.mock("@/features/history/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/history/api")>()),
  createCheckpoint: mocks.createCheckpoint,
  listEntityHistory: mocks.listEntityHistory,
  restoreHistory: mocks.restoreHistory,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("EntityHistoryDialog", () => {
  it("shows saved field diffs and exposes checkpoint and restore actions", async () => {
    mocks.listEntityHistory.mockResolvedValue([
      {
        id: "33333333-3333-4333-8333-333333333333",
        projectId: "11111111-1111-4111-8111-111111111111",
        entityType: "timeline_item",
        entityId: "22222222-2222-4222-8222-222222222222",
        revision: 1,
        changes: {
          description: { before: "変更前の本文", after: "変更後の本文" },
        },
        operation: "update",
        isCheckpoint: false,
        createdAt: "2026-07-28T08:00:00.000Z",
      },
    ]);
    mocks.createCheckpoint.mockResolvedValue({});
    mocks.restoreHistory.mockResolvedValue({ restored: true });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <EntityHistoryDialog
          entityId="22222222-2222-4222-8222-222222222222"
          entityType="timeline_item"
          projectId="11111111-1111-4111-8111-111111111111"
        />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole("button", { name: "変更履歴" }));
    expect(await screen.findByText("変更前の本文")).toBeVisible();
    expect(screen.getByText("変更後の本文")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "チェックポイントを作成" }),
    );
    await waitFor(() => expect(mocks.createCheckpoint).toHaveBeenCalledOnce());
    await user.click(screen.getByRole("button", { name: "この版へ復元" }));
    await waitFor(() =>
      expect(mocks.restoreHistory).toHaveBeenCalledWith(
        "11111111-1111-4111-8111-111111111111",
        "33333333-3333-4333-8333-333333333333",
      ),
    );
  });
});
