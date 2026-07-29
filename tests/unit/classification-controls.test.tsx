import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QueryProvider } from "@/components/query-provider";
import {
  EventTypeSelect,
  TagMultiSelect,
} from "@/features/classification/entity-classification-fields";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mockClassification() {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            tags: [
              {
                id: "11111111-1111-4111-8111-111111111111",
                projectId: "project",
                name: "長編",
                color: "#FDE68A",
                description: null,
                usageCount: 1,
                createdAt: "2026-01-01",
                updatedAt: "2026-01-01",
              },
            ],
            eventTypes: [
              {
                id: "22222222-2222-4222-8222-222222222222",
                projectId: "project",
                name: "出版",
                color: "#FF3399",
                markerShape: "diamond",
                description: null,
                sortOrder: 0,
                usageCount: 0,
                createdAt: "2026-01-01",
                updatedAt: "2026-01-01",
              },
            ],
            customFields: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    ),
  );
}

describe("Notion-like classification controls", () => {
  it("shows tag candidates with an ellipsis settings action", async () => {
    mockClassification();
    const user = userEvent.setup();
    render(
      <QueryProvider>
        <TagMultiSelect
          projectId="project"
          value={[]}
          onChange={() => undefined}
        />
      </QueryProvider>,
    );
    await user.click(screen.getByLabelText("タグを検索または作成"));
    expect(await screen.findByText("長編")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "長編の設定変更" }),
    ).toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.queryByText("オプションを選択するか作成します")).toBeNull();
  });

  it("offers marker shapes as visual buttons from the candidate settings", async () => {
    mockClassification();
    const user = userEvent.setup();
    render(
      <QueryProvider>
        <EventTypeSelect
          projectId="project"
          value={null}
          onChange={() => undefined}
        />
      </QueryProvider>,
    );
    await user.click(
      screen.getByRole("combobox", {
        name: "イベント種別を検索または作成",
      }),
    );
    await user.click(
      await screen.findByRole("button", { name: "出版の設定変更" }),
    );
    expect(screen.getByRole("button", { name: "diamond形状" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getAllByRole("button", { name: /形状$/ })).toHaveLength(6);
    expect(screen.getByText("オプションを選択するか作成します")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "circle形状" }));
    await waitFor(() =>
      expect(
        vi
          .mocked(globalThis.fetch)
          .mock.calls.some(([, init]) => init?.method === "PATCH"),
      ).toBe(true),
    );
    const updateCall = vi
      .mocked(globalThis.fetch)
      .mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(JSON.parse(String(updateCall?.[1]?.body))).toMatchObject({
      values: { markerShape: "circle" },
    });
    expect(screen.getByRole("button", { name: "circle形状" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("closes tag and event type candidates when focus moves outside", async () => {
    mockClassification();
    const user = userEvent.setup();
    render(
      <QueryProvider>
        <TagMultiSelect
          projectId="project"
          value={[]}
          onChange={() => undefined}
        />
        <EventTypeSelect
          projectId="project"
          value={null}
          onChange={() => undefined}
        />
        <button type="button">外側</button>
      </QueryProvider>,
    );

    await user.click(screen.getByLabelText("タグを検索または作成"));
    expect(screen.getByText("オプションを選択するか作成します")).toBeVisible();
    expect(screen.queryByRole("button", { name: "閉じる" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "外側" }));
    expect(screen.queryByText("オプションを選択するか作成します")).toBeNull();

    await user.click(
      screen.getByRole("combobox", {
        name: "イベント種別を検索または作成",
      }),
    );
    expect(screen.getByText("オプションを選択するか作成します")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "外側" }));
    expect(screen.queryByText("オプションを選択するか作成します")).toBeNull();
  });
});
