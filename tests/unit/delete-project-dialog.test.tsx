import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DeleteProjectDialog } from "@/features/projects/delete-project-dialog";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

function renderDialog() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DeleteProjectDialog
        projectId="550e8400-e29b-41d4-a716-446655440000"
        projectName="文学史"
      />
    </QueryClientProvider>,
  );
}

describe("DeleteProjectDialog", () => {
  it("requires the exact project name and closes with Escape", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(
      screen.getByRole("button", { name: "プロジェクトを完全削除" }),
    );
    const deleteButton = screen.getByRole("button", { name: "完全に削除" });
    expect(deleteButton).toBeDisabled();

    await user.type(screen.getByLabelText("プロジェクト名"), "文学");
    expect(deleteButton).toBeDisabled();
    await user.type(screen.getByLabelText("プロジェクト名"), "史");
    expect(deleteButton).toBeEnabled();

    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("heading", {
        name: "プロジェクトを完全に削除しますか？",
      }),
    ).not.toBeInTheDocument();
  });
});
