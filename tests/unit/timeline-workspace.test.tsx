import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QueryProvider } from "@/components/query-provider";
import type { TimelineItemType } from "@/features/item-types/types";
import type { TimelineItemSummary } from "@/features/timeline-items/types";
import { TimelineWorkspace } from "@/features/timeline-items/timeline-workspace";
import type { Project } from "@/features/projects/types";

afterEach(cleanup);

const type: TimelineItemType = {
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

const project: Project = {
  id: type.projectId,
  name: "文学史",
  description: null,
  visibility: "private",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  settings: {
    defaultUncertaintyYears: 5,
    initialStartYear: 1800,
    initialEndYear: 2026,
    initialZoomPreset: "fit-range",
    timelineDensity: "comfortable",
    minimumTimeUnit: "day",
  },
};

function item(
  id: string,
  title: string,
  temporalType: "range" | "point",
  manualOrder = temporalType === "range" ? 0 : 1,
  itemType = type,
): TimelineItemSummary {
  return {
    id,
    projectId: project.id,
    typeId: itemType.id,
    itemType,
    title,
    temporalType,
    colorOverride: null,
    manualOrder,
    isVisible: true,
    start: temporalType === "range" ? { year: 1867, month: 2, day: 9 } : null,
    isStartApproximate: true,
    startUncertaintyYears: null,
    endDateStatus: temporalType === "range" ? "specified" : null,
    end: temporalType === "range" ? { year: 1916, month: 12, day: 9 } : null,
    isEndApproximate: false,
    endUncertaintyYears: null,
    lastConfirmed: null,
    point:
      temporalType === "point" ? { year: 1905, month: null, day: null } : null,
    isPointApproximate: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

describe("TimelineWorkspace", () => {
  it("separates a glyph click from range double-click event creation", () => {
    vi.useFakeTimers();
    const onOpenItem = vi.fn();
    render(
      <QueryProvider>
        <TimelineWorkspace
          currentDate={{ year: 2026, month: 7, day: 21 }}
          initialItems={[
            item("33333333-3333-4333-8333-333333333333", "夏目漱石", "range"),
          ]}
          itemTypes={[type]}
          project={project}
          onOpenItem={onOpenItem}
        />
      </QueryProvider>,
    );

    const glyph = screen.getByRole("button", {
      name: /夏目漱石の詳細を表示 期間型バー/,
    });
    fireEvent.click(glyph);
    fireEvent.doubleClick(glyph);
    expect(
      screen.getByRole("form", { name: "イベントアイテム作成" }),
    ).toBeInTheDocument();
    vi.advanceTimersByTime(300);
    expect(onOpenItem).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("renders distinct range and point glyphs and disables D&D for auto sort", async () => {
    const user = userEvent.setup();
    render(
      <QueryProvider>
        <TimelineWorkspace
          currentDate={{ year: 2026, month: 7, day: 21 }}
          initialItems={[
            item("33333333-3333-4333-8333-333333333333", "夏目漱石", "range"),
            item(
              "44444444-4444-4444-8444-444444444444",
              "吾輩は猫である",
              "point",
            ),
          ]}
          itemTypes={[type]}
          project={project}
        />
      </QueryProvider>,
    );

    expect(screen.getByLabelText(/期間型バー/)).toBeInTheDocument();
    expect(screen.getByLabelText(/時点型マーカー/)).toBeInTheDocument();
    const drag = screen.getByRole("button", { name: "夏目漱石を並べ替え" });
    expect(drag).toBeEnabled();

    await user.selectOptions(screen.getByLabelText("並び順"), "title");
    expect(drag).toBeDisabled();
    expect(
      screen.getByText("自動並べ替え中はドラッグできません。"),
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("表示密度"), "compact");
    expect(
      screen.getByTestId("timeline-row-33333333-3333-4333-8333-333333333333"),
    ).toHaveStyle({ height: "44px" });
    await user.click(screen.getByRole("button", { name: "拡大" }));
    expect(screen.getByText("世紀", { selector: "span" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "全項目を表示" }));
    expect(
      screen.getByText("全体表示", { selector: "span" }),
    ).toBeInTheDocument();
  });

  it("groups and collapses rows by item type", async () => {
    const user = userEvent.setup();
    render(
      <QueryProvider>
        <TimelineWorkspace
          currentDate={{ year: 2026, month: 7, day: 21 }}
          initialItems={[
            item("33333333-3333-4333-8333-333333333333", "夏目漱石", "range"),
          ]}
          itemTypes={[type]}
          project={project}
        />
      </QueryProvider>,
    );

    await user.click(screen.getByLabelText("対象種別でグループ化"));
    const heading = screen.getByRole("button", { name: /人物/ });
    expect(screen.getByText(/表示中 1 \/ 1 行/)).toBeInTheDocument();
    expect(screen.getByText("夏目漱石")).toBeInTheDocument();
    await user.click(heading);
    expect(screen.queryByText("夏目漱石")).not.toBeInTheDocument();
  });

  it("places hidden items in a collapsed group at the bottom", async () => {
    const user = userEvent.setup();
    const visibleItem = item(
      "33333333-3333-4333-8333-333333333333",
      "表示項目",
      "range",
    );
    const hiddenItem = {
      ...item("44444444-4444-4444-8444-444444444444", "非表示項目", "point"),
      isVisible: false,
    };
    render(
      <QueryProvider>
        <TimelineWorkspace
          currentDate={{ year: 2026, month: 7, day: 21 }}
          initialItems={[hiddenItem, visibleItem]}
          itemTypes={[type]}
          project={project}
        />
      </QueryProvider>,
    );

    const hiddenGroup = screen.getByRole("button", {
      name: /非表示にした項目 1/,
    });
    expect(screen.queryByText("非表示項目")).not.toBeInTheDocument();
    expect(screen.getByText(/表示中 1 \/ 2 行/)).toBeInTheDocument();

    await user.click(hiddenGroup);
    const rows = screen.getAllByTestId(/^timeline-row-/);
    expect(rows[0]).toHaveTextContent("表示項目");
    expect(rows[1]).toHaveTextContent("非表示項目");
    expect(screen.getByText(/表示中 2 \/ 2 行/)).toBeInTheDocument();

    await user.click(screen.getByLabelText("対象種別でグループ化"));
    const groupButtons = screen
      .getAllByRole("button")
      .filter((button) =>
        /^(人物|非表示にした項目)/.test(button.textContent ?? ""),
      );
    expect(groupButtons.at(-1)).toHaveTextContent("非表示にした項目");
  });

  it("virtualizes a 1,000-row timeline", () => {
    const manyItems = Array.from({ length: 1000 }, (_, index) =>
      item(`item-${index}`, `項目 ${index}`, "range", index),
    );
    render(
      <QueryProvider>
        <TimelineWorkspace
          currentDate={{ year: 2026, month: 7, day: 21 }}
          initialItems={manyItems}
          itemTypes={[type]}
          project={project}
        />
      </QueryProvider>,
    );

    const renderedRows = screen.getAllByTestId(/^timeline-row-/);
    expect(renderedRows.length).toBeGreaterThan(0);
    expect(renderedRows.length).toBeLessThan(1000);
    expect(screen.getByText("1000アイテム")).toBeInTheDocument();
  });

  it("remeasures virtual rows in both density directions and zooms only with Alt", async () => {
    const user = userEvent.setup();
    render(
      <QueryProvider>
        <TimelineWorkspace
          currentDate={{ year: 2026, month: 7, day: 21 }}
          initialItems={[
            item("33333333-3333-4333-8333-333333333333", "一行目", "range"),
            item("44444444-4444-4444-8444-444444444444", "二行目", "point"),
          ]}
          itemTypes={[type]}
          project={{
            ...project,
            settings: { ...project.settings, timelineDensity: "compact" },
          }}
        />
      </QueryProvider>,
    );

    const secondRow = screen.getByTestId(
      "timeline-row-44444444-4444-4444-8444-444444444444",
    );
    await waitFor(() =>
      expect(secondRow.closest("[data-index]")).toHaveStyle({
        transform: "translateY(44px)",
      }),
    );
    await user.selectOptions(screen.getByLabelText("表示密度"), "comfortable");
    await waitFor(() =>
      expect(secondRow.closest("[data-index]")).toHaveStyle({
        transform: "translateY(64px)",
      }),
    );

    const slider = screen.getByLabelText("ズーム段階");
    const viewport = screen.getByTestId("timeline-viewport");
    expect(slider).toHaveValue("0");
    fireEvent.wheel(viewport, { altKey: true, deltaY: -100, clientX: 600 });
    expect(slider).toHaveValue("1");
    fireEvent.wheel(viewport, { ctrlKey: true, deltaY: -100, clientX: 600 });
    expect(slider).toHaveValue("1");
    expect(
      screen.getByText("Alt＋ホイールでカーソル中心にズーム"),
    ).toBeInTheDocument();
  });

  it("keeps a point marker visible while pointer-panning", () => {
    Object.defineProperties(HTMLElement.prototype, {
      setPointerCapture: { configurable: true, value: vi.fn() },
      releasePointerCapture: { configurable: true, value: vi.fn() },
      hasPointerCapture: {
        configurable: true,
        value: vi.fn(() => true),
      },
    });
    const { container } = render(
      <QueryProvider>
        <TimelineWorkspace
          currentDate={{ year: 2026, month: 7, day: 21 }}
          initialItems={[
            item("44444444-4444-4444-8444-444444444444", "単一時点", "point"),
          ]}
          itemTypes={[type]}
          project={project}
        />
      </QueryProvider>,
    );

    const marker = screen.getByLabelText(/時点型マーカー/);
    const panSurface = container.querySelector(
      "[data-timeline-pan-surface='true']",
    );
    expect(panSurface).not.toBeNull();
    fireEvent.pointerDown(panSurface!, {
      button: 0,
      clientX: 600,
      pointerId: 1,
    });
    expect(marker).toBeInTheDocument();
    fireEvent.pointerUp(screen.getByTestId("timeline-viewport"), {
      pointerId: 1,
    });

    Reflect.deleteProperty(HTMLElement.prototype, "setPointerCapture");
    Reflect.deleteProperty(HTMLElement.prototype, "releasePointerCapture");
    Reflect.deleteProperty(HTMLElement.prototype, "hasPointerCapture");
  });

  it("coalesces rapid scroll updates into animation frames", () => {
    const frames: FrameRequestCallback[] = [];
    const animationFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        frames.push(callback);
        return frames.length;
      });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    render(
      <QueryProvider>
        <TimelineWorkspace
          currentDate={{ year: 2026, month: 7, day: 21 }}
          initialItems={[
            item("44444444-4444-4444-8444-444444444444", "単一時点", "point"),
          ]}
          itemTypes={[type]}
          project={project}
        />
      </QueryProvider>,
    );

    const viewport = screen.getByTestId("timeline-viewport");
    viewport.scrollLeft = 100;
    fireEvent.scroll(viewport);
    viewport.scrollLeft = 180;
    fireEvent.scroll(viewport);

    expect(animationFrame).toHaveBeenCalledTimes(1);
    expect(frames).toHaveLength(1);
  });

  it("fits a single point to a readable scale", () => {
    render(
      <QueryProvider>
        <TimelineWorkspace
          currentDate={{ year: 2026, month: 7, day: 21 }}
          initialItems={[
            item("44444444-4444-4444-8444-444444444444", "単一時点", "point"),
          ]}
          itemTypes={[type]}
          project={project}
        />
      </QueryProvider>,
    );

    expect(screen.getByLabelText(/時点型マーカー/)).toBeInTheDocument();
    expect(screen.getByText("目盛り year")).toBeInTheDocument();
  });

  it("sorts item types by sortOrder instead of their names", async () => {
    const user = userEvent.setup();
    const workType: TimelineItemType = {
      ...type,
      id: "55555555-5555-4555-8555-555555555555",
      name: "作品",
      sortOrder: 0,
    };
    const personType = { ...type, sortOrder: 1 };
    render(
      <QueryProvider>
        <TimelineWorkspace
          currentDate={{ year: 2026, month: 7, day: 21 }}
          initialItems={[
            item(
              "33333333-3333-4333-8333-333333333333",
              "人物項目",
              "point",
              0,
              personType,
            ),
            item(
              "44444444-4444-4444-8444-444444444444",
              "作品項目",
              "point",
              1,
              workType,
            ),
          ]}
          itemTypes={[workType, personType]}
          project={project}
        />
      </QueryProvider>,
    );

    await user.selectOptions(screen.getByLabelText("並び順"), "itemType");
    const rows = screen.getAllByTestId(/^timeline-row-/);
    expect(rows[0]).toHaveTextContent("作品項目");
    expect(rows[1]).toHaveTextContent("人物項目");
  });
});
