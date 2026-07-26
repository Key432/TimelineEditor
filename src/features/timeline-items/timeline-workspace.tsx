"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpDown,
  CalendarPlus,
  ChevronDown,
  LayoutGrid,
  Plus,
  Rows3,
  SlidersHorizontal,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { itemTypeKeys, listItemTypes } from "@/features/item-types/api";
import {
  listTimelineEvents,
  timelineEventKeys,
} from "@/features/timeline-events/api";
import { TimelineEventForm } from "@/features/timeline-events/timeline-event-form";
import { TimelineEventSection } from "@/features/timeline-events/timeline-event-section";
import type { TimelineEventSummary } from "@/features/timeline-events/types";
import type { TimelineItemType } from "@/features/item-types/types";
import { searchTimeline } from "@/features/search/api";
import {
  getTimelineItem,
  listTimelineItems,
  moveTimelineItem,
  timelineItemKeys,
} from "@/features/timeline-items/api";
import { DeleteTimelineItemDialog } from "@/features/timeline-items/delete-timeline-item-dialog";
import { historicalDateOrdinal } from "@/features/timeline-items/historical-date";
import { TimelineItemForm } from "@/features/timeline-items/timeline-item-form";
import { TimelineFilterPanel } from "@/features/timeline-items/timeline-filter-panel";
import {
  DEFAULT_TIMELINE_FILTERS,
  filterTimelineItems,
  hasActiveTimelineFilters,
  type TimelineFilters,
} from "@/features/timeline-items/timeline-filters";
import { TimelineStoreProvider } from "@/features/timeline-items/timeline-store";
import {
  TimelineViewport,
  type TimelineDisplayGroup,
} from "@/features/timeline-items/timeline-viewport";
import {
  TIMELINE_SORT_LABELS,
  TIMELINE_SORT_MODES,
  type HistoricalDate,
  type TimelineEventCreationFailure,
  type TimelineLayoutMode,
  type TimelineItemSummary,
  type TimelineSortMode,
} from "@/features/timeline-items/types";
import type { Project } from "@/features/projects/types";
import { TimelineViewControls } from "@/features/timeline-views/timeline-view-controls";
import { cn } from "@/lib/utils";

const HIDDEN_ITEMS_GROUP_ID = "hidden-items";

function startOrdinal(item: TimelineItemSummary) {
  const date = item.temporalType === "point" ? item.point : item.start;
  return date ? historicalDateOrdinal(date) : 0;
}

function endOrdinal(item: TimelineItemSummary, currentDate: HistoricalDate) {
  const date =
    item.temporalType === "point"
      ? item.point
      : item.endDateStatus === "specified"
        ? item.end
        : item.endDateStatus === "ongoing"
          ? currentDate
          : (item.lastConfirmed ?? item.start);
  return date ? historicalDateOrdinal(date, "end") : 0;
}

function compareItems(
  mode: TimelineSortMode,
  direction: "asc" | "desc",
  currentDate: HistoricalDate,
) {
  const factor = direction === "asc" ? 1 : -1;
  return (a: TimelineItemSummary, b: TimelineItemSummary) => {
    let result = 0;
    switch (mode) {
      case "manual":
        result = a.manualOrder - b.manualOrder;
        break;
      case "startDate":
        result = startOrdinal(a) - startOrdinal(b);
        break;
      case "endDate":
        result = endOrdinal(a, currentDate) - endOrdinal(b, currentDate);
        break;
      case "title":
        result = a.title.localeCompare(b.title, "ja");
        break;
      case "itemType":
        result = a.itemType.sortOrder - b.itemType.sortOrder;
        break;
      case "createdAt":
        result = a.createdAt.localeCompare(b.createdAt);
        break;
      case "updatedAt":
        result = a.updatedAt.localeCompare(b.updatedAt);
        break;
    }
    return (result || a.id.localeCompare(b.id)) * factor;
  };
}

function ItemEditor({
  projectId,
  itemId,
  itemTypes,
  onSaved,
  onDirtyChange,
  onEditItemTypes,
  allItems,
  currentDate,
  childEventCount,
}: {
  projectId: string;
  itemId: string;
  itemTypes: TimelineItemType[];
  onSaved: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onEditItemTypes?: () => void;
  allItems: TimelineItemSummary[];
  currentDate: HistoricalDate;
  childEventCount: number;
}) {
  const { data: item, error } = useQuery({
    queryKey: timelineItemKeys.detail(projectId, itemId),
    queryFn: () => getTimelineItem(projectId, itemId),
  });
  if (error) return <p role="alert">{error.message}</p>;
  if (!item) return <p className="text-muted-foreground">読み込み中…</p>;
  return (
    <div className="space-y-5">
      <TimelineItemForm
        item={item}
        itemTypes={itemTypes}
        projectId={projectId}
        onDirtyChange={onDirtyChange}
        onEditItemTypes={onEditItemTypes}
        onSaved={onSaved}
      />
      {item.temporalType === "range" ? (
        <TimelineEventSection
          currentDate={currentDate}
          parentId={item.id}
          projectId={projectId}
          rangeItems={allItems.filter(
            (candidate) => candidate.temporalType === "range",
          )}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          時点型タイムラインアイテムにはイベントアイテムを追加できません。
        </p>
      )}
      <DeleteTimelineItemDialog
        childEventCount={childEventCount}
        itemId={item.id}
        projectId={projectId}
        title={item.title}
      />
    </div>
  );
}

function TimelineWorkspaceContent({
  project,
  initialItems,
  initialEvents,
  itemTypes,
  currentDate,
  onEditItemTypes,
  onOpenEvent,
  onOpenItem,
  layoutMode,
  onLayoutModeChange,
  filters,
  onFiltersChange,
  readOnly = false,
}: {
  project: Project;
  initialItems: TimelineItemSummary[];
  initialEvents: TimelineEventSummary[];
  itemTypes: TimelineItemType[];
  currentDate: HistoricalDate;
  onEditItemTypes?: () => void;
  onOpenEvent?: (eventId: string, editing: boolean) => void;
  onOpenItem?: (itemId: string) => void;
  layoutMode: TimelineLayoutMode;
  onLayoutModeChange?: (layoutMode: TimelineLayoutMode) => void;
  filters: TimelineFilters;
  onFiltersChange?: (filters: TimelineFilters) => void;
  readOnly?: boolean;
}) {
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<"create" | string | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [creationFailures, setCreationFailures] = useState<
    TimelineEventCreationFailure[]
  >([]);
  const [eventDraft, setEventDraft] = useState<{
    parentId?: string;
    date?: HistoricalDate;
  } | null>(null);
  const [sortMode, setSortMode] = useState<TimelineSortMode>("manual");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [groupByType, setGroupByType] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const fullscreenSupported = useSyncExternalStore(
    () => () => undefined,
    () => document.fullscreenEnabled,
    () => false,
  );
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [debouncedQuery, setDebouncedQuery] = useState(filters.query.trim());
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set([HIDDEN_ITEMS_GROUP_ID]),
  );
  const { data: items = initialItems } = useQuery({
    queryKey: timelineItemKeys.list(project.id),
    queryFn: () => listTimelineItems(project.id),
    initialData: initialItems,
  });
  const { data: events = initialEvents } = useQuery({
    queryKey: timelineEventKeys.list(project.id),
    queryFn: () => listTimelineEvents(project.id),
    initialData: initialEvents,
  });
  const { data: currentItemTypes = itemTypes } = useQuery({
    queryKey: itemTypeKeys.list(project.id),
    queryFn: () => listItemTypes(project.id),
    initialData: itemTypes,
  });
  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedQuery(filters.query.trim()),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [filters.query]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isMaximized && !document.fullscreenElement)
        setIsMaximized(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMaximized]);
  const searchMatches = useQuery({
    queryKey: ["projects", project.id, "timeline-search", debouncedQuery],
    queryFn: ({ signal }) => searchTimeline(project.id, debouncedQuery, signal),
    enabled: debouncedQuery.length > 0,
  });
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const moveMutation = useMutation({
    mutationFn: ({
      itemId,
      manualOrder,
      typeId,
    }: {
      itemId: string;
      manualOrder: number;
      typeId?: string;
    }) => moveTimelineItem(project.id, itemId, { manualOrder, typeId }),
    onSuccess: (nextItems) =>
      queryClient.setQueryData(timelineItemKeys.list(project.id), nextItems),
  });

  const sorted = useMemo(
    () =>
      [...(readOnly ? items.filter((item) => item.isVisible) : items)].sort(
        compareItems(sortMode, direction, currentDate),
      ),
    [currentDate, direction, items, readOnly, sortMode],
  );
  const activeFilters = hasActiveTimelineFilters(filters);
  const searchReady =
    !filters.query.trim() ||
    (debouncedQuery === filters.query.trim() &&
      searchMatches.data !== undefined);
  const filterResult = useMemo(
    () =>
      filterTimelineItems({
        items: sorted,
        events,
        filters: searchReady ? filters : { ...filters, query: "" },
        matches: searchMatches.data ?? { itemIds: [], eventIds: [] },
        currentDate,
        uncertaintyYears: project.settings.defaultUncertaintyYears,
      }),
    [
      currentDate,
      events,
      filters,
      project.settings.defaultUncertaintyYears,
      searchMatches.data,
      searchReady,
      sorted,
    ],
  );
  const filtered = useMemo(
    () =>
      filters.mode === "dim"
        ? sorted
        : sorted.filter((item) => filterResult.matchedIds.has(item.id)),
    [filterResult.matchedIds, filters.mode, sorted],
  );
  const dimmedItemIds = useMemo(
    () =>
      filters.mode === "dim" && activeFilters
        ? new Set(
            sorted
              .filter((item) => !filterResult.matchedIds.has(item.id))
              .map((item) => item.id),
          )
        : new Set<string>(),
    [activeFilters, filterResult.matchedIds, filters.mode, sorted],
  );
  const groups = useMemo(() => {
    const visibleItems = filtered.filter((item) => item.isVisible);
    const hiddenItems = filtered.filter((item) => !item.isVisible);
    const visibleGroups = groupByType
      ? currentItemTypes
          .map((type) => ({
            id: type.id,
            label: type.name,
            color: type.defaultColor,
            showHeader: true,
            items: visibleItems.filter((item) => item.typeId === type.id),
          }))
          .filter((group) => group.items.length > 0)
      : [
          {
            id: "visible-items",
            label: "",
            color: "",
            showHeader: false,
            items: visibleItems,
          },
        ];
    return hiddenItems.length > 0
      ? [
          ...visibleGroups,
          {
            id: HIDDEN_ITEMS_GROUP_ID,
            label: "非表示にした項目",
            color: "#6B7280",
            showHeader: true,
            items: hiddenItems,
          },
        ]
      : visibleGroups;
  }, [currentItemTypes, filtered, groupByType]);
  const displayGroups = useMemo<TimelineDisplayGroup[]>(
    () =>
      groups.map((group) => ({
        ...group,
        collapsed: collapsed.has(group.id),
      })),
    [collapsed, groups],
  );

  function closeEditor(nextOpen: boolean) {
    if (nextOpen) return;
    if (editorDirty && !window.confirm("未保存の変更を破棄して閉じますか？")) {
      return;
    }
    setEditor(null);
    setEditorDirty(false);
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    const manual = [...items].sort((a, b) => a.manualOrder - b.manualOrder);
    const oldIndex = manual.findIndex((item) => item.id === event.active.id);
    const newIndex = manual.findIndex((item) => item.id === event.over?.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(manual, oldIndex, newIndex);
    queryClient.setQueryData(
      timelineItemKeys.list(project.id),
      reordered.map((item, index) => ({ ...item, manualOrder: index })),
    );
    const overItem = manual[newIndex];
    moveMutation.mutate({
      itemId: String(event.active.id),
      manualOrder: newIndex,
      typeId:
        groupByType && overItem?.typeId !== manual[oldIndex]?.typeId
          ? overItem?.typeId
          : undefined,
    });
  }

  function moveByButton(itemId: string, offset: -1 | 1) {
    const manual = [...items].sort((a, b) => a.manualOrder - b.manualOrder);
    const oldIndex = manual.findIndex((item) => item.id === itemId);
    const newIndex = oldIndex + offset;
    if (oldIndex < 0 || newIndex < 0 || newIndex >= manual.length) return;
    const reordered = arrayMove(manual, oldIndex, newIndex);
    queryClient.setQueryData(
      timelineItemKeys.list(project.id),
      reordered.map((item, index) => ({ ...item, manualOrder: index })),
    );
    moveMutation.mutate({ itemId, manualOrder: newIndex });
  }

  return (
    <div
      ref={workspaceRef}
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col gap-3",
        isMaximized && "fixed inset-0 z-50 bg-background p-3",
      )}
    >
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2 shadow-xs">
        {!readOnly ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={currentItemTypes.length === 0}>
                <Plus aria-hidden="true" className="size-4" />
                アイテムを追加
                <ChevronDown aria-hidden="true" className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-56">
              <DropdownMenuItem
                className="gap-2 px-3 py-2.5"
                onSelect={() => setEditor("create")}
              >
                <Rows3 aria-hidden="true" />
                タイムラインを追加
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 px-3 py-2.5"
                disabled={!items.some((item) => item.temporalType === "range")}
                onSelect={() => setEventDraft({})}
              >
                <CalendarPlus aria-hidden="true" />
                イベントを追加
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {!readOnly ? (
          <span aria-hidden="true" className="mx-1 h-6 w-px bg-border" />
        ) : null}
        <div
          aria-label="表示モード"
          className="flex h-8 items-center rounded-lg bg-muted p-[3px]"
          role="group"
        >
          <Button
            aria-pressed={layoutMode === "row"}
            className="h-6 rounded-md px-2"
            size="sm"
            variant={layoutMode === "row" ? "secondary" : "ghost"}
            onClick={() => onLayoutModeChange?.("row")}
          >
            <Rows3 aria-hidden="true" />
            行表示
          </Button>
          <Button
            aria-pressed={layoutMode === "compact"}
            className="h-6 rounded-md px-2"
            size="sm"
            variant={layoutMode === "compact" ? "secondary" : "ghost"}
            onClick={() => onLayoutModeChange?.("compact")}
          >
            <LayoutGrid aria-hidden="true" />
            コンパクト
          </Button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label="配置設定" size="sm" variant="outline">
              <ArrowUpDown aria-hidden="true" className="size-4" />
              {layoutMode === "compact"
                ? "自動配置"
                : TIMELINE_SORT_LABELS[sortMode]}
              {layoutMode === "row" ? (
                <span className="text-muted-foreground">
                  {direction === "asc" ? "昇順" : "降順"}
                </span>
              ) : null}
              {groupByType ? (
                <Badge className="h-5 px-1.5" variant="secondary">
                  種別
                </Badge>
              ) : null}
              <ChevronDown aria-hidden="true" className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-56">
            <DropdownMenuLabel>配置</DropdownMenuLabel>
            {layoutMode === "row" ? (
              <>
                <DropdownMenuLabel>並び順</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={sortMode}
                  onValueChange={(value) =>
                    setSortMode(value as TimelineSortMode)
                  }
                >
                  {TIMELINE_SORT_MODES.map((mode) => (
                    <DropdownMenuRadioItem key={mode} value={mode}>
                      {TIMELINE_SORT_LABELS[mode]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>方向</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={direction}
                  onValueChange={(value) =>
                    setDirection(value as "asc" | "desc")
                  }
                >
                  <DropdownMenuRadioItem value="asc">
                    昇順
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="desc">
                    降順
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
              </>
            ) : (
              <DropdownMenuItem disabled>
                開始日順でレーンへ自動配置
              </DropdownMenuItem>
            )}
            <DropdownMenuCheckboxItem
              checked={groupByType}
              onCheckedChange={(checked) => setGroupByType(checked === true)}
            >
              対象種別でグループ化
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          aria-pressed={filterPanelOpen}
          size="sm"
          variant={activeFilters ? "secondary" : "outline"}
          onClick={() => setFilterPanelOpen(true)}
        >
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          フィルター
          {activeFilters ? (
            <Badge className="h-5 px-1.5" variant="outline">
              {filterResult.matchedIds.size}
            </Badge>
          ) : null}
        </Button>
        <TimelineViewControls
          canSaveViews={!readOnly}
          filters={filters}
          fullscreenSupported={fullscreenSupported}
          groupByType={groupByType}
          isMaximized={isMaximized}
          layoutMode={layoutMode}
          projectId={project.id}
          sortDirection={direction}
          sortMode={sortMode}
          onFiltersChange={onFiltersChange}
          onGroupByTypeChange={setGroupByType}
          onLayoutModeChange={onLayoutModeChange}
          onSortChange={(mode, nextDirection) => {
            setSortMode(mode);
            setDirection(nextDirection);
          }}
          onToggleFullscreen={() => {
            const element = workspaceRef.current;
            if (!element) return;
            if (document.fullscreenElement) void document.exitFullscreen();
            else void element.requestFullscreen();
          }}
          onToggleMaximized={() => setIsMaximized((value) => !value)}
        />
        <Badge className="ml-auto" variant="outline">
          {activeFilters
            ? `${filterResult.matchedIds.size} / ${items.length}項目`
            : `${items.length}項目`}
        </Badge>
      </div>

      {currentItemTypes.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card px-6 py-12 text-center">
          <p className="font-medium">
            {readOnly
              ? "表示できる対象種別はありません。"
              : "先に対象種別を作成してください。"}
          </p>
          {!readOnly ? (
            <p className="mt-1 text-sm text-muted-foreground">
              プロジェクト設定の「対象種別」から追加できます。
            </p>
          ) : null}
          {onEditItemTypes ? (
            <Button className="mt-4" onClick={onEditItemTypes}>
              対象種別を作成
            </Button>
          ) : null}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card px-6 py-12 text-center">
          <p className="font-medium">タイムラインアイテムはまだありません。</p>
          {!readOnly ? (
            <Button className="mt-4" onClick={() => setEditor("create")}>
              <Plus aria-hidden="true" className="size-4" />
              最初のタイムラインを作成
            </Button>
          ) : null}
        </div>
      ) : (
        <DndContext
          id={`timeline-items-${project.id}`}
          collisionDetection={closestCenter}
          sensors={sensors}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sorted.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex min-h-0 min-w-0 flex-1">
              <TimelineViewport
                allItems={items}
                currentDate={currentDate}
                groups={displayGroups}
                events={events}
                dimmedItemIds={dimmedItemIds}
                highlightedEventIds={filterResult.matchingEventIds}
                layoutMode={layoutMode}
                project={project}
                showItemType={!groupByType}
                readOnly={readOnly}
                sortDisabled={
                  readOnly || sortMode !== "manual" || layoutMode === "compact"
                }
                onEdit={setEditor}
                draftEvent={
                  eventDraft?.parentId && eventDraft.date
                    ? { parentId: eventDraft.parentId, date: eventDraft.date }
                    : null
                }
                onCreateEvent={(parentId, date) =>
                  setEventDraft({ parentId, date })
                }
                onOpenEvent={(eventId, editing) =>
                  onOpenEvent?.(eventId, editing)
                }
                onOpenItem={(itemId) => onOpenItem?.(itemId)}
                onMove={moveByButton}
                onToggleGroup={(typeId) =>
                  setCollapsed((current) => {
                    const next = new Set(current);
                    if (next.has(typeId)) next.delete(typeId);
                    else next.add(typeId);
                    return next;
                  })
                }
              />
            </div>
          </SortableContext>
        </DndContext>
      )}

      {!readOnly && moveMutation.error ? (
        <p role="alert" className="text-sm text-destructive">
          並べ替えを保存できませんでした。{moveMutation.error.message}
        </p>
      ) : null}

      {!readOnly && creationFailures.length > 0 ? (
        <div
          role="status"
          className="rounded-lg border border-warning/40 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          <p className="font-medium">
            タイムラインアイテムは作成されましたが、次のイベントは追加できませんでした。
          </p>
          <ul className="mt-1 list-disc pl-5">
            {creationFailures.map((failure, index) => (
              <li key={`${failure.title}-${index}`}>
                {failure.title}: {failure.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Sheet open={filterPanelOpen} onOpenChange={setFilterPanelOpen}>
        <SheetContent
          className="styled-scrollbar w-full overflow-y-auto sm:max-w-lg"
          overlayClassName="supports-backdrop-filter:backdrop-blur-none"
        >
          <SheetHeader>
            <SheetTitle>タイムラインを絞り込む</SheetTitle>
            <SheetDescription>
              現在のプロジェクト内だけを検索します。入力を確定した条件はURLへ保存されます。
            </SheetDescription>
          </SheetHeader>
          <TimelineFilterPanel
            filters={filters}
            itemTypes={currentItemTypes}
            onChange={(nextFilters) => onFiltersChange?.(nextFilters)}
          />
        </SheetContent>
      </Sheet>

      {!readOnly ? (
        <Sheet open={editor !== null} onOpenChange={closeEditor}>
          <SheetContent className="styled-scrollbar w-full overflow-y-auto sm:!w-[min(52rem,calc(100vw-2rem))] sm:!max-w-3xl">
            <SheetHeader>
              <SheetTitle>
                {editor === "create"
                  ? "タイムラインアイテムを追加"
                  : "タイムラインアイテムを編集"}
              </SheetTitle>
              <SheetDescription>
                期間型または時点型の日付と表示内容を保存します。
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-6">
              {editor === "create" ? (
                <TimelineItemForm
                  itemTypes={currentItemTypes}
                  projectId={project.id}
                  onDirtyChange={setEditorDirty}
                  onEditItemTypes={onEditItemTypes}
                  onSaved={(_saved, failures = []) => {
                    setCreationFailures(failures);
                    setEditorDirty(false);
                    setEditor(null);
                  }}
                />
              ) : editor ? (
                <ItemEditor
                  allItems={items}
                  currentDate={currentDate}
                  childEventCount={
                    events.filter((event) => event.timelineItemId === editor)
                      .length
                  }
                  itemId={editor}
                  itemTypes={currentItemTypes}
                  projectId={project.id}
                  onDirtyChange={setEditorDirty}
                  onEditItemTypes={onEditItemTypes}
                  onSaved={() => {
                    setEditorDirty(false);
                    setEditor(null);
                  }}
                />
              ) : null}
            </div>
          </SheetContent>
        </Sheet>
      ) : null}

      {!readOnly ? (
        <Sheet
          open={eventDraft !== null}
          onOpenChange={(open) => {
            if (!open) setEventDraft(null);
          }}
        >
          <SheetContent className="styled-scrollbar w-full overflow-y-auto sm:!w-[min(52rem,calc(100vw-2rem))] sm:!max-w-3xl">
            <SheetHeader>
              <SheetTitle>イベントアイテムを追加</SheetTitle>
              <SheetDescription>
                {eventDraft?.date
                  ? "ダブルクリックした位置の日付を初期値にしています。"
                  : "タイムラインと登録日付を指定してください。"}
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-6">
              {eventDraft ? (
                <TimelineEventForm
                  currentDate={currentDate}
                  initialDate={eventDraft.date}
                  initialParentId={eventDraft.parentId}
                  projectId={project.id}
                  rangeItems={items.filter(
                    (item) => item.temporalType === "range",
                  )}
                  onSaved={() => setEventDraft(null)}
                />
              ) : null}
            </div>
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
}

export function TimelineWorkspace(props: {
  project: Project;
  initialItems: TimelineItemSummary[];
  initialEvents?: TimelineEventSummary[];
  itemTypes: TimelineItemType[];
  currentDate: HistoricalDate;
  onEditItemTypes?: () => void;
  onOpenEvent?: (eventId: string, editing: boolean) => void;
  onOpenItem?: (itemId: string) => void;
  layoutMode?: TimelineLayoutMode;
  onLayoutModeChange?: (layoutMode: TimelineLayoutMode) => void;
  filters?: TimelineFilters;
  onFiltersChange?: (filters: TimelineFilters) => void;
  readOnly?: boolean;
}) {
  const [uncontrolledLayoutMode, setUncontrolledLayoutMode] =
    useState<TimelineLayoutMode>(props.layoutMode ?? "row");
  const layoutMode = props.layoutMode ?? uncontrolledLayoutMode;

  return (
    <TimelineStoreProvider settings={props.project.settings}>
      <TimelineWorkspaceContent
        {...props}
        initialEvents={props.initialEvents ?? []}
        filters={props.filters ?? DEFAULT_TIMELINE_FILTERS}
        layoutMode={layoutMode}
        onLayoutModeChange={(nextLayoutMode) => {
          setUncontrolledLayoutMode(nextLayoutMode);
          props.onLayoutModeChange?.(nextLayoutMode);
        }}
      />
    </TimelineStoreProvider>
  );
}
