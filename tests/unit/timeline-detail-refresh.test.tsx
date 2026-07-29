import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  timelineEventKeys,
  type getTimelineEvent,
} from "@/features/timeline-events/api";
import { TimelineEventDetail } from "@/features/timeline-events/timeline-event-detail";
import { TimelineEventDetailEditor } from "@/features/timeline-events/timeline-event-detail-editor";
import { DetailEditShell } from "@/features/timeline-items/detail-edit-shell";
import type { TimelineEvent } from "@/features/timeline-events/types";
import {
  timelineItemKeys,
  type getTimelineItem,
} from "@/features/timeline-items/api";
import { TimelineItemDetail } from "@/features/timeline-items/timeline-item-detail";
import { TimelineItemDetailEditor } from "@/features/timeline-items/timeline-item-detail-editor";
import type { TimelineItem } from "@/features/timeline-items/types";

const mocks = vi.hoisted(() => ({
  deleteTimelineEvent: vi.fn(),
  getTimelineEvent: vi.fn<typeof getTimelineEvent>(),
  getTimelineItem: vi.fn<typeof getTimelineItem>(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: mocks.back,
    replace: mocks.replace,
    refresh: mocks.refresh,
  }),
}));

vi.mock("@/features/timeline-events/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/timeline-events/api")>()),
  deleteTimelineEvent: mocks.deleteTimelineEvent,
  getTimelineEvent: mocks.getTimelineEvent,
}));

vi.mock("@/features/timeline-items/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/timeline-items/api")>()),
  getTimelineItem: mocks.getTimelineItem,
}));

vi.mock("@/features/timeline-items/timeline-item-form", () => ({
  TimelineItemForm: ({ item: current }: { item: TimelineItem }) => (
    <output data-testid="item-editor-title">{current.title}</output>
  ),
}));

vi.mock("@/features/timeline-events/timeline-event-form", () => ({
  TimelineEventForm: ({ event: current }: { event: TimelineEvent }) => (
    <output data-testid="event-editor-title">{current.title}</output>
  ),
}));

const event: TimelineEvent = {
  id: "33333333-3333-4333-8333-333333333333",
  projectId: "22222222-2222-4222-8222-222222222222",
  timelineItemIds: ["44444444-4444-4444-8444-444444444444"],
  title: "更新前イベント",
  aliases: [],
  date: { year: 1905, month: 1, day: 15 },
  isApproximate: false,
  description: null,
  sourceText: null,
  externalUrl: null,
  parents: [
    {
      id: "44444444-4444-4444-8444-444444444444",
      title: "親項目",
      start: { year: 1900, month: null, day: null },
      endDateStatus: "specified",
      end: { year: 1910, month: null, day: null },
      lastConfirmed: null,
      sortOrder: 0,
    },
  ],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const item: TimelineItem = {
  id: "44444444-4444-4444-8444-444444444444",
  projectId: event.projectId,
  typeId: "11111111-1111-4111-8111-111111111111",
  itemType: {
    id: "11111111-1111-4111-8111-111111111111",
    projectId: event.projectId,
    name: "人物",
    defaultColor: "#00B0B0",
    icon: "user-round",
    sortOrder: 0,
    isVisible: true,
    isSystemSeed: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  title: "更新前項目",
  aliases: [],
  description: null,
  sourceText: null,
  externalUrl: null,
  temporalType: "range",
  colorOverride: null,
  manualOrder: 0,
  isVisible: true,
  start: { year: 1900, month: null, day: null },
  isStartApproximate: false,
  startUncertaintyYears: null,
  endDateStatus: "specified",
  end: { year: 1910, month: null, day: null },
  isEndApproximate: false,
  endUncertaintyYears: null,
  lastConfirmed: null,
  point: null,
  isPointApproximate: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
    },
  });
  return {
    queryClient,
    Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );
    },
  };
}

describe("timeline detail refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => cleanup());

  it("reflects an event saved in the detail cache", async () => {
    const { queryClient, Wrapper } = createWrapper();
    render(
      <Wrapper>
        <TimelineEventDetail event={event} projectId={event.projectId} />
      </Wrapper>,
    );

    act(() => {
      queryClient.setQueryData(
        timelineEventKeys.detail(event.projectId, event.id),
        {
          ...event,
          title: "更新後イベント",
        },
      );
    });

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "更新後イベント" }),
      ).toBeVisible(),
    );
  });

  it("reflects a timeline item saved in the detail cache", async () => {
    const { queryClient, Wrapper } = createWrapper();
    render(
      <Wrapper>
        <TimelineItemDetail
          events={[]}
          item={item}
          projectId={item.projectId}
        />
      </Wrapper>,
    );

    act(() => {
      queryClient.setQueryData(
        timelineItemKeys.detail(item.projectId, item.id),
        {
          ...item,
          title: "更新後項目",
        },
      );
    });

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "更新後項目" })).toBeVisible(),
    );
  });

  it("reopens the item editor with the value saved in the detail cache", async () => {
    const { queryClient, Wrapper } = createWrapper();
    const user = userEvent.setup();
    const pointItem: TimelineItem = {
      ...item,
      temporalType: "point",
      start: null,
      endDateStatus: null,
      end: null,
      point: { year: 1900, month: null, day: null },
    };
    render(
      <Wrapper>
        <DetailEditShell
          editor={
            <TimelineItemDetailEditor
              currentYear={2026}
              item={pointItem}
              itemTypes={[pointItem.itemType]}
              projectId={pointItem.projectId}
              rangeItems={[]}
            />
          }
          preferenceKey="/projects/project-id/items/item-id"
        >
          <div>詳細表示</div>
        </DetailEditShell>
      </Wrapper>,
    );

    await user.click(screen.getByRole("button", { name: "編集" }));
    expect(screen.getByTestId("item-editor-title")).toHaveTextContent(
      "更新前項目",
    );
    act(() => {
      queryClient.setQueryData(
        timelineItemKeys.detail(pointItem.projectId, pointItem.id),
        { ...pointItem, title: "更新後項目" },
      );
    });
    await user.click(screen.getByRole("button", { name: "詳細オプション" }));
    await user.click(screen.getByRole("menuitem", { name: "閲覧に戻る" }));
    await user.click(screen.getByRole("button", { name: "編集" }));

    expect(screen.getByTestId("item-editor-title")).toHaveTextContent(
      "更新後項目",
    );
  });

  it("reopens the event editor with the value saved in the detail cache", async () => {
    const { queryClient, Wrapper } = createWrapper();
    const user = userEvent.setup();
    render(
      <Wrapper>
        <DetailEditShell
          editor={
            <TimelineEventDetailEditor
              currentYear={2026}
              event={event}
              projectId={event.projectId}
              rangeItems={[]}
            />
          }
          preferenceKey="/projects/project-id/events/event-id"
        >
          <div>詳細表示</div>
        </DetailEditShell>
      </Wrapper>,
    );

    await user.click(screen.getByRole("button", { name: "編集" }));
    expect(screen.getByTestId("event-editor-title")).toHaveTextContent(
      "更新前イベント",
    );
    act(() => {
      queryClient.setQueryData(
        timelineEventKeys.detail(event.projectId, event.id),
        { ...event, title: "更新後イベント" },
      );
    });
    await user.click(screen.getByRole("button", { name: "詳細オプション" }));
    await user.click(screen.getByRole("menuitem", { name: "閲覧に戻る" }));
    await user.click(screen.getByRole("button", { name: "編集" }));

    expect(screen.getByTestId("event-editor-title")).toHaveTextContent(
      "更新後イベント",
    );
  });

  it("blocks interaction while an event is moved to trash and then opens the timeline", async () => {
    let completeDeletion: (() => void) | undefined;
    mocks.deleteTimelineEvent.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        completeDeletion = resolve;
      }),
    );
    const { Wrapper } = createWrapper();
    const user = userEvent.setup();
    render(
      <Wrapper>
        <DetailEditShell
          editor={<div>編集</div>}
          preferenceKey="/projects/project-id/events/event-id"
        >
          <TimelineEventDetail
            closeOverlayAfterDelete
            event={event}
            projectId={event.projectId}
          />
        </DetailEditShell>
      </Wrapper>,
    );

    await user.click(screen.getByRole("button", { name: "詳細オプション" }));
    await user.click(screen.getByRole("menuitem", { name: "ゴミ箱へ移動" }));
    await user.click(screen.getByRole("button", { name: "ゴミ箱へ移動" }));
    expect(screen.getByRole("button", { name: "移動中…" })).toBeDisabled();
    expect(mocks.replace).not.toHaveBeenCalled();

    completeDeletion?.();
    await waitFor(() => expect(mocks.back).toHaveBeenCalledOnce());
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
