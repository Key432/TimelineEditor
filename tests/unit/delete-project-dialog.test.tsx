import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DeleteProjectDialog } from "@/features/projects/delete-project-dialog";

const mocks = vi.hoisted(() => ({
  deleteProject: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));

vi.mock("@/features/projects/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/projects/api")>()),
  deleteProject: mocks.deleteProject,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

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

  it("blocks the screen until deletion completes and then opens the project list", async () => {
    let completeDeletion: (() => void) | undefined;
    mocks.deleteProject.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        completeDeletion = resolve;
      }),
    );
    const user = userEvent.setup();
    renderDialog();

    await user.click(
      screen.getByRole("button", { name: "プロジェクトを完全削除" }),
    );
    await user.type(screen.getByLabelText("プロジェクト名"), "文学史");
    await user.click(screen.getByRole("button", { name: "完全に削除" }));

    expect(
      screen.getByRole("status", { name: "プロジェクトを削除しています" }),
    ).toBeVisible();
    await user.keyboard("{Escape}");
    expect(
      screen.getByRole("heading", {
        name: "プロジェクトを完全に削除しますか？",
      }),
    ).toBeVisible();
    expect(mocks.replace).not.toHaveBeenCalled();

    completeDeletion?.();
    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith("/projects"),
    );
  });
});
