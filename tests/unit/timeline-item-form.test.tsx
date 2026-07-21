import { render, screen } from "@testing-library/react";
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
});
