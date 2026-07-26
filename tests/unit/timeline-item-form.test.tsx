import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { QueryProvider } from "@/components/query-provider";
import type { TimelineItemType } from "@/features/item-types/types";
import { TimelineItemForm } from "@/features/timeline-items/timeline-item-form";

const itemType: TimelineItemType = {
  id: "11111111-1111-4111-8111-111111111111",
  projectId: "22222222-2222-4222-8222-222222222222",
  name: "人物",
  defaultColor: "#2878B5",
  icon: "user-round",
  sortOrder: 0,
  isVisible: true,
  isSystemSeed: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("TimelineItemForm", () => {
  it("opens item type management and keeps content fields visually separate", async () => {
    const user = userEvent.setup();
    const onEditItemTypes = vi.fn();

    render(
      <QueryProvider>
        <TimelineItemForm
          itemTypes={[itemType]}
          projectId={itemType.projectId}
          onEditItemTypes={onEditItemTypes}
        />
      </QueryProvider>,
    );

    expect(screen.queryByText("詳細編集を開く")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "対象種別を編集" }));
    expect(onEditItemTypes).toHaveBeenCalledOnce();

    expect(screen.getByLabelText("本文")).toBeVisible();
    expect(screen.getByLabelText("出典・参考文献")).toBeVisible();
    expect(screen.getByLabelText("外部URL")).toBeVisible();
    expect(screen.queryByLabelText(/概要/)).not.toBeInTheDocument();
  });

  it("carries the entered start date across temporal format changes", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <QueryProvider>
        <TimelineItemForm
          itemTypes={[itemType]}
          projectId={itemType.projectId}
        />
      </QueryProvider>,
    );

    const form = within(container);
    await user.type(form.getAllByLabelText("年")[0], "1868");
    await user.type(form.getAllByLabelText("年")[1], "1912");
    await user.selectOptions(form.getByLabelText("終了状態"), "ongoing");
    await user.selectOptions(form.getByLabelText("終了状態"), "specified");
    expect(form.getAllByLabelText("年")[1]).toHaveValue(1912);
    await user.click(form.getByRole("button", { name: "時点" }));
    expect(form.getByLabelText("年")).toHaveValue(1868);
    await user.click(form.getByRole("button", { name: "期間" }));
    expect(form.getAllByLabelText("年")[0]).toHaveValue(1868);
  });

  it("offers a color picker and editable event drafts during creation", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <QueryProvider>
        <TimelineItemForm
          itemTypes={[itemType]}
          projectId={itemType.projectId}
        />
      </QueryProvider>,
    );

    const form = within(container);
    await user.click(form.getByLabelText("対象種別の色を上書き"));
    expect(form.getByLabelText("個別色カラーピッカー")).toHaveValue(
      itemType.defaultColor.toLowerCase(),
    );
    fireEvent.change(form.getByLabelText("個別色カラーピッカー"), {
      target: { value: "#ff3399" },
    });
    expect(form.getByLabelText("個別色")).toHaveValue("#FF3399");
    await user.click(form.getByRole("button", { name: "イベントを追加" }));
    expect(
      form.getByRole("group", { name: "同時追加するイベントアイテム" }),
    ).toBeVisible();
  });

  it("keeps visibility and color override controls in the shared checkbox style", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <QueryProvider>
        <TimelineItemForm
          itemTypes={[itemType]}
          projectId={itemType.projectId}
        />
      </QueryProvider>,
    );

    const form = within(container);
    const colorOverride = form.getByLabelText("対象種別の色を上書き");
    const visibility = form.getByLabelText("タイムラインに表示");
    expect(colorOverride).toHaveClass("size-4", "accent-primary");
    expect(visibility).toHaveClass("size-4", "accent-primary");

    await user.click(colorOverride);
    const colorGroup = colorOverride.closest("[data-slot='color-override']");
    expect(colorGroup).not.toBeNull();
    expect(colorGroup).toContainElement(form.getByLabelText("個別色"));
    expect(colorGroup).toContainElement(
      form.getByLabelText("個別色カラーピッカー"),
    );
  });

  it("places approximate date controls beside dates in the shared bordered style", () => {
    const { container } = render(
      <QueryProvider>
        <TimelineItemForm
          itemTypes={[itemType]}
          projectId={itemType.projectId}
        />
      </QueryProvider>,
    );

    const form = within(container);
    const approximate = form.getByLabelText("開始日はおおよそ");
    expect(approximate.parentElement).toHaveClass("rounded-lg", "border");
    expect(
      approximate.closest('[data-slot="date-approximate-row"]'),
    ).not.toBeNull();
  });
});
