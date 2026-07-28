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

import { DeleteTimelineItemDialog } from "@/features/timeline-items/delete-timeline-item-dialog";

const mocks = vi.hoisted(() => ({
  deleteTimelineItem: vi.fn(),
  back: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: mocks.back,
    push: mocks.push,
    refresh: mocks.refresh,
    replace: mocks.replace,
  }),
}));

vi.mock("@/features/timeline-items/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/timeline-items/api")>()),
  deleteTimelineItem: mocks.deleteTimelineItem,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DeleteTimelineItemDialog", () => {
  it("closes a timeline modal with one replace navigation after deletion", async () => {
    mocks.deleteTimelineItem.mockResolvedValueOnce(undefined);
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <DeleteTimelineItemDialog
          closeOverlayAfterDelete
          redirectAfterDelete
          itemId="33333333-3333-4333-8333-333333333333"
          projectId="22222222-2222-4222-8222-222222222222"
          title="削除対象"
        />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole("button", { name: "ゴミ箱へ移動" }));
    const confirmation = screen.getByRole("alertdialog");
    await user.click(
      within(confirmation).getByRole("button", { name: "ゴミ箱へ移動" }),
    );

    await waitFor(() => expect(mocks.back).toHaveBeenCalledOnce());
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
