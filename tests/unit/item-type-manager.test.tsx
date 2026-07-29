import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ItemTypeManager } from "@/features/item-types/item-type-manager";

const projectId = "550e8400-e29b-41d4-a716-446655440000";

function renderManager() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ItemTypeManager initialItemTypes={[]} projectId={projectId} />
    </QueryClientProvider>,
  );
}

describe("ItemTypeManager", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("creates an unmatched combobox value with Enter", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            itemType: {
              id: crypto.randomUUID(),
              projectId,
              name: "建築",
              defaultColor: "#00B0B0",
              icon: null,
              sortOrder: 0,
              isVisible: true,
              isSystemSeed: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ itemTypes: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const user = userEvent.setup();
    renderManager();

    const combobox = screen.getByRole("combobox", {
      name: "タイムライン種別を検索・新規作成",
    });
    await user.click(screen.getByRole("button", { name: "作品アイコン" }));
    expect(
      screen.getByRole("button", { name: "作品アイコン" }),
    ).toHaveAttribute("aria-pressed", "true");
    await user.type(combobox, "建築{Enter}");

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(`/api/projects/${projectId}/item-types`);
    expect(init).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      name: "建築",
      icon: "image",
    });
  });

  it("does not offer creation for an existing normalized name", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { staleTime: Infinity } },
          })
        }
      >
        <ItemTypeManager
          projectId={projectId}
          initialItemTypes={[
            {
              id: crypto.randomUUID(),
              projectId,
              name: "文学 運動",
              defaultColor: "#8B5CF6",
              icon: "sparkles",
              sortOrder: 0,
              isVisible: true,
              isSystemSeed: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ]}
        />
      </QueryClientProvider>,
    );

    await user.type(
      screen.getByRole("combobox", {
        name: "タイムライン種別を検索・新規作成",
      }),
      "  文学   運動 ",
    );
    expect(screen.getByRole("button", { name: "新規作成" })).toBeDisabled();
  });
});
