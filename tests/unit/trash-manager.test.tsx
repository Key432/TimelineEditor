import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TrashManager } from "@/features/history/trash-manager";

const mocks = vi.hoisted(() => ({
  listTrash: vi.fn(),
  purgeTrashEntry: vi.fn(),
  restoreTrashEntry: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("@/features/history/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/history/api")>()),
  listTrash: mocks.listTrash,
  purgeTrashEntry: mocks.purgeTrashEntry,
  restoreTrashEntry: mocks.restoreTrashEntry,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("TrashManager", () => {
  it("restores and permanently deletes explicit trash entries", async () => {
    const entries = [
      {
        entityType: "timeline_item" as const,
        entityId: "22222222-2222-4222-8222-222222222222",
        title: "復元対象",
        deletedAt: "2026-07-28T08:00:00.000Z",
      },
      {
        entityType: "timeline_event" as const,
        entityId: "33333333-3333-4333-8333-333333333333",
        title: "完全削除対象",
        deletedAt: "2026-07-28T07:00:00.000Z",
      },
    ];
    mocks.listTrash.mockResolvedValue(entries);
    mocks.restoreTrashEntry.mockResolvedValue({ restored: true });
    mocks.purgeTrashEntry.mockResolvedValue(undefined);
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
        <TrashManager projectId="11111111-1111-4111-8111-111111111111" />
      </QueryClientProvider>,
    );

    const restoreEntry = (await screen.findByText("復元対象")).closest("li");
    expect(restoreEntry).not.toBeNull();
    await user.click(
      within(restoreEntry as HTMLElement).getByRole("button", { name: "復元" }),
    );
    await waitFor(() => expect(mocks.restoreTrashEntry).toHaveBeenCalledOnce());
    const purgeEntry = screen.getByText("完全削除対象").closest("li");
    expect(purgeEntry).not.toBeNull();
    await user.click(
      within(purgeEntry as HTMLElement).getByRole("button", {
        name: "完全削除",
      }),
    );
    await waitFor(() => expect(mocks.purgeTrashEntry).toHaveBeenCalledOnce());
  });
});
