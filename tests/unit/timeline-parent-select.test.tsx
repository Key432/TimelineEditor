import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TimelineParentSelect } from "@/features/timeline-events/timeline-parent-select";
import type { TimelineItemSummary } from "@/features/timeline-items/types";

afterEach(cleanup);

const baseItem: TimelineItemSummary = {
  id: "11111111-1111-4111-8111-111111111111",
  projectId: "project",
  typeId: "type",
  itemType: {
    id: "type",
    projectId: "project",
    name: "人物",
    defaultColor: "#00B0B0",
    icon: "user-round",
    sortOrder: 0,
    isVisible: true,
    isSystemSeed: false,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
  title: "夏目漱石",
  tags: [],
  citations: [],
  temporalType: "range",
  colorOverride: null,
  manualOrder: 0,
  isVisible: true,
  start: {
    era: "ce",
    year: 1867,
    month: null,
    day: null,
    precision: "year",
    originalText: null,
    calendar: "proleptic_gregorian",
  },
  isStartApproximate: false,
  startUncertaintyYears: null,
  endDateStatus: "specified",
  end: {
    era: "ce",
    year: 1916,
    month: null,
    day: null,
    precision: "year",
    originalText: null,
    calendar: "proleptic_gregorian",
  },
  isEndApproximate: false,
  endUncertaintyYears: null,
  lastConfirmed: null,
  point: null,
  isPointApproximate: false,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

describe("TimelineParentSelect", () => {
  it("searches and selects a parent without settings actions", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TimelineParentSelect
        rangeItems={[baseItem, { ...baseItem, id: "other", title: "森鷗外" }]}
        value={[]}
        onChange={onChange}
      />,
    );

    const input = screen.getByRole("combobox", {
      name: "親タイムラインアイテムを検索",
    });
    await user.type(input, "漱石");
    expect(screen.getByRole("button", { name: "夏目漱石" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /設定変更/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "夏目漱石" }));
    expect(onChange).toHaveBeenCalledWith([baseItem.id]);
  });

  it("closes candidates after an outside click", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <TimelineParentSelect
          rangeItems={[baseItem]}
          value={[]}
          onChange={() => undefined}
        />
        <button type="button">外側</button>
      </div>,
    );

    await user.click(
      screen.getByRole("combobox", {
        name: "親タイムラインアイテムを検索",
      }),
    );
    expect(
      screen.getByText("親タイムラインアイテムを複数選択できます"),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "外側" }));
    expect(
      screen.queryByText("親タイムラインアイテムを複数選択できます"),
    ).toBeNull();
  });
});
