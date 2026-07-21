"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useVirtualizer,
  type Rect,
  type Virtualizer,
} from "@tanstack/react-virtual";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  EyeOff,
  GripVertical,
  Maximize2,
  Minus,
  Pencil,
  Plus,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type WheelEvent as ReactWheelEvent,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { eventX, snapTimelineDate } from "@/features/timeline-events/snap";
import type { TimelineEventSummary } from "@/features/timeline-events/types";
import {
  formatHistoricalDate,
  historicalDateFromOrdinal,
  historicalDateOrdinal,
} from "@/features/timeline-items/historical-date";
import {
  expandDegenerateFitRange,
  fitPixelsPerDay,
  generateTimelineTicks,
  overlapsViewport,
  scaleForZoomLevel,
  scrollLeftAfterZoom,
  timelineItemEndDate,
  timelineItemVisualBounds,
  uncertaintyWidth,
  ZOOM_LABELS,
} from "@/features/timeline-items/timeline-math";
import { useTimelineStore } from "@/features/timeline-items/timeline-store";
import type {
  HistoricalDate,
  TimelineItemSummary,
} from "@/features/timeline-items/types";
import type { Project } from "@/features/projects/types";
import { cn } from "@/lib/utils";

const HANDLE_WIDTH = 32;
const INFO_WIDTH = 288;
const ACTION_WIDTH = 112;
const AXIS_HEIGHT = 48;
const HORIZONTAL_PADDING = 24;
const SCROLL_STATE_INTERVAL_MS = 1000 / 30;

function observeTimelineRect(
  instance: Virtualizer<HTMLDivElement, Element>,
  callback: (rect: Rect) => void,
) {
  const element = instance.scrollElement;
  if (!element) return;
  const update = () =>
    callback({
      width: element.clientWidth || 1120,
      height: element.clientHeight || 560,
    });
  update();
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }
  window.addEventListener("resize", update);
  return () => window.removeEventListener("resize", update);
}

export type TimelineDisplayEntry =
  | {
      kind: "group";
      id: string;
      label: string;
      color: string;
      itemCount: number;
      collapsed: boolean;
    }
  | { kind: "item"; item: TimelineItemSummary };

function itemDateLabel(item: TimelineItemSummary) {
  if (item.temporalType === "point") {
    return `${item.isPointApproximate ? "約 " : ""}${formatHistoricalDate(item.point)}`;
  }
  const end =
    item.endDateStatus === "ongoing"
      ? "継続中"
      : item.endDateStatus === "unknown"
        ? `終了不明${item.lastConfirmed ? `（最終確認 ${formatHistoricalDate(item.lastConfirmed)}）` : ""}`
        : `${item.isEndApproximate ? "約 " : ""}${formatHistoricalDate(item.end)}`;
  return `${item.isStartApproximate ? "約 " : ""}${formatHistoricalDate(item.start)} — ${end}`;
}

function TimelineGlyph({
  item,
  currentDate,
  defaultUncertaintyYears,
  domainStart,
  pixelsPerDay,
  visibleStart,
  visibleEnd,
  onOpen,
  onCancelOpen,
}: {
  item: TimelineItemSummary;
  currentDate: HistoricalDate;
  defaultUncertaintyYears: number;
  domainStart: number;
  pixelsPerDay: number;
  visibleStart: number;
  visibleEnd: number;
  onOpen: () => void;
  onCancelOpen: () => void;
}) {
  const date = item.temporalType === "point" ? item.point : item.start;
  if (!date) return null;
  const registeredStart =
    HORIZONTAL_PADDING +
    (historicalDateOrdinal(date) - domainStart) * pixelsPerDay;
  const color = item.colorOverride ?? item.itemType.defaultColor;

  if (item.temporalType === "point") {
    if (
      !overlapsViewport(
        registeredStart,
        registeredStart,
        visibleStart,
        visibleEnd,
      )
    ) {
      return null;
    }
    return (
      <button
        aria-label={`${item.title}の詳細を表示 時点型マーカー ${formatHistoricalDate(item.point)}`}
        className="absolute top-1/2 z-10 size-4 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-white shadow-sm transition-[box-shadow,transform] hover:shadow-[0_0_0_3px_rgba(0,176,176,0.35)] focus-visible:shadow-[0_0_0_3px_rgba(0,176,176,0.45)] focus-visible:outline-none"
        data-timeline-item-glyph="true"
        style={{ left: registeredStart, backgroundColor: color }}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
      />
    );
  }

  const registeredEnd =
    HORIZONTAL_PADDING +
    (historicalDateOrdinal(timelineItemEndDate(item, currentDate), "end") -
      domainStart) *
      pixelsPerDay;
  const startFade = item.isStartApproximate
    ? uncertaintyWidth(
        item.startUncertaintyYears ?? defaultUncertaintyYears,
        pixelsPerDay,
        registeredStart,
      )
    : 0;
  const needsEndFade =
    item.endDateStatus === "unknown" || item.isEndApproximate;
  const endFade = needsEndFade
    ? uncertaintyWidth(
        item.endUncertaintyYears ?? defaultUncertaintyYears,
        pixelsPerDay,
        Number.POSITIVE_INFINITY,
      )
    : 0;
  const left = registeredStart - startFade;
  const right = Math.max(registeredStart + 1, registeredEnd + endFade);
  if (!overlapsViewport(left, right, visibleStart, visibleEnd)) return null;

  const width = right - left;
  const startStop = Math.min(100, (startFade / width) * 100);
  const endStop = Math.max(startStop, 100 - (endFade / width) * 100);
  const background =
    startFade > 0 || endFade > 0
      ? `linear-gradient(to right, ${startFade > 0 ? "transparent" : color} 0%, ${color} ${startStop}%, ${color} ${endStop}%, ${endFade > 0 ? "transparent" : color} 100%)`
      : color;

  return (
    <button
      aria-label={`${item.title}の詳細を表示 期間型バー ${itemDateLabel(item)}`}
      className={cn(
        "absolute top-1/2 h-3 min-w-1 -translate-y-1/2 rounded-sm border border-transparent transition-[box-shadow,border-color] hover:border-foreground/70 hover:shadow-[0_0_0_2px_rgba(255,255,255,0.9)] focus-visible:border-foreground focus-visible:shadow-[0_0_0_3px_rgba(0,176,176,0.35)] focus-visible:outline-none",
        item.endDateStatus === "ongoing" &&
          "after:absolute after:top-0 after:-right-1 after:h-3 after:w-1 after:bg-current",
      )}
      data-testid={`timeline-glyph-${item.id}`}
      data-timeline-item-glyph="true"
      style={{ left, width, background, color }}
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      onDoubleClick={() => onCancelOpen()}
    />
  );
}

function TimelineItemRow({
  item,
  canvasWidth,
  rowHeight,
  currentDate,
  defaultUncertaintyYears,
  domainStart,
  pixelsPerDay,
  visibleStart,
  visibleEnd,
  disabled,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onEdit,
  onOpenItem,
  events,
  draftEvent,
  onCreateEvent,
  onOpenEvent,
  isPanning,
}: {
  item: TimelineItemSummary;
  canvasWidth: number;
  rowHeight: number;
  currentDate: HistoricalDate;
  defaultUncertaintyYears: number;
  domainStart: number;
  pixelsPerDay: number;
  visibleStart: number;
  visibleEnd: number;
  disabled: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onOpenItem: () => void;
  events: TimelineEventSummary[];
  draftEvent: HistoricalDate | null;
  onCreateEvent: (date: HistoricalDate) => void;
  onOpenEvent: (eventId: string, editing: boolean) => void;
  isPanning: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: item.id,
      disabled,
    });
  const itemOpenTimerRef = useRef<number | null>(null);
  const eventOpenTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (itemOpenTimerRef.current !== null)
        window.clearTimeout(itemOpenTimerRef.current);
      if (eventOpenTimerRef.current !== null)
        window.clearTimeout(eventOpenTimerRef.current);
    },
    [],
  );

  function cancelItemOpen() {
    if (itemOpenTimerRef.current !== null)
      window.clearTimeout(itemOpenTimerRef.current);
    itemOpenTimerRef.current = null;
  }

  function scheduleItemOpen() {
    cancelItemOpen();
    itemOpenTimerRef.current = window.setTimeout(onOpenItem, 250);
  }

  function cancelEventOpen() {
    if (eventOpenTimerRef.current !== null)
      window.clearTimeout(eventOpenTimerRef.current);
    eventOpenTimerRef.current = null;
  }

  return (
    <div
      ref={setNodeRef}
      className="flex border-b bg-card"
      data-testid={`timeline-row-${item.id}`}
      style={{
        width: HANDLE_WIDTH + INFO_WIDTH + canvasWidth + ACTION_WIDTH,
        height: rowHeight,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <button
        aria-label={`${item.title}を並べ替え`}
        className="sticky left-0 z-20 flex shrink-0 cursor-grab items-center justify-center border-r bg-card text-muted-foreground disabled:cursor-not-allowed"
        disabled={disabled}
        style={{ width: HANDLE_WIDTH }}
        type="button"
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" className="size-4" />
      </button>
      <div
        className="sticky z-20 min-w-0 shrink-0 border-r bg-card px-3 py-2"
        style={{ left: HANDLE_WIDTH, width: INFO_WIDTH }}
      >
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-full"
            style={{
              backgroundColor: item.colorOverride ?? item.itemType.defaultColor,
            }}
          />
          <button
            className="truncate rounded-sm px-1 text-left text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            type="button"
            onClick={onOpenItem}
          >
            {item.title}
          </button>
          {!item.isVisible ? (
            <EyeOff aria-label="非表示" className="size-3.5" />
          ) : null}
        </div>
        {rowHeight >= 56 ? (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {item.itemType.name} · {itemDateLabel(item)}
          </p>
        ) : null}
      </div>
      <div
        className={cn(
          "relative shrink-0 cursor-grab overflow-hidden bg-muted/15 active:cursor-grabbing",
          isPanning && "cursor-grabbing",
        )}
        data-timeline-pan-surface="true"
        data-timeline-event-parent-id={
          item.temporalType === "range" ? item.id : undefined
        }
        style={{ width: canvasWidth }}
        onDoubleClick={(event) => {
          if (item.temporalType !== "range") return;
          const target = event.target;
          if (
            target instanceof Element &&
            target.closest("[data-timeline-event-marker='true']")
          )
            return;
          const rect = event.currentTarget.getBoundingClientRect();
          onCreateEvent(
            snapTimelineDate(
              event.clientX - rect.left - HORIZONTAL_PADDING,
              domainStart,
              pixelsPerDay,
            ),
          );
        }}
      >
        <TimelineGlyph
          currentDate={currentDate}
          defaultUncertaintyYears={defaultUncertaintyYears}
          domainStart={domainStart}
          item={item}
          pixelsPerDay={pixelsPerDay}
          visibleEnd={visibleEnd}
          visibleStart={visibleStart}
          onCancelOpen={cancelItemOpen}
          onOpen={scheduleItemOpen}
        />
        {events.map((timelineEvent) => {
          const left =
            HORIZONTAL_PADDING +
            eventX(timelineEvent.date, domainStart, pixelsPerDay);
          if (!overlapsViewport(left, left, visibleStart, visibleEnd))
            return null;
          return (
            <Tooltip key={timelineEvent.id}>
              <TooltipTrigger asChild>
                <button
                  aria-label={`イベントアイテム ${timelineEvent.title} ${formatHistoricalDate(timelineEvent.date)}`}
                  className="focus-visible:ring-focus absolute top-1/2 z-10 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-secondary shadow-sm transition-[box-shadow,transform] hover:scale-125 hover:shadow-[0_0_0_3px_rgba(255,51,153,0.25)] focus-visible:scale-125 focus-visible:ring-2 focus-visible:outline-none"
                  data-timeline-event-marker="true"
                  style={{ left }}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    cancelEventOpen();
                    eventOpenTimerRef.current = window.setTimeout(
                      () => onOpenEvent(timelineEvent.id, false),
                      250,
                    );
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    cancelEventOpen();
                    onOpenEvent(timelineEvent.id, true);
                  }}
                />
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <p className="font-medium">{timelineEvent.title}</p>
                  <p className="text-xs text-muted-foreground">
                    登録日付: {timelineEvent.isApproximate ? "約 " : ""}
                    {formatHistoricalDate(timelineEvent.date)}
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
        {draftEvent ? (
          <span
            aria-label={`仮マーカー ${formatHistoricalDate(draftEvent)}`}
            className="absolute top-1/2 z-10 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-secondary bg-secondary/20"
            style={{
              left:
                HORIZONTAL_PADDING +
                eventX(draftEvent, domainStart, pixelsPerDay),
            }}
          />
        ) : null}
      </div>
      <div
        className="sticky right-0 z-20 flex shrink-0 items-center gap-1 border-l bg-card px-2"
        style={{ width: ACTION_WIDTH }}
      >
        <Button
          aria-label={`${item.title}を上へ移動`}
          disabled={disabled || !canMoveUp}
          size="icon-sm"
          variant="ghost"
          onClick={onMoveUp}
        >
          <ArrowUp aria-hidden="true" className="size-4" />
        </Button>
        <Button
          aria-label={`${item.title}を下へ移動`}
          disabled={disabled || !canMoveDown}
          size="icon-sm"
          variant="ghost"
          onClick={onMoveDown}
        >
          <ArrowDown aria-hidden="true" className="size-4" />
        </Button>
        <Button
          aria-label={`${item.title}を編集`}
          size="icon-sm"
          variant="ghost"
          onClick={onEdit}
        >
          <Pencil aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function TimelineViewport({
  project,
  entries,
  allItems,
  currentDate,
  sortDisabled,
  onToggleGroup,
  onMove,
  onEdit,
  events,
  draftEvent,
  onCreateEvent,
  onOpenEvent,
  onOpenItem,
}: {
  project: Project;
  entries: TimelineDisplayEntry[];
  allItems: TimelineItemSummary[];
  currentDate: HistoricalDate;
  sortDisabled: boolean;
  onToggleGroup: (typeId: string) => void;
  onMove: (itemId: string, offset: -1 | 1) => void;
  onEdit: (itemId: string) => void;
  events: TimelineEventSummary[];
  draftEvent: { parentId: string; date: HistoricalDate } | null;
  onCreateEvent: (parentId: string, date: HistoricalDate) => void;
  onOpenEvent: (eventId: string, editing: boolean) => void;
  onOpenItem: (itemId: string) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<{ x: number; scrollLeft: number } | null>(null);
  const lastSurfacePressRef = useRef<{
    parentId: string;
    clientX: number;
    time: number;
  } | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const pendingScrollLeftRef = useRef(0);
  const lastScrollSyncRef = useRef(Number.NEGATIVE_INFINITY);
  const pendingZoomRef = useRef<
    | { oldScale: number; oldScrollLeft: number; cursorX: number }
    | { fit: true }
    | null
  >({ fit: true });
  const [viewportWidth, setViewportWidth] = useState(1120);
  const [viewportMeasured, setViewportMeasured] = useState(false);
  const zoomLevel = useTimelineStore((state) => state.zoomLevel);
  const setZoomLevel = useTimelineStore((state) => state.setZoomLevel);
  const scrollLeft = useTimelineStore((state) => state.scrollLeft);
  const setScrollLeft = useTimelineStore((state) => state.setScrollLeft);
  const density = useTimelineStore((state) => state.density);
  const setDensity = useTimelineStore((state) => state.setDensity);
  const isPanning = useTimelineStore((state) => state.isPanning);
  const setPanning = useTimelineStore((state) => state.setPanning);
  const timelineViewportWidth = Math.max(
    240,
    viewportWidth - HANDLE_WIDTH - INFO_WIDTH - ACTION_WIDTH,
  );
  const eventsByParent = useMemo(() => {
    const grouped = new Map<string, TimelineEventSummary[]>();
    for (const timelineEvent of events) {
      const current = grouped.get(timelineEvent.timelineItemId) ?? [];
      current.push(timelineEvent);
      grouped.set(timelineEvent.timelineItemId, current);
    }
    return grouped;
  }, [events]);

  const scheduleScrollSync = useCallback(
    (nextScrollLeft: number) => {
      pendingScrollLeftRef.current = nextScrollLeft;
      if (scrollFrameRef.current !== null) return;

      const syncOnFrame = (timestamp: number) => {
        if (timestamp - lastScrollSyncRef.current < SCROLL_STATE_INTERVAL_MS) {
          scrollFrameRef.current = requestAnimationFrame(syncOnFrame);
          return;
        }
        scrollFrameRef.current = null;
        lastScrollSyncRef.current = timestamp;
        setScrollLeft(pendingScrollLeftRef.current);
      };

      scrollFrameRef.current = requestAnimationFrame(syncOnFrame);
    },
    [setScrollLeft],
  );

  const flushScrollSync = useCallback(
    (nextScrollLeft: number) => {
      pendingScrollLeftRef.current = nextScrollLeft;
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
      lastScrollSyncRef.current = performance.now();
      setScrollLeft(nextScrollLeft);
    },
    [setScrollLeft],
  );

  const bounds = useMemo(() => {
    const configuredStart = historicalDateOrdinal({
      year: project.settings.initialStartYear,
      month: 1,
      day: 1,
    });
    const configuredEnd = historicalDateOrdinal(
      { year: project.settings.initialEndYear, month: 12, day: 31 },
      "end",
    );
    if (allItems.length === 0) {
      return {
        domainStart: configuredStart,
        domainEnd: configuredEnd,
        fitStart: configuredStart,
        fitEnd: configuredEnd,
      };
    }
    const itemBounds = allItems.map((item) =>
      timelineItemVisualBounds(
        item,
        currentDate,
        project.settings.defaultUncertaintyYears,
      ),
    );
    const rawFitStart = Math.min(...itemBounds.map((bound) => bound.start));
    const rawFitEnd = Math.max(...itemBounds.map((bound) => bound.end));
    const { start: fitStart, end: fitEnd } = expandDegenerateFitRange(
      rawFitStart,
      rawFitEnd,
    );
    const margin = Math.max(366, (fitEnd - fitStart) * 0.05);
    return {
      domainStart: Math.max(0, Math.min(configuredStart, fitStart) - margin),
      domainEnd: Math.max(configuredEnd, fitEnd) + margin,
      fitStart,
      fitEnd,
    };
  }, [allItems, currentDate, project.settings]);

  const fitScale = fitPixelsPerDay(
    historicalDateFromOrdinal(bounds.fitStart),
    historicalDateFromOrdinal(bounds.fitEnd),
    timelineViewportWidth,
    HORIZONTAL_PADDING,
  );
  const pixelsPerDay = scaleForZoomLevel(zoomLevel, fitScale);
  const canvasWidth = Math.max(
    timelineViewportWidth,
    HORIZONTAL_PADDING * 2 +
      (bounds.domainEnd - bounds.domainStart) * pixelsPerDay,
  );
  const rowHeight = density === "compact" ? 44 : 64;

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const updateWidth = () => {
      setViewportWidth(element.clientWidth || 1120);
      setViewportMeasured(true);
    };
    updateWidth();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const pointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target;
      if (
        !(target instanceof Element) ||
        target.closest("[data-timeline-event-marker='true']") ||
        target.closest("[data-timeline-item-glyph='true']") ||
        !target.closest("[data-timeline-pan-surface='true']")
      ) {
        return;
      }
      const eventSurface = target.closest<HTMLElement>(
        "[data-timeline-event-parent-id]",
      );
      if (eventSurface?.dataset.timelineEventParentId) {
        const parentId = eventSurface.dataset.timelineEventParentId;
        const previous = lastSurfacePressRef.current;
        const isDoublePress =
          previous?.parentId === parentId &&
          event.timeStamp - previous.time <= 500 &&
          Math.abs(event.clientX - previous.clientX) <= 8;
        if (isDoublePress) {
          lastSurfacePressRef.current = null;
          const rect = eventSurface.getBoundingClientRect();
          onCreateEvent(
            parentId,
            snapTimelineDate(
              event.clientX - rect.left - HORIZONTAL_PADDING,
              bounds.domainStart,
              pixelsPerDay,
            ),
          );
          return;
        }
        lastSurfacePressRef.current = {
          parentId,
          clientX: event.clientX,
          time: event.timeStamp,
        };
      }
      pointerRef.current = {
        x: event.clientX,
        scrollLeft: viewport.scrollLeft,
      };
      viewport.setPointerCapture(event.pointerId);
      setPanning(true);
    };
    const pointerMove = (event: PointerEvent) => {
      const pointer = pointerRef.current;
      if (!pointer) return;
      viewport.scrollLeft = pointer.scrollLeft - (event.clientX - pointer.x);
    };
    const pointerEnd = (event: PointerEvent) => {
      if (!pointerRef.current) return;
      pointerRef.current = null;
      if (viewport.hasPointerCapture(event.pointerId)) {
        viewport.releasePointerCapture(event.pointerId);
      }
      flushScrollSync(viewport.scrollLeft);
      setPanning(false);
    };

    viewport.addEventListener("pointerdown", pointerDown);
    viewport.addEventListener("pointermove", pointerMove);
    viewport.addEventListener("pointerup", pointerEnd);
    viewport.addEventListener("pointercancel", pointerEnd);
    return () => {
      viewport.removeEventListener("pointerdown", pointerDown);
      viewport.removeEventListener("pointermove", pointerMove);
      viewport.removeEventListener("pointerup", pointerEnd);
      viewport.removeEventListener("pointercancel", pointerEnd);
    };
  }, [
    bounds.domainStart,
    flushScrollSync,
    onCreateEvent,
    pixelsPerDay,
    setPanning,
  ]);

  useLayoutEffect(() => {
    const element = viewportRef.current;
    if (!element || !viewportMeasured) return;
    const pending = pendingZoomRef.current;
    if (pending && "fit" in pending) {
      element.scrollLeft = Math.max(
        0,
        HORIZONTAL_PADDING +
          (bounds.fitStart - bounds.domainStart) * pixelsPerDay -
          HORIZONTAL_PADDING,
      );
    } else if (pending) {
      element.scrollLeft = scrollLeftAfterZoom(
        pending.oldScrollLeft,
        pending.cursorX,
        pending.oldScale,
        pixelsPerDay,
        HORIZONTAL_PADDING,
      );
    }
    pendingZoomRef.current = null;
    setScrollLeft(element.scrollLeft);
  }, [
    bounds.domainStart,
    bounds.fitStart,
    pixelsPerDay,
    setScrollLeft,
    viewportMeasured,
  ]);

  // TanStack Virtual intentionally manages mutable measurements outside React Compiler.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: (index) =>
      entries[index]?.kind === "group" ? 40 : rowHeight,
    overscan: 8,
    observeElementRect: observeTimelineRect,
    initialRect: { width: viewportWidth, height: 560 },
  });

  useLayoutEffect(() => {
    virtualizer.measure();
  }, [density, virtualizer]);

  const virtualItems = virtualizer.getVirtualItems();
  const visibleItemCount = virtualItems.filter(
    (virtualRow) => entries[virtualRow.index]?.kind === "item",
  ).length;

  const visibleStart = scrollLeft;
  const visibleEnd = scrollLeft + timelineViewportWidth;
  const visibleStartOrdinal = Math.max(
    bounds.domainStart,
    bounds.domainStart + (visibleStart - HORIZONTAL_PADDING) / pixelsPerDay,
  );
  const visibleEndOrdinal = Math.min(
    bounds.domainEnd,
    bounds.domainStart + (visibleEnd - HORIZONTAL_PADDING) / pixelsPerDay,
  );
  const { unit, ticks } = useMemo(
    () =>
      generateTimelineTicks(
        visibleStartOrdinal,
        visibleEndOrdinal,
        pixelsPerDay,
        project.settings.minimumTimeUnit,
      ),
    [
      pixelsPerDay,
      project.settings.minimumTimeUnit,
      visibleEndOrdinal,
      visibleStartOrdinal,
    ],
  );

  function changeZoom(nextLevel: number, cursorX = timelineViewportWidth / 2) {
    const normalized = Math.max(0, Math.min(ZOOM_LABELS.length - 1, nextLevel));
    if (normalized === zoomLevel) return;
    const element = viewportRef.current;
    if (!element) return;
    pendingZoomRef.current = {
      oldScale: pixelsPerDay,
      oldScrollLeft: element.scrollLeft,
      cursorX,
    };
    setZoomLevel(normalized);
  }

  function fitRange() {
    pendingZoomRef.current = { fit: true };
    if (zoomLevel === 0) {
      const element = viewportRef.current;
      if (element) {
        element.scrollLeft = Math.max(
          0,
          HORIZONTAL_PADDING +
            (bounds.fitStart - bounds.domainStart) * pixelsPerDay -
            HORIZONTAL_PADDING,
        );
        setScrollLeft(element.scrollLeft);
      }
      pendingZoomRef.current = null;
    } else {
      setZoomLevel(0);
    }
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (!event.altKey) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const cursorX = Math.max(
      0,
      event.clientX - rect.left - HANDLE_WIDTH - INFO_WIDTH,
    );
    changeZoom(zoomLevel + (event.deltaY < 0 ? 1 : -1), cursorX);
  }

  return (
    <TooltipProvider>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-2">
          <Button
            aria-label="縮小"
            disabled={zoomLevel === 0}
            size="icon-sm"
            variant="outline"
            onClick={() => changeZoom(zoomLevel - 1)}
          >
            <Minus aria-hidden="true" className="size-4" />
          </Button>
          <label className="flex items-center gap-2 text-sm">
            ズーム
            <input
              aria-label="ズーム段階"
              className="w-36 accent-primary"
              max={ZOOM_LABELS.length - 1}
              min={0}
              step={1}
              type="range"
              value={zoomLevel}
              onChange={(event) => changeZoom(Number(event.target.value))}
            />
          </label>
          <Button
            aria-label="拡大"
            disabled={zoomLevel === ZOOM_LABELS.length - 1}
            size="icon-sm"
            variant="outline"
            onClick={() => changeZoom(zoomLevel + 1)}
          >
            <Plus aria-hidden="true" className="size-4" />
          </Button>
          <Badge variant="outline">{ZOOM_LABELS[zoomLevel]}</Badge>
          <Button size="sm" variant="outline" onClick={fitRange}>
            <Maximize2 aria-hidden="true" className="size-4" />
            全項目を表示
          </Button>
          <label className="flex items-center gap-2 text-sm">
            表示密度
            <select
              aria-label="表示密度"
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              value={density}
              onChange={(event) =>
                setDensity(event.target.value as "compact" | "comfortable")
              }
            >
              <option value="comfortable">標準</option>
              <option value="compact">コンパクト</option>
            </select>
          </label>
          <span className="text-xs text-muted-foreground">目盛り {unit}</span>
          <span className="text-xs text-muted-foreground">
            Alt＋ホイールでカーソル中心にズーム
          </span>
        </div>

        <div
          ref={viewportRef}
          aria-label="タイムライン表示領域"
          className={cn(
            "relative max-h-[36rem] overflow-auto rounded-lg border bg-card select-none",
            isPanning && "cursor-grabbing",
          )}
          data-testid="timeline-viewport"
          tabIndex={0}
          onScroll={(event) =>
            scheduleScrollSync(event.currentTarget.scrollLeft)
          }
          onWheel={handleWheel}
        >
          <div
            className="relative transition-[width] duration-150"
            style={{
              width: HANDLE_WIDTH + INFO_WIDTH + canvasWidth + ACTION_WIDTH,
              height: AXIS_HEIGHT + virtualizer.getTotalSize(),
            }}
          >
            <div className="sticky top-0 z-30 flex h-12 border-b bg-muted/95 text-xs font-medium text-muted-foreground backdrop-blur-sm">
              <span
                className="sticky left-0 z-40 shrink-0 border-r bg-muted"
                style={{ width: HANDLE_WIDTH }}
              />
              <span
                className="sticky z-40 shrink-0 border-r bg-muted px-3 py-4"
                style={{ left: HANDLE_WIDTH, width: INFO_WIDTH }}
              >
                タイムライン
              </span>
              <div
                className="relative shrink-0 overflow-hidden"
                style={{ width: canvasWidth }}
                data-timeline-pan-surface="true"
              >
                {ticks.map((tick) => {
                  const left =
                    HORIZONTAL_PADDING +
                    (tick.ordinal - bounds.domainStart) * pixelsPerDay;
                  return (
                    <span
                      key={`${unit}-${tick.ordinal}`}
                      className={cn(
                        "absolute inset-y-0 border-l",
                        tick.major ? "border-foreground/35" : "border-border",
                      )}
                      style={{ left }}
                    >
                      {tick.label ? (
                        <span className="absolute top-1 left-1 whitespace-nowrap">
                          {tick.label}
                        </span>
                      ) : null}
                    </span>
                  );
                })}
              </div>
              <span
                className="sticky right-0 z-40 shrink-0 border-l bg-muted"
                style={{ width: ACTION_WIDTH }}
              />
            </div>

            <div
              className="absolute right-0 left-0"
              style={{ top: AXIS_HEIGHT }}
            >
              {virtualItems.map((virtualRow) => {
                const entry = entries[virtualRow.index];
                if (!entry) return null;
                return (
                  <div
                    key={
                      entry.kind === "group"
                        ? `group-${entry.id}`
                        : entry.item.id
                    }
                    className="absolute top-0 left-0"
                    data-index={virtualRow.index}
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    {entry.kind === "group" ? (
                      <div
                        className="h-10 border-b bg-muted"
                        style={{
                          width:
                            HANDLE_WIDTH +
                            INFO_WIDTH +
                            canvasWidth +
                            ACTION_WIDTH,
                        }}
                      >
                        <button
                          aria-expanded={!entry.collapsed}
                          aria-label={`${entry.label} ${entry.itemCount}件`}
                          className="sticky left-0 flex h-10 items-center gap-2 bg-muted px-3 text-left text-sm font-medium"
                          style={{ width: HANDLE_WIDTH + INFO_WIDTH }}
                          type="button"
                          onClick={() => onToggleGroup(entry.id)}
                        >
                          {entry.collapsed ? (
                            <ChevronRight className="size-4" />
                          ) : (
                            <ChevronDown className="size-4" />
                          )}
                          <span
                            className="size-2.5 rounded-full"
                            style={{ backgroundColor: entry.color }}
                          />
                          {entry.label}
                          <Badge variant="outline">{entry.itemCount}</Badge>
                        </button>
                      </div>
                    ) : (
                      <TimelineItemRow
                        canMoveDown={
                          entry.item.manualOrder < allItems.length - 1
                        }
                        canMoveUp={entry.item.manualOrder > 0}
                        canvasWidth={canvasWidth}
                        currentDate={currentDate}
                        defaultUncertaintyYears={
                          project.settings.defaultUncertaintyYears
                        }
                        disabled={sortDisabled}
                        domainStart={bounds.domainStart}
                        isPanning={isPanning}
                        item={entry.item}
                        events={eventsByParent.get(entry.item.id) ?? []}
                        draftEvent={
                          draftEvent?.parentId === entry.item.id
                            ? draftEvent.date
                            : null
                        }
                        pixelsPerDay={pixelsPerDay}
                        rowHeight={rowHeight}
                        visibleEnd={visibleEnd}
                        visibleStart={visibleStart}
                        onEdit={() => onEdit(entry.item.id)}
                        onOpenItem={() => onOpenItem(entry.item.id)}
                        onCreateEvent={(date) =>
                          onCreateEvent(entry.item.id, date)
                        }
                        onOpenEvent={onOpenEvent}
                        onMoveDown={() => onMove(entry.item.id, 1)}
                        onMoveUp={() => onMove(entry.item.id, -1)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          横方向へドラッグ、スクロールバー、トラックパッドで移動できます。表示中{" "}
          {visibleItemCount} / {allItems.length} 行
        </p>
      </div>
    </TooltipProvider>
  );
}
