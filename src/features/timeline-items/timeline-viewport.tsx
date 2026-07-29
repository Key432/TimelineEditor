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
  Clock3,
  EyeOff,
  GripVertical,
  Maximize2,
  Minus,
  Pencil,
  Plus,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type WheelEvent as ReactWheelEvent,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ItemTypeIcon } from "@/features/item-types/item-type-icon";
import { eventX, snapTimelineDate } from "@/features/timeline-events/snap";
import { TimelineEventMarkers } from "@/features/timeline-events/timeline-event-markers";
import type { TimelineEventSummary } from "@/features/timeline-events/types";
import {
  formatApproximateHistoricalDate,
  formatHistoricalDate,
  historicalDateFromOrdinal,
  historicalDateOrdinal,
} from "@/features/timeline-items/historical-date";
import { TimelineEntityTooltip } from "@/features/timeline-items/timeline-entity-tooltip";
import {
  calculateCompactLaneLayout,
  measureCompactLaneTitle,
  type CompactLanePlacement,
} from "@/features/timeline-items/compact-lane-layout";
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
  TimelineLayoutMode,
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
const COMPACT_LANE_COMFORTABLE_HEIGHT = 56;
const COMPACT_LANE_DENSE_HEIGHT = 44;
const EMPTY_ID_SET: ReadonlySet<string> = new Set();

function isCoarsePointer() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

function capturePointer(element: HTMLElement, pointerId: number) {
  try {
    element.setPointerCapture?.(pointerId);
  } catch {
    // The pointer may have ended between dispatch and capture.
  }
}

function zoomLevelForInitialPreset(
  preset: Project["settings"]["initialZoomPreset"],
) {
  switch (preset) {
    case "fit-range":
      return 0;
    case "century":
      return 1;
    case "decade":
      return 2;
    case "year":
      return 3;
  }
}

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

export type TimelineDisplayGroup = {
  id: string;
  label: string;
  color: string;
  icon: string | null;
  showHeader: boolean;
  items: TimelineItemSummary[];
  collapsed: boolean;
};

type CompactLaneDisplayPlacement = CompactLanePlacement & {
  item: TimelineItemSummary;
};

type TimelineDisplayEntry =
  | {
      kind: "group";
      id: string;
      label: string;
      color: string;
      icon: string | null;
      itemCount: number;
      collapsed: boolean;
    }
  | { kind: "item"; item: TimelineItemSummary }
  | {
      kind: "lane";
      id: string;
      placements: CompactLaneDisplayPlacement[];
    };

function itemDateLabel(item: TimelineItemSummary) {
  if (item.temporalType === "point") {
    return formatApproximateHistoricalDate(item.point, item.isPointApproximate);
  }
  const end =
    item.endDateStatus === "ongoing"
      ? "継続中"
      : item.endDateStatus === "unknown"
        ? `終了不明${item.lastConfirmed ? `（最終確認 ${formatHistoricalDate(item.lastConfirmed)}）` : ""}`
        : formatApproximateHistoricalDate(item.end, item.isEndApproximate);
  return `${formatApproximateHistoricalDate(item.start, item.isStartApproximate)} — ${end}`;
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
  onEdit,
  editOnDoubleClick = false,
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
  onEdit: () => void;
  editOnDoubleClick?: boolean;
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
      <TimelineEntityTooltip date={itemDateLabel(item)} title={item.title}>
        <button
          aria-label={`${item.title}の詳細を表示 時点型マーカー ${formatHistoricalDate(item.point)}`}
          className="absolute top-1/2 z-10 size-4 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-white shadow-sm transition-[box-shadow,transform] hover:z-20 hover:scale-125 hover:ring-2 hover:ring-secondary hover:ring-inset focus-visible:z-20 focus-visible:scale-125 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none focus-visible:ring-inset"
          data-timeline-item-glyph="true"
          style={{ left: registeredStart, backgroundColor: color }}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          onDoubleClick={(event) => {
            onCancelOpen();
            if (editOnDoubleClick) {
              event.stopPropagation();
              onEdit();
            }
          }}
        />
      </TimelineEntityTooltip>
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
    <TimelineEntityTooltip date={itemDateLabel(item)} title={item.title}>
      <button
        aria-label={`${item.title}の詳細を表示 期間型バー ${itemDateLabel(item)}`}
        className={cn(
          "absolute top-1/2 h-3 min-w-1 -translate-y-1/2 rounded-sm border border-transparent transition-[box-shadow,border-color,transform] hover:z-20 hover:scale-y-125 hover:border-secondary hover:ring-2 hover:ring-secondary hover:ring-inset focus-visible:z-20 focus-visible:scale-y-125 focus-visible:border-secondary focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none focus-visible:ring-inset",
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
        onDoubleClick={(event) => {
          onCancelOpen();
          if (editOnDoubleClick) {
            event.stopPropagation();
            onEdit();
          }
        }}
      />
    </TimelineEntityTooltip>
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
  showItemType,
  dimmed,
  highlightedEventIds,
  readOnly,
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
  showItemType: boolean;
  dimmed: boolean;
  highlightedEventIds: ReadonlySet<string>;
  readOnly: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: item.id,
      disabled,
    });
  const itemOpenTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (itemOpenTimerRef.current !== null)
        window.clearTimeout(itemOpenTimerRef.current);
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

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex border-b bg-card transition-opacity",
        dimmed && "opacity-30 grayscale",
      )}
      data-testid={`timeline-row-${item.id}`}
      style={{
        width: HANDLE_WIDTH + INFO_WIDTH + canvasWidth + ACTION_WIDTH,
        height: rowHeight,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      {readOnly ? (
        <span
          aria-hidden="true"
          className="sticky left-0 z-40 shrink-0 border-r bg-card"
          data-timeline-fixed-column="reorder"
          style={{ width: HANDLE_WIDTH }}
        />
      ) : (
        <button
          aria-label={`${item.title}を並べ替え`}
          className="sticky left-0 z-40 flex shrink-0 cursor-grab items-center justify-center border-r bg-card text-muted-foreground disabled:cursor-not-allowed"
          data-timeline-fixed-column="reorder"
          disabled={disabled}
          style={{ width: HANDLE_WIDTH }}
          type="button"
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden="true" className="size-4" />
        </button>
      )}
      <div
        className="sticky z-40 min-w-0 shrink-0 border-r bg-card px-3 py-2"
        data-timeline-fixed-column="info"
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
            {showItemType ? `${item.itemType.name} · ` : ""}
            {itemDateLabel(item)}
          </p>
        ) : null}
      </div>
      <div
        className={cn(
          "relative isolate shrink-0 cursor-grab overflow-hidden bg-muted/15 active:cursor-grabbing",
          isPanning && "cursor-grabbing",
        )}
        data-timeline-pan-surface="true"
        data-timeline-event-parent-id={
          item.temporalType === "range" ? item.id : undefined
        }
        style={{ width: canvasWidth }}
        onDoubleClick={(event) => {
          if (readOnly) return;
          if (isCoarsePointer()) return;
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
          onEdit={onEdit}
          onOpen={scheduleItemOpen}
        />
        <TimelineEventMarkers
          domainStart={domainStart}
          events={events}
          horizontalPadding={HORIZONTAL_PADDING}
          pixelsPerDay={pixelsPerDay}
          visibleEnd={visibleEnd}
          visibleStart={visibleStart}
          highlightedEventIds={highlightedEventIds}
          onOpenEvent={onOpenEvent}
        />
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
        className="sticky right-0 z-40 flex shrink-0 items-center gap-1 border-l bg-card px-2"
        data-timeline-fixed-column="actions"
        style={{ width: ACTION_WIDTH }}
      >
        {!readOnly ? (
          <>
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
          </>
        ) : null}
      </div>
    </div>
  );
}

function CompactLaneItem({
  placement,
  currentDate,
  defaultUncertaintyYears,
  domainStart,
  pixelsPerDay,
  visibleStart,
  visibleEnd,
  events,
  draftEvent,
  onEdit,
  onOpenEvent,
  onOpenItem,
  dimmed,
  highlightedEventIds,
  readOnly,
}: {
  placement: CompactLaneDisplayPlacement;
  currentDate: HistoricalDate;
  defaultUncertaintyYears: number;
  domainStart: number;
  pixelsPerDay: number;
  visibleStart: number;
  visibleEnd: number;
  events: TimelineEventSummary[];
  draftEvent: HistoricalDate | null;
  onEdit: () => void;
  onOpenEvent: (eventId: string, editing: boolean) => void;
  onOpenItem: () => void;
  dimmed: boolean;
  highlightedEventIds: ReadonlySet<string>;
  readOnly: boolean;
}) {
  const item = placement.item;
  const itemOpenTimerRef = useRef<number | null>(null);
  const date = item.temporalType === "point" ? item.point : item.start;
  const titleLeft = date
    ? HORIZONTAL_PADDING +
      (historicalDateOrdinal(date) - domainStart) * pixelsPerDay
    : HORIZONTAL_PADDING;
  const currentVisualBounds = timelineItemVisualBounds(
    item,
    currentDate,
    defaultUncertaintyYears,
  );
  const eventSurfaceLeft =
    HORIZONTAL_PADDING +
    (currentVisualBounds.start - domainStart) * pixelsPerDay;
  const eventSurfaceWidth = Math.max(
    1,
    (currentVisualBounds.end - currentVisualBounds.start) * pixelsPerDay,
  );

  useEffect(
    () => () => {
      if (itemOpenTimerRef.current !== null) {
        window.clearTimeout(itemOpenTimerRef.current);
      }
    },
    [],
  );

  function cancelItemOpen() {
    if (itemOpenTimerRef.current !== null) {
      window.clearTimeout(itemOpenTimerRef.current);
    }
    itemOpenTimerRef.current = null;
  }

  function scheduleItemOpen() {
    cancelItemOpen();
    itemOpenTimerRef.current = window.setTimeout(onOpenItem, 250);
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 transition-opacity [&_button]:pointer-events-auto",
        dimmed && "opacity-30 grayscale",
      )}
    >
      <TimelineEntityTooltip date={itemDateLabel(item)} title={item.title}>
        <button
          aria-label={`${item.title}の詳細を表示`}
          className="absolute top-1 z-20 max-w-none truncate rounded-sm px-1 text-left text-sm font-medium whitespace-nowrap transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          data-timeline-item-glyph="true"
          style={{ left: titleLeft }}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            scheduleItemOpen();
          }}
          onDoubleClick={(event) => {
            if (readOnly) return;
            event.stopPropagation();
            cancelItemOpen();
            onEdit();
          }}
        >
          {item.title}
        </button>
      </TimelineEntityTooltip>
      {item.temporalType === "range" ? (
        <div
          className="absolute bottom-0 z-0 h-7"
          data-timeline-event-parent-id={item.id}
          data-timeline-pan-surface="true"
          style={{
            left: eventSurfaceLeft,
            width: eventSurfaceWidth,
          }}
        />
      ) : null}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-7 [&_button]:pointer-events-auto">
        <TimelineGlyph
          currentDate={currentDate}
          defaultUncertaintyYears={defaultUncertaintyYears}
          domainStart={domainStart}
          editOnDoubleClick={!readOnly}
          item={item}
          pixelsPerDay={pixelsPerDay}
          visibleEnd={visibleEnd}
          visibleStart={visibleStart}
          onCancelOpen={cancelItemOpen}
          onEdit={onEdit}
          onOpen={scheduleItemOpen}
        />
        <TimelineEventMarkers
          domainStart={domainStart}
          events={events}
          horizontalPadding={HORIZONTAL_PADDING}
          pixelsPerDay={pixelsPerDay}
          visibleEnd={visibleEnd}
          visibleStart={visibleStart}
          highlightedEventIds={highlightedEventIds}
          onOpenEvent={onOpenEvent}
        />
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
    </div>
  );
}

export function TimelineViewport({
  project,
  groups,
  allItems,
  currentDate,
  layoutMode,
  sortDisabled,
  onToggleGroup,
  onMove,
  onEdit,
  events,
  draftEvent,
  onCreateEvent,
  onOpenEvent,
  onOpenItem,
  showItemType,
  dimmedItemIds,
  highlightedEventIds,
  readOnly = false,
}: {
  project: Project;
  groups: TimelineDisplayGroup[];
  allItems: TimelineItemSummary[];
  currentDate: HistoricalDate;
  layoutMode: TimelineLayoutMode;
  sortDisabled: boolean;
  onToggleGroup: (typeId: string) => void;
  onMove: (itemId: string, offset: -1 | 1) => void;
  onEdit: (itemId: string) => void;
  events: TimelineEventSummary[];
  draftEvent: { parentId: string; date: HistoricalDate } | null;
  onCreateEvent: (parentId: string, date: HistoricalDate) => void;
  onOpenEvent: (eventId: string, editing: boolean) => void;
  onOpenItem: (itemId: string) => void;
  showItemType: boolean;
  dimmedItemIds?: ReadonlySet<string>;
  highlightedEventIds?: ReadonlySet<string>;
  readOnly?: boolean;
}) {
  const dimmed = dimmedItemIds ?? EMPTY_ID_SET;
  const highlightedEvents = highlightedEventIds ?? EMPTY_ID_SET;
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<{
    x: number;
    y: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const touchPointsRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchDistanceRef = useRef<number | null>(null);
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
  const compactReferenceRef = useRef<{
    items: TimelineItemSummary[];
    events: TimelineEventSummary[];
    initialZoomPreset: Project["settings"]["initialZoomPreset"];
    initialStartYear: number;
    initialEndYear: number;
    pixelsPerDay: number;
  } | null>(null);
  const [viewportWidth, setViewportWidth] = useState(1120);
  const [viewportMeasured, setViewportMeasured] = useState(false);
  const [pointerGuide, setPointerGuide] = useState<{
    left: number;
    label: string;
  } | null>(null);
  const [timeSlice, setTimeSlice] = useState<{
    startOrdinal: number;
    endOrdinal: number;
  } | null>(null);
  const [timeSlicerVisible, setTimeSlicerVisible] = useState(false);
  const [floatingControlsExpanded, setFloatingControlsExpanded] =
    useState(false);
  const zoomLevel = useTimelineStore((state) => state.zoomLevel);
  const setZoomLevel = useTimelineStore((state) => state.setZoomLevel);
  const scrollLeft = useTimelineStore((state) => state.scrollLeft);
  const setScrollLeft = useTimelineStore((state) => state.setScrollLeft);
  const density = useTimelineStore((state) => state.density);
  const setDensity = useTimelineStore((state) => state.setDensity);
  const isPanning = useTimelineStore((state) => state.isPanning);
  const setPanning = useTimelineStore((state) => state.setPanning);
  const setViewport = useTimelineStore((state) => state.setViewport);
  const navigationRequest = useTimelineStore(
    (state) => state.navigationRequest,
  );
  const rowChromeWidth =
    layoutMode === "row" ? HANDLE_WIDTH + INFO_WIDTH + ACTION_WIDTH : 0;
  const timelineViewportWidth = Math.max(240, viewportWidth - rowChromeWidth);
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
    const eventOrdinals = events.map((timelineEvent) =>
      historicalDateOrdinal(timelineEvent.date),
    );
    const rawFitStart = Math.min(
      ...itemBounds.map((bound) => bound.start),
      ...eventOrdinals,
    );
    const rawFitEnd = Math.max(
      ...itemBounds.map((bound) => bound.end),
      ...eventOrdinals,
    );
    const { start: fitStart, end: fitEnd } = expandDegenerateFitRange(
      rawFitStart,
      rawFitEnd,
    );
    const margin = Math.max(366, (fitEnd - fitStart) * 0.05);
    return {
      domainStart: Math.min(configuredStart, fitStart) - margin,
      domainEnd: Math.max(configuredEnd, fitEnd) + margin,
      fitStart,
      fitEnd,
    };
  }, [allItems, currentDate, events, project.settings]);

  const fitScale = fitPixelsPerDay(
    historicalDateFromOrdinal(bounds.fitStart),
    historicalDateFromOrdinal(bounds.fitEnd),
    timelineViewportWidth,
    HORIZONTAL_PADDING,
  );
  const pixelsPerDay = scaleForZoomLevel(zoomLevel, fitScale);
  const baseCanvasWidth = Math.max(
    timelineViewportWidth,
    HORIZONTAL_PADDING * 2 +
      (bounds.domainEnd - bounds.domainStart) * pixelsPerDay,
  );
  const rowHeight = density === "compact" ? 44 : 64;
  const compactLaneHeight =
    density === "compact"
      ? COMPACT_LANE_DENSE_HEIGHT
      : COMPACT_LANE_COMFORTABLE_HEIGHT;
  const compactReferenceCandidate = scaleForZoomLevel(
    zoomLevelForInitialPreset(project.settings.initialZoomPreset),
    fitScale,
  );
  const compactReference = compactReferenceRef.current;
  if (
    viewportMeasured &&
    (!compactReference ||
      compactReference.items !== allItems ||
      compactReference.events !== events ||
      compactReference.initialZoomPreset !==
        project.settings.initialZoomPreset ||
      compactReference.initialStartYear !== project.settings.initialStartYear ||
      compactReference.initialEndYear !== project.settings.initialEndYear)
  ) {
    compactReferenceRef.current = {
      items: allItems,
      events,
      initialZoomPreset: project.settings.initialZoomPreset,
      initialStartYear: project.settings.initialStartYear,
      initialEndYear: project.settings.initialEndYear,
      pixelsPerDay: compactReferenceCandidate,
    };
  }
  const compactReferencePixelsPerDay =
    compactReferenceRef.current?.pixelsPerDay ?? null;

  const entries = useMemo<TimelineDisplayEntry[]>(() => {
    if (layoutMode === "row") {
      return groups.flatMap((group) => {
        const header: TimelineDisplayEntry[] = group.showHeader
          ? [
              {
                kind: "group",
                id: group.id,
                label: group.label,
                color: group.color,
                icon: group.icon,
                itemCount: group.items.length,
                collapsed: group.collapsed,
              },
            ]
          : [];
        return group.collapsed
          ? header
          : [
              ...header,
              ...group.items.map((item): TimelineDisplayEntry => ({
                kind: "item",
                item,
              })),
            ];
      });
    }

    if (compactReferencePixelsPerDay === null) return [];

    return groups.flatMap((group) => {
      const header: TimelineDisplayEntry[] = group.showHeader
        ? [
            {
              kind: "group",
              id: group.id,
              label: group.label,
              color: group.color,
              icon: group.icon,
              itemCount: group.items.length,
              collapsed: group.collapsed,
            },
          ]
        : [];
      if (group.collapsed) return header;

      const itemById = new Map(group.items.map((item) => [item.id, item]));
      const layout = calculateCompactLaneLayout({
        items: group.items,
        events: group.items.flatMap(
          (item) => eventsByParent.get(item.id) ?? [],
        ),
        currentDate,
        defaultUncertaintyYears: project.settings.defaultUncertaintyYears,
        domainStart: bounds.domainStart,
        pixelsPerDay: compactReferencePixelsPerDay,
        titleWidth: (item) => measureCompactLaneTitle(item.title),
      });
      const placementsByLane = layout.lanes.map(
        (): CompactLaneDisplayPlacement[] => [],
      );
      for (const placement of layout.placements) {
        placementsByLane[placement.laneIndex]!.push({
          ...placement,
          item: itemById.get(placement.itemId)!,
        });
      }
      return [
        ...header,
        ...layout.lanes.map((lane): TimelineDisplayEntry => ({
          kind: "lane",
          id: `${group.id}-${lane.index}`,
          placements: placementsByLane[lane.index]!,
        })),
      ];
    });
  }, [
    bounds.domainStart,
    compactReferencePixelsPerDay,
    currentDate,
    eventsByParent,
    groups,
    layoutMode,
    project.settings.defaultUncertaintyYears,
  ]);
  const compactContentEnd = entries.reduce(
    (maximum, entry) =>
      entry.kind === "lane"
        ? Math.max(
            maximum,
            ...entry.placements.map((placement) => placement.endX),
          )
        : maximum,
    0,
  );
  const canvasWidth = Math.max(
    baseCanvasWidth,
    HORIZONTAL_PADDING * 2 + compactContentEnd,
  );
  const timeSliceStart = Math.max(
    bounds.domainStart,
    Math.min(timeSlice?.startOrdinal ?? bounds.domainStart, bounds.domainEnd),
  );
  const timeSliceEnd = Math.max(
    timeSliceStart,
    Math.min(timeSlice?.endOrdinal ?? bounds.domainEnd, bounds.domainEnd),
  );
  const canvasOffset = layoutMode === "row" ? HANDLE_WIDTH + INFO_WIDTH : 0;
  const timeSliceStartX =
    canvasOffset +
    HORIZONTAL_PADDING +
    (timeSliceStart - bounds.domainStart) * pixelsPerDay;
  const timeSliceEndX =
    canvasOffset +
    HORIZONTAL_PADDING +
    (timeSliceEnd - bounds.domainStart) * pixelsPerDay;
  const timeSliceStartInViewport = Math.max(
    0,
    Math.min(
      timelineViewportWidth,
      timeSliceStartX - canvasOffset - scrollLeft,
    ),
  );
  const timeSliceEndInViewport = Math.max(
    timeSliceStartInViewport,
    Math.min(timelineViewportWidth, timeSliceEndX - canvasOffset - scrollLeft),
  );
  const onPinchZoom = useEffectEvent((offset: -1 | 1, cursorX: number) =>
    changeZoom(zoomLevel + offset, cursorX),
  );

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
      if (event.pointerType === "touch") {
        touchPointsRef.current.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        });
        if (touchPointsRef.current.size === 2) {
          const [first, second] = [...touchPointsRef.current.values()];
          pinchDistanceRef.current = Math.hypot(
            second!.x - first!.x,
            second!.y - first!.y,
          );
          pointerRef.current = null;
          capturePointer(viewport, event.pointerId);
          setPanning(true);
          return;
        }
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
        if (isDoublePress && event.pointerType !== "touch") {
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
        y: event.clientY,
        scrollLeft: viewport.scrollLeft,
        scrollTop: viewport.scrollTop,
      };
      capturePointer(viewport, event.pointerId);
      setPanning(true);
    };
    const pointerMove = (event: PointerEvent) => {
      if (
        event.pointerType === "touch" &&
        touchPointsRef.current.has(event.pointerId)
      ) {
        touchPointsRef.current.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        });
        if (touchPointsRef.current.size >= 2) {
          event.preventDefault();
          const [first, second] = [...touchPointsRef.current.values()];
          const distance = Math.hypot(
            second!.x - first!.x,
            second!.y - first!.y,
          );
          const previousDistance = pinchDistanceRef.current ?? distance;
          const ratio = distance / Math.max(1, previousDistance);
          if (ratio >= 1.18 || ratio <= 0.82) {
            const rect = viewport.getBoundingClientRect();
            const cursorX =
              (first!.x + second!.x) / 2 -
              rect.left -
              (layoutMode === "row" ? HANDLE_WIDTH + INFO_WIDTH : 0);
            onPinchZoom(ratio > 1 ? 1 : -1, Math.max(0, cursorX));
            pinchDistanceRef.current = distance;
          }
          return;
        }
      }
      const pointer = pointerRef.current;
      if (!pointer) return;
      viewport.scrollLeft = pointer.scrollLeft - (event.clientX - pointer.x);
      if (layoutMode === "compact") {
        viewport.scrollTop = pointer.scrollTop - (event.clientY - pointer.y);
      }
    };
    const pointerEnd = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        touchPointsRef.current.delete(event.pointerId);
        pinchDistanceRef.current = null;
      }
      const hadPointer = pointerRef.current !== null;
      pointerRef.current = null;
      if (viewport.hasPointerCapture?.(event.pointerId)) {
        viewport.releasePointerCapture?.(event.pointerId);
      }
      if (hadPointer || touchPointsRef.current.size === 0) {
        flushScrollSync(viewport.scrollLeft);
        setPanning(false);
      }
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
    layoutMode,
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
    estimateSize: (index) => {
      const entry = entries[index];
      return entry?.kind === "group"
        ? 40
        : entry?.kind === "lane"
          ? compactLaneHeight
          : rowHeight;
    },
    overscan: 8,
    observeElementRect: observeTimelineRect,
    initialRect: { width: viewportWidth, height: 560 },
  });

  useLayoutEffect(() => {
    virtualizer.measure();
  }, [density, entries.length, layoutMode, virtualizer]);

  const virtualItems = virtualizer.getVirtualItems();
  const visibleItemCount = allItems.filter((item) => item.isVisible).length;

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
  useEffect(() => {
    setViewport({
      visibleStartOrdinal,
      visibleEndOrdinal,
      domainStartOrdinal: bounds.domainStart,
      domainEndOrdinal: bounds.domainEnd,
    });
  }, [
    bounds.domainEnd,
    bounds.domainStart,
    setViewport,
    visibleEndOrdinal,
    visibleStartOrdinal,
  ]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element || !navigationRequest) return;
    const canvasOffset = layoutMode === "row" ? HANDLE_WIDTH + INFO_WIDTH : 0;
    const target =
      HORIZONTAL_PADDING +
      (navigationRequest.ordinal - bounds.domainStart) * pixelsPerDay;
    element.scrollLeft = Math.max(
      0,
      target - timelineViewportWidth / 2 + canvasOffset,
    );
    flushScrollSync(element.scrollLeft);
  }, [
    bounds.domainStart,
    flushScrollSync,
    layoutMode,
    navigationRequest,
    pixelsPerDay,
    timelineViewportWidth,
  ]);
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
      event.clientX -
        rect.left -
        (layoutMode === "row" ? HANDLE_WIDTH + INFO_WIDTH : 0),
    );
    changeZoom(zoomLevel + (event.deltaY < 0 ? 1 : -1), cursorX);
  }

  function updatePointerGuide(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const canvasOffset = layoutMode === "row" ? HANDLE_WIDTH + INFO_WIDTH : 0;
    const viewportX = event.clientX - rect.left - canvasOffset;
    if (viewportX < 0 || viewportX > timelineViewportWidth) {
      setPointerGuide(null);
      return;
    }
    const left = event.currentTarget.scrollLeft + canvasOffset + viewportX;
    const ordinal =
      bounds.domainStart +
      (left - canvasOffset - HORIZONTAL_PADDING) / pixelsPerDay;
    setPointerGuide({
      left,
      label: formatHistoricalDate(historicalDateFromOrdinal(ordinal)),
    });

    for (const marker of event.currentTarget.querySelectorAll<HTMLElement>(
      "[data-timeline-event-marker='true']",
    )) {
      const markerRect = marker.getBoundingClientRect();
      marker.dataset.pointerOverlap =
        Math.abs(markerRect.left + markerRect.width / 2 - event.clientX) <=
        Math.max(8, markerRect.width / 2)
          ? "true"
          : "false";
    }
  }

  function clearPointerGuide(event: React.MouseEvent<HTMLDivElement>) {
    setPointerGuide(null);
    for (const marker of event.currentTarget.querySelectorAll<HTMLElement>(
      "[data-timeline-event-marker='true']",
    ))
      delete marker.dataset.pointerOverlap;
  }

  return (
    <TooltipProvider>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
        <div className="relative min-h-48 flex-1">
          <div
            ref={viewportRef}
            aria-label="タイムライン表示領域"
            className={cn(
              "styled-scrollbar relative h-full min-h-48 touch-none overflow-auto rounded-lg border bg-card select-none",
              isPanning && "cursor-grabbing",
            )}
            data-testid="timeline-viewport"
            tabIndex={0}
            onScroll={(event) =>
              scheduleScrollSync(event.currentTarget.scrollLeft)
            }
            onMouseMove={updatePointerGuide}
            onMouseLeave={clearPointerGuide}
            onWheel={handleWheel}
          >
            <div
              className="relative transition-[width] duration-150"
              style={{
                width:
                  layoutMode === "row"
                    ? HANDLE_WIDTH + INFO_WIDTH + canvasWidth + ACTION_WIDTH
                    : canvasWidth,
                height: AXIS_HEIGHT + virtualizer.getTotalSize(),
              }}
            >
              {pointerGuide ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute top-0 bottom-0 z-50 border-l-2 border-primary"
                  data-testid="timeline-pointer-guide"
                  style={{ left: pointerGuide.left }}
                >
                  <span className="sticky top-1 ml-1 inline-block rounded bg-primary px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-primary-foreground shadow-sm">
                    {pointerGuide.label}
                  </span>
                </div>
              ) : null}
              <div className="sticky top-0 z-40 flex h-12 border-b bg-muted/95 text-xs font-medium text-muted-foreground backdrop-blur-sm">
                {layoutMode === "row" ? (
                  <>
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
                  </>
                ) : null}
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
                {layoutMode === "row" ? (
                  <span
                    className="sticky right-0 z-40 shrink-0 border-l bg-muted"
                    style={{ width: ACTION_WIDTH }}
                  />
                ) : null}
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
                          : entry.kind === "lane"
                            ? `lane-${entry.id}`
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
                              layoutMode === "row"
                                ? HANDLE_WIDTH +
                                  INFO_WIDTH +
                                  canvasWidth +
                                  ACTION_WIDTH
                                : canvasWidth,
                          }}
                        >
                          <button
                            aria-expanded={!entry.collapsed}
                            aria-label={`${entry.label} ${entry.itemCount}件`}
                            className="sticky left-0 flex h-10 items-center gap-2 bg-muted px-3 text-left text-sm font-medium"
                            style={{
                              width:
                                layoutMode === "row"
                                  ? HANDLE_WIDTH + INFO_WIDTH
                                  : Math.min(360, canvasWidth),
                            }}
                            type="button"
                            onClick={() => onToggleGroup(entry.id)}
                          >
                            {entry.collapsed ? (
                              <ChevronRight className="size-4" />
                            ) : (
                              <ChevronDown className="size-4" />
                            )}
                            <ItemTypeIcon
                              className="size-4"
                              color={entry.color}
                              icon={entry.icon}
                            />
                            {entry.label}
                            <Badge variant="outline">{entry.itemCount}</Badge>
                          </button>
                        </div>
                      ) : entry.kind === "item" ? (
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
                          dimmed={dimmed.has(entry.item.id)}
                          domainStart={bounds.domainStart}
                          isPanning={isPanning}
                          showItemType={showItemType}
                          item={entry.item}
                          events={eventsByParent.get(entry.item.id) ?? []}
                          highlightedEventIds={highlightedEvents}
                          readOnly={readOnly}
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
                      ) : (
                        <div
                          className={cn(
                            "relative border-b bg-muted/15",
                            isPanning
                              ? "cursor-grabbing"
                              : "cursor-grab active:cursor-grabbing",
                          )}
                          data-testid={`compact-lane-${entry.id}`}
                          data-timeline-pan-surface="true"
                          style={{
                            width: canvasWidth,
                            height: compactLaneHeight,
                          }}
                        >
                          {entry.placements.map((placement) => (
                            <CompactLaneItem
                              key={placement.itemId}
                              currentDate={currentDate}
                              defaultUncertaintyYears={
                                project.settings.defaultUncertaintyYears
                              }
                              domainStart={bounds.domainStart}
                              draftEvent={
                                draftEvent?.parentId === placement.itemId
                                  ? draftEvent.date
                                  : null
                              }
                              events={
                                eventsByParent.get(placement.itemId) ?? []
                              }
                              dimmed={dimmed.has(placement.itemId)}
                              highlightedEventIds={highlightedEvents}
                              readOnly={readOnly}
                              pixelsPerDay={pixelsPerDay}
                              placement={placement}
                              visibleEnd={visibleEnd}
                              visibleStart={visibleStart}
                              onEdit={() => onEdit(placement.itemId)}
                              onOpenEvent={onOpenEvent}
                              onOpenItem={() => onOpenItem(placement.itemId)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {timeSlicerVisible ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute z-30 overflow-hidden"
              data-testid="timeline-period-highlight-layer"
              style={{
                top: AXIS_HEIGHT + 1,
                right: (layoutMode === "row" ? ACTION_WIDTH : 0) + 1,
                bottom: 1,
                left:
                  (layoutMode === "row" ? HANDLE_WIDTH + INFO_WIDTH : 0) + 1,
              }}
            >
              <div
                className="absolute inset-y-0 left-0 bg-muted/75 backdrop-grayscale"
                data-testid="time-slice-before"
                style={{ width: timeSliceStartInViewport }}
              />
              <div
                className="absolute inset-y-0 right-0 bg-muted/75 backdrop-grayscale"
                data-testid="time-slice-after"
                style={{
                  width: Math.max(
                    0,
                    timelineViewportWidth - timeSliceEndInViewport,
                  ),
                }}
              />
              <div
                className="absolute inset-y-0 border-x-2 border-primary/70 bg-primary/8"
                data-testid="time-slice-selected"
                style={{
                  left: timeSliceStartInViewport,
                  width: Math.max(
                    0,
                    timeSliceEndInViewport - timeSliceStartInViewport,
                  ),
                }}
              />
            </div>
          ) : null}
          <div
            className="pointer-events-none absolute bottom-3 left-3 z-50 flex flex-col-reverse items-end gap-2 sm:left-auto sm:w-[40rem]"
            data-testid="timeline-floating-panels"
            style={{
              right: (layoutMode === "row" ? ACTION_WIDTH : 0) + 12,
              maxWidth: `calc(100% - ${
                (layoutMode === "row" ? ACTION_WIDTH : 0) + 24
              }px)`,
            }}
          >
            <Button
              aria-expanded={floatingControlsExpanded}
              aria-label={
                floatingControlsExpanded
                  ? "タイムライン操作を閉じる"
                  : "タイムライン操作を開く"
              }
              className="pointer-events-auto size-11 rounded-full border bg-card shadow-lg"
              size="icon"
              type="button"
              variant="outline"
              onClick={() =>
                setFloatingControlsExpanded((expanded) => !expanded)
              }
            >
              <Settings2 aria-hidden="true" />
            </Button>
            {floatingControlsExpanded ? (
              <div
                className="pointer-events-auto flex max-w-full flex-wrap items-center justify-end gap-1 rounded-lg border bg-card/95 p-1.5 shadow-lg backdrop-blur-sm"
                data-testid="timeline-floating-controls"
              >
                <div className="flex h-8 items-center gap-1 rounded-md bg-muted/70 p-1">
                  <Button
                    aria-label="縮小"
                    className="size-6"
                    disabled={zoomLevel === 0}
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => changeZoom(zoomLevel - 1)}
                  >
                    <Minus aria-hidden="true" className="size-3.5" />
                  </Button>
                  <input
                    aria-label="ズーム段階"
                    className="w-20 accent-primary sm:w-28"
                    max={ZOOM_LABELS.length - 1}
                    min={0}
                    step={1}
                    type="range"
                    value={zoomLevel}
                    onChange={(event) => changeZoom(Number(event.target.value))}
                  />
                  <Button
                    aria-label="拡大"
                    className="size-6"
                    disabled={zoomLevel === ZOOM_LABELS.length - 1}
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => changeZoom(zoomLevel + 1)}
                  >
                    <Plus aria-hidden="true" className="size-3.5" />
                  </Button>
                </div>
                {zoomLevel > 0 ? (
                  <Badge className="min-w-14 justify-center" variant="outline">
                    {ZOOM_LABELS[zoomLevel]}
                  </Badge>
                ) : null}
                <Button size="sm" variant="outline" onClick={fitRange}>
                  <Maximize2 aria-hidden="true" className="size-4" />
                  全体に合わせる
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button aria-label="表示密度設定" size="sm" variant="ghost">
                      <SlidersHorizontal
                        aria-hidden="true"
                        className="size-4"
                      />
                      {density === "comfortable" ? "標準" : "高密度"}
                      <ChevronDown aria-hidden="true" className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-40">
                    <DropdownMenuLabel>表示密度</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={density}
                      onValueChange={(value) =>
                        setDensity(value as "compact" | "comfortable")
                      }
                    >
                      <DropdownMenuRadioItem value="comfortable">
                        標準
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="compact">
                        高密度
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  aria-label="期間強調表示"
                  aria-pressed={timeSlicerVisible}
                  size="sm"
                  variant={timeSlicerVisible ? "secondary" : "ghost"}
                  onClick={() => setTimeSlicerVisible((visible) => !visible)}
                >
                  <Clock3 aria-hidden="true" className="size-4" />
                  期間強調
                </Button>
              </div>
            ) : null}
            {floatingControlsExpanded && timeSlicerVisible ? (
              <section
                aria-label="期間強調"
                className="pointer-events-auto w-full space-y-2 rounded-lg border bg-card/95 px-3 py-2 shadow-lg backdrop-blur-sm"
                data-testid="timeline-time-slicer"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-medium">強調する期間</span>
                  <span className="text-muted-foreground">
                    {formatHistoricalDate(
                      historicalDateFromOrdinal(timeSliceStart),
                    )}{" "}
                    —{" "}
                    {formatHistoricalDate(
                      historicalDateFromOrdinal(timeSliceEnd),
                    )}
                  </span>
                  <Button
                    className="h-7 px-2"
                    disabled={timeSlice === null}
                    size="sm"
                    variant="ghost"
                    onClick={() => setTimeSlice(null)}
                  >
                    全期間に戻す
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="grid grid-cols-[3rem_1fr] items-center gap-2 text-xs text-muted-foreground">
                    始点
                    <input
                      aria-label="強調期間の始点"
                      className="w-full accent-primary"
                      max={Math.floor(timeSliceEnd)}
                      min={Math.ceil(bounds.domainStart)}
                      step={1}
                      type="range"
                      value={Math.round(timeSliceStart)}
                      onChange={(event) =>
                        setTimeSlice({
                          startOrdinal: Math.min(
                            Number(event.target.value),
                            timeSliceEnd,
                          ),
                          endOrdinal: timeSliceEnd,
                        })
                      }
                    />
                  </label>
                  <label className="grid grid-cols-[3rem_1fr] items-center gap-2 text-xs text-muted-foreground">
                    終点
                    <input
                      aria-label="強調期間の終点"
                      className="w-full accent-primary"
                      max={Math.floor(bounds.domainEnd)}
                      min={Math.ceil(timeSliceStart)}
                      step={1}
                      type="range"
                      value={Math.round(timeSliceEnd)}
                      onChange={(event) =>
                        setTimeSlice({
                          startOrdinal: timeSliceStart,
                          endOrdinal: Math.max(
                            Number(event.target.value),
                            timeSliceStart,
                          ),
                        })
                      }
                    />
                  </label>
                </div>
              </section>
            ) : null}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {layoutMode === "compact"
            ? "上下左右へドラッグ、スクロールバー、トラックパッドで移動できます。"
            : "横方向へドラッグ、スクロールバー、トラックパッドで移動できます。"}
          表示中 {visibleItemCount} / {allItems.length}{" "}
          {layoutMode === "compact" ? "項目" : "行"} ・ 目盛り {unit} ・
          Alt＋ホイールでカーソル中心にズーム
        </p>
      </div>
    </TooltipProvider>
  );
}
