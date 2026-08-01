import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QueryProvider } from "@/components/query-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { TimelineItemType } from "@/features/item-types/types";
import type { EventType } from "@/features/classification/types";
import { TimelineEventMarkers } from "@/features/timeline-events/timeline-event-markers";
import type { TimelineEventSummary } from "@/features/timeline-events/types";
import { historicalDateOrdinal } from "@/features/timeline-items/historical-date";
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
  publicId: null,
  publishedAt: null,
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

function timelineEvent(
  id: string,
  title: string,
  day: number,
): TimelineEventSummary {
  return {
    id,
    projectId: project.id,
    timelineItemIds: ["33333333-3333-4333-8333-333333333333"],
    title,
    date: { year: 1905, month: 1, day },
    isApproximate: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

type TestUser = ReturnType<typeof userEvent.setup>;

async function chooseLayout(user: TestUser, name: "行表示" | "コンパクト") {
  await user.click(screen.getByRole("button", { name }));
}

async function chooseArrangement(user: TestUser, name: string) {
  await user.click(screen.getByRole("button", { name: "配置設定" }));
  await user.click(screen.getByRole("menuitemradio", { name }));
}

async function toggleTypeGrouping(user: TestUser) {
  await user.click(screen.getByRole("button", { name: "配置設定" }));
  await user.click(
    screen.getByRole("menuitemcheckbox", {
      name: "タイムライン種別でグループ化",
    }),
  );
}

async function chooseDensity(user: TestUser, name: "標準" | "高密度") {
  if (!screen.queryByRole("button", { name: "表示密度設定" })) {
    await user.click(
      screen.getByRole("button", { name: "タイムライン操作を開く" }),
    );
  }
  await user.click(screen.getByRole("button", { name: "表示密度設定" }));
  await user.click(screen.getByRole("menuitemradio", { name }));
}

async function openFloatingControls(user: TestUser) {
  const open = screen.queryByRole("button", {
    name: "タイムライン操作を開く",
  });
  if (open) await user.click(open);
}

describe("TimelineWorkspace", () => {
  it("keeps timeline chrome isolated and switches relationship display modes from the toolbar", async () => {
    const user = userEvent.setup();
    const source = item(
      "33333333-3333-4333-8333-333333333333",
      "源流A",
      "range",
    );
    const target = item(
      "44444444-4444-4444-8444-444444444444",
      "後継B",
      "point",
    );
    render(
      <QueryProvider>
        <TimelineWorkspace
          currentDate={{ year: 2026, month: 7, day: 23 }}
          initialItems={[source, target]}
          initialRelationships={{
            entities: [
              { type: "timeline_item", id: source.id, title: source.title },
              { type: "timeline_item", id: target.id, title: target.title },
            ],
            relationships: [
              {
                id: "relationship-1",
                projectId: project.id,
                sourceType: "timeline_item",
                sourceId: source.id,
                targetType: "timeline_item",
                targetId: target.id,
                relationType: "影響",
                direction: "directed",
                lineStyle: "single",
                sourceMarker: "none",
                targetMarker: "arrow",
                note: null,
                createdAt: "2026-08-01T00:00:00Z",
                updatedAt: "2026-08-01T00:00:00Z",
              },
            ],
          }}
          itemTypes={[type]}
          project={project}
        />
      </QueryProvider>,
    );

    expect(screen.getByTestId("timeline-viewport")).toHaveClass("isolate");
    expect(screen.getByTestId("relationship-layer")).toHaveClass(
      "overflow-hidden",
    );
    const stroke = screen.getByTestId("relationship-stroke-relationship-1");
    expect(stroke).toHaveAttribute("stroke", "rgba(107, 114, 128, 0.42)");

    await user.click(screen.getByRole("button", { name: "関係線: 標準" }));
    await user.click(screen.getByRole("menuitemradio", { name: "すべて表示" }));
    expect(stroke).toHaveAttribute("stroke", "#007F7F");

    await user.click(
      screen.getByRole("button", { name: "関係線: すべて表示" }),
    );
    await user.click(
      screen.getByRole("menuitemradio", { name: "すべて非表示" }),
    );
    expect(screen.getByTestId("relationship-layer")).toHaveAttribute(
      "data-visible-count",
      "0",
    );
  });

  it("keeps the floating controls collapsed until the round controller is opened", async () => {
    const user = userEvent.setup();
    render(
      <QueryProvider>
        <TimelineWorkspace
          currentDate={{ year: 2026, month: 7, day: 23 }}
          initialItems={[
            item("33333333-3333-4333-8333-333333333333", "夏目漱石", "range"),
          ]}
          itemTypes={[type]}
          project={project}
        />
      </QueryProvider>,
    );

    const controller = screen.getByRole("button", {
      name: "タイムライン操作を開く",
    });
    expect(controller).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("timeline-floating-controls")).toBeNull();
    await user.click(controller);
    expect(
      screen.getByRole("button", { name: "タイムライン操作を閉じる" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("timeline-floating-controls")).toBeVisible();
  });

  it("removes editing controls in read-only mode", () => {
    render(
      <QueryProvider>
        <TimelineWorkspace
          currentDate={{ year: 2026, month: 7, day: 23 }}
          initialItems={[
            item("33333333-3333-4333-8333-333333333333", "夏目漱石", "range"),
          ]}
          itemTypes={[type]}
          project={{ ...project, visibility: "public" }}
          readOnly
        />
      </QueryProvider>,
    );
    expect(screen.queryByRole("button", { name: /アイテムを追加/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /夏目漱石を編集/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /夏目漱石を並べ替え/ }),
    ).toBeNull();
  });

  it("opens a keyboard-accessible event picker for overlapping markers", async () => {
    const user = userEvent.setup();
    const onOpenEvent = vi.fn();
    render(
      <QueryProvider>
        <TimelineWorkspace
          currentDate={{ year: 2026, month: 7, day: 21 }}
          initialEvents={[
            timelineEvent("event-3", "三番目", 3),
            timelineEvent("event-1", "一番目", 1),
            timelineEvent("event-2", "二番目", 2),
          ]}
          initialItems={[
            item("33333333-3333-4333-8333-333333333333", "夏目漱石", "range"),
          ]}
          itemTypes={[type]}
          project={project}
          onOpenEvent={onOpenEvent}
        />
      </QueryProvider>,
    );

    const cluster = screen.getByRole("button", {
      name: "3件のイベントアイテムを選択",
    });
    expect(cluster).toHaveTextContent("3");
    await user.hover(cluster);
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("一番目");
    expect(tooltip).toHaveTextContent("二番目");
    expect(tooltip).toHaveTextContent("三番目");
    await user.click(cluster);

    const dialog = screen.getByRole("dialog");
    expect(dialog).not.toHaveTextContent(
      "重なっているイベントから詳細を表示する項目を選びます。",
    );
    const choices = within(dialog).getAllByRole("button", {
      name: /番目/,
    });
    expect(choices[0]).toHaveClass(
      "hover:border-l-primary",
      "hover:bg-primary/20",
    );
    expect(choices.map((choice) => choice.textContent)).toEqual([
      "一番目1905/01/01",
      "二番目1905/01/02",
      "三番目1905/01/03",
    ]);

    choices[0]!.focus();
    await user.keyboard("{Enter}");
    expect(onOpenEvent).toHaveBeenCalledWith("event-1", false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("releases a cluster when zoom separates its marker coordinates", () => {
    const events = [
      timelineEvent("event-1", "一番目", 1),
      timelineEvent("event-2", "二番目", 2),
      timelineEvent("event-3", "三番目", 3),
    ];
    const domainStart = historicalDateOrdinal({
      year: 1905,
      month: 1,
      day: 1,
    });
    const onOpenEvent = vi.fn();
    const { rerender } = render(
      <TooltipProvider>
        <TimelineEventMarkers
          domainStart={domainStart}
          events={events}
          horizontalPadding={24}
          pixelsPerDay={0.1}
          visibleEnd={200}
          visibleStart={0}
          onOpenEvent={onOpenEvent}
        />
      </TooltipProvider>,
    );
    expect(
      screen.getByRole("button", {
        name: "3件のイベントアイテムを選択",
      }),
    ).toBeInTheDocument();

    rerender(
      <TooltipProvider>
        <TimelineEventMarkers
          domainStart={domainStart}
          events={events}
          horizontalPadding={24}
          pixelsPerDay={36}
          visibleEnd={200}
          visibleStart={0}
          onOpenEvent={onOpenEvent}
        />
      </TooltipProvider>,
    );
    expect(
      screen.queryByRole("button", {
        name: "3件のイベントアイテムを選択",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /イベントアイテム 一番目/ }),
    ).toHaveClass("hover:ring-2", "hover:ring-secondary");
  });

  it("keeps untyped and circle event markers identical at the pre-L9 diameter", () => {
    const circleType: EventType = {
      id: "66666666-6666-4666-8666-666666666666",
      projectId: project.id,
      name: "円",
      color: "#00B0B0",
      markerShape: "circle",
      description: null,
      sortOrder: 0,
      usageCount: 1,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    const squareType: EventType = {
      ...circleType,
      id: "77777777-7777-4777-8777-777777777777",
      name: "四角",
      markerShape: "square",
    };
    const untyped = timelineEvent("event-none", "種別なし", 1);
    const circle = {
      ...timelineEvent("event-circle", "丸イベント", 3),
      eventTypeId: circleType.id,
      eventType: circleType,
    };
    const square = {
      ...timelineEvent("event-square", "四角イベント", 5),
      eventTypeId: squareType.id,
      eventType: squareType,
    };
    render(
      <TooltipProvider>
        <TimelineEventMarkers
          domainStart={historicalDateOrdinal({ year: 1905, month: 1, day: 1 })}
          events={[untyped, circle, square]}
          horizontalPadding={24}
          pixelsPerDay={36}
          visibleEnd={240}
          visibleStart={0}
          onOpenEvent={vi.fn()}
        />
      </TooltipProvider>,
    );

    const untypedMarker = screen.getByRole("button", {
      name: /イベントアイテム 種別なし/,
    });
    const circleMarker = screen.getByRole("button", {
      name: /イベントアイテム 丸イベント/,
    });
    const squareMarker = screen.getByRole("button", {
      name: /イベントアイテム 四角イベント/,
    });
    for (const marker of [untypedMarker, circleMarker, squareMarker]) {
      expect(marker).toHaveClass("size-3", "rounded-full", "border-2");
      expect(
        within(marker).getByTestId("timeline-event-marker-shape"),
      ).toHaveClass("size-2");
    }
    expect(
      within(untypedMarker).getByTestId("timeline-event-marker-shape"),
    ).toHaveStyle({ borderRadius: "9999px" });
    expect(
      within(circleMarker).getByTestId("timeline-event-marker-shape"),
    ).toHaveStyle({ borderRadius: "9999px" });
    expect(
      within(squareMarker).getByTestId("timeline-event-marker-shape"),
    ).toHaveStyle({ borderRadius: "2px" });
  });

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

    expect(screen.getByLabelText(/期間型バー/)).toHaveClass(
      "hover:ring-2",
      "hover:ring-secondary",
      "hover:ring-inset",
    );
    expect(screen.getByTestId("timeline-workspace")).toHaveAttribute(
      "data-client-ready",
      "true",
    );
    expect(screen.getByLabelText(/時点型マーカー/)).toHaveClass(
      "hover:ring-2",
      "hover:ring-secondary",
      "hover:ring-inset",
    );
    const drag = screen.getByRole("button", { name: "夏目漱石を並べ替え" });
    expect(drag).toBeEnabled();

    await chooseArrangement(user, "名称");
    expect(drag).toBeDisabled();
    expect(screen.getByRole("button", { name: "配置設定" })).toHaveTextContent(
      "名称",
    );

    await chooseDensity(user, "高密度");
    expect(
      screen.getByTestId("timeline-row-33333333-3333-4333-8333-333333333333"),
    ).toHaveStyle({ height: "44px" });
    await user.click(screen.getByRole("button", { name: "拡大" }));
    expect(screen.getByText("世紀", { selector: "span" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "全体に合わせる" }));
    expect(screen.getByLabelText("ズーム段階")).toHaveValue("0");
  });

  it("keeps event markers above a highlighted timeline item", () => {
    render(
      <QueryProvider>
        <TimelineWorkspace
          currentDate={{ year: 2026, month: 7, day: 21 }}
          initialEvents={[timelineEvent("event-1", "重なるイベント", 1)]}
          initialItems={[
            item("33333333-3333-4333-8333-333333333333", "夏目漱石", "range"),
          ]}
          itemTypes={[type]}
          project={project}
        />
      </QueryProvider>,
    );

    expect(screen.getByLabelText(/期間型バー/)).toHaveClass("hover:z-20");
    expect(
      screen.getByRole("button", {
        name: /イベントアイテム 重なるイベント/,
      }),
    ).toHaveClass("z-30", "hover:z-40", "hover:ring-2");
    expect(
      screen
        .getByTestId("timeline-row-33333333-3333-4333-8333-333333333333")
        .querySelector("[data-timeline-pan-surface='true']"),
    ).toHaveClass("isolate", "overflow-hidden");
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

    await toggleTypeGrouping(user);
    const heading = screen.getByRole("button", { name: /人物/ });
    const groupIcon = heading.querySelector("svg.lucide-user-round");
    expect(groupIcon).not.toBeNull();
    expect(groupIcon).toHaveStyle({ color: type.defaultColor });
    expect(screen.getByText(/表示中 1 \/ 1 行/)).toBeInTheDocument();
    expect(screen.getByText("夏目漱石")).toBeInTheDocument();
    expect(
      screen.getByTestId("timeline-row-33333333-3333-4333-8333-333333333333"),
    ).not.toHaveTextContent("人物 ·");
    await user.click(heading);
    expect(screen.queryByText("夏目漱石")).not.toBeInTheDocument();
  });

  it("sorts dates within the same year by month and day", async () => {
    const user = userEvent.setup();
    const datedItem = (
      id: string,
      title: string,
      month: number,
      day: number,
      manualOrder: number,
    ) => ({
      ...item(id, title, "range", manualOrder),
      start: { year: 1936, month, day },
    });
    render(
      <QueryProvider>
        <TimelineWorkspace
          currentDate={{ year: 2026, month: 7, day: 21 }}
          initialItems={[
            datedItem(
              "33333333-3333-4333-8333-333333333333",
              "ケン・ローチ",
              6,
              17,
              0,
            ),
            datedItem(
              "44444444-4444-4444-8444-444444444444",
              "アラン・コルバン",
              1,
              12,
              1,
            ),
            datedItem(
              "55555555-5555-4555-8555-555555555555",
              "ジョルジュ・ペレック",
              3,
              7,
              2,
            ),
          ]}
          itemTypes={[type]}
          project={project}
        />
      </QueryProvider>,
    );

    await chooseArrangement(user, "開始・時点日");
    const rows = screen.getAllByTestId(/^timeline-row-/);
    expect(rows[0]).toHaveTextContent("アラン・コルバン");
    expect(rows[1]).toHaveTextContent("ジョルジュ・ペレック");
    expect(rows[2]).toHaveTextContent("ケン・ローチ");
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
    expect(screen.getByText(/表示中 1 \/ 2 行/)).toBeInTheDocument();

    await toggleTypeGrouping(user);
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
    expect(screen.getByText("1000項目")).toBeInTheDocument();
    expect(screen.getByText(/表示中 1000 \/ 1000 行/)).toBeInTheDocument();
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
    await chooseDensity(user, "標準");
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
      screen.getByText(/Alt＋ホイールでカーソル中心にズーム/),
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
    expect(screen.getByText(/目盛り year/)).toBeInTheDocument();
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

    await chooseArrangement(user, "タイムライン種別");
    const rows = screen.getAllByTestId(/^timeline-row-/);
    expect(rows[0]).toHaveTextContent("作品項目");
    expect(rows[1]).toHaveTextContent("人物項目");
  });

  it("switches to compact lanes, disables ordering, and keeps lanes across zoom", async () => {
    const user = userEvent.setup();
    const first = {
      ...item("33333333-3333-4333-8333-333333333333", "人物A", "range", 0),
      start: { year: 1800, month: 1, day: 1 },
      end: { year: 1810, month: 1, day: 1 },
    };
    const later = {
      ...item("44444444-4444-4444-8444-444444444444", "人物B", "range", 1),
      start: { year: 1850, month: 1, day: 1 },
      end: { year: 1860, month: 1, day: 1 },
    };
    render(
      <QueryProvider>
        <TimelineWorkspace
          currentDate={{ year: 2026, month: 7, day: 22 }}
          initialItems={[first, later]}
          itemTypes={[type]}
          project={project}
        />
      </QueryProvider>,
    );

    await chooseLayout(user, "コンパクト");

    await waitFor(() =>
      expect(screen.getAllByTestId(/^compact-lane-/)).toHaveLength(1),
    );
    expect(screen.queryAllByTestId(/^timeline-row-/)).toHaveLength(0);
    expect(screen.getByRole("button", { name: "配置設定" })).toHaveTextContent(
      "自動配置",
    );
    expect(
      screen.getByRole("button", { name: "人物Aの詳細を表示" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "人物Aを並べ替え" }),
    ).toBeNull();

    const laneIdsBeforeZoom = screen
      .getAllByTestId(/^compact-lane-/)
      .map((lane) => lane.dataset.testid);
    await openFloatingControls(user);
    await user.click(screen.getByRole("button", { name: "拡大" }));
    expect(
      screen
        .getAllByTestId(/^compact-lane-/)
        .map((lane) => lane.dataset.testid),
    ).toEqual(laneIdsBeforeZoom);

    await chooseLayout(user, "行表示");
    expect(screen.getByRole("button", { name: "配置設定" })).toHaveTextContent(
      "手動順",
    );
    expect(screen.getAllByTestId(/^timeline-row-/)).toHaveLength(2);
  });

  it("calculates compact lanes independently inside collapsible type groups", async () => {
    const user = userEvent.setup();
    const workType: TimelineItemType = {
      ...type,
      id: "55555555-5555-4555-8555-555555555555",
      name: "作品",
      defaultColor: "#FF3399",
      sortOrder: 1,
    };
    render(
      <QueryProvider>
        <TimelineWorkspace
          currentDate={{ year: 2026, month: 7, day: 22 }}
          initialItems={[
            item("33333333-3333-4333-8333-333333333333", "人物項目", "range"),
            item(
              "44444444-4444-4444-8444-444444444444",
              "作品項目",
              "range",
              1,
              workType,
            ),
          ]}
          itemTypes={[type, workType]}
          project={project}
        />
      </QueryProvider>,
    );

    await toggleTypeGrouping(user);
    await chooseLayout(user, "コンパクト");
    await waitFor(() =>
      expect(screen.getAllByTestId(/^compact-lane-/)).toHaveLength(2),
    );

    await user.click(screen.getByRole("button", { name: /人物 1件/ }));
    expect(
      screen.queryByRole("button", { name: "人物項目の詳細を表示" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "作品項目の詳細を表示" }),
    ).toBeInTheDocument();
  });

  it("pans vertically as well as horizontally in compact mode", async () => {
    Object.defineProperties(HTMLElement.prototype, {
      setPointerCapture: { configurable: true, value: vi.fn() },
      releasePointerCapture: { configurable: true, value: vi.fn() },
      hasPointerCapture: {
        configurable: true,
        value: vi.fn(() => true),
      },
    });
    const user = userEvent.setup();
    render(
      <QueryProvider>
        <TimelineWorkspace
          currentDate={{ year: 2026, month: 7, day: 22 }}
          initialItems={[
            item("33333333-3333-4333-8333-333333333333", "人物A", "range"),
            item("44444444-4444-4444-8444-444444444444", "人物B", "range", 1),
          ]}
          itemTypes={[type]}
          project={project}
        />
      </QueryProvider>,
    );
    await chooseLayout(user, "コンパクト");
    const lane = (await screen.findAllByTestId(/compact-lane-/))[0]!;
    const viewport = screen.getByTestId("timeline-viewport");
    viewport.scrollLeft = 100;
    viewport.scrollTop = 100;

    fireEvent.pointerDown(lane, {
      button: 0,
      clientX: 400,
      clientY: 300,
      pointerId: 1,
    });
    fireEvent.pointerMove(viewport, {
      clientX: 350,
      clientY: 250,
      pointerId: 1,
    });
    expect(viewport.scrollLeft).toBe(150);
    expect(viewport.scrollTop).toBe(150);
    fireEvent.pointerUp(viewport, { pointerId: 1 });

    Reflect.deleteProperty(HTMLElement.prototype, "setPointerCapture");
    Reflect.deleteProperty(HTMLElement.prototype, "releasePointerCapture");
    Reflect.deleteProperty(HTMLElement.prototype, "hasPointerCapture");
  });

  it("toggles background layers and keeps them in compact mode", async () => {
    const user = userEvent.setup();
    const backgroundLayer = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      projectId: project.id,
      name: "日本の時代区分",
      description: null,
      sortOrder: 0,
      isVisible: true,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      periods: [
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          projectId: project.id,
          layerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          title: "明治時代",
          description: null,
          color: "#7C9A92",
          start: {
            era: "ce" as const,
            precision: "year" as const,
            year: 1868,
            month: null,
            day: null,
            originalText: null,
            calendar: "proleptic_gregorian",
          },
          end: {
            era: "ce" as const,
            precision: "year" as const,
            year: 1912,
            month: null,
            day: null,
            originalText: null,
            calendar: "proleptic_gregorian",
          },
          isStartApproximate: true,
          isEndApproximate: false,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ],
    };
    render(
      <QueryProvider>
        <TimelineWorkspace
          currentDate={{ year: 2026, month: 7, day: 22 }}
          initialBackgroundLayers={[backgroundLayer]}
          initialItems={[
            item("33333333-3333-4333-8333-333333333333", "夏目漱石", "range"),
          ]}
          itemTypes={[type]}
          project={project}
        />
      </QueryProvider>,
    );

    expect(screen.getByTestId("timeline-background-layers")).toHaveTextContent(
      "日本の時代区分 · 明治時代",
    );
    await user.click(screen.getByRole("button", { name: /年代背景/ }));
    await user.click(
      screen.getByRole("menuitemcheckbox", { name: "日本の時代区分" }),
    );
    expect(screen.queryByTestId("timeline-background-layers")).toBeNull();
    await user.click(screen.getByRole("button", { name: /年代背景/ }));
    await user.click(
      screen.getByRole("menuitemcheckbox", { name: "日本の時代区分" }),
    );
    await chooseLayout(user, "コンパクト");
    expect(screen.getByTestId("timeline-background-layers")).toBeVisible();
  });
});
