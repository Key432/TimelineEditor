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
import { CalendarPlus, ChevronDown, Plus, Rows3 } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { itemTypeKeys, listItemTypes } from "@/features/item-types/api";
import {
  listTimelineEvents,
  timelineEventKeys,
} from "@/features/timeline-events/api";
import { TimelineEventForm } from "@/features/timeline-events/timeline-event-form";
import { TimelineEventSection } from "@/features/timeline-events/timeline-event-section";
import type { TimelineEventSummary } from "@/features/timeline-events/types";
import type { TimelineItemType } from "@/features/item-types/types";
import {
  getTimelineItem,
  listTimelineItems,
  moveTimelineItem,
  timelineItemKeys,
} from "@/features/timeline-items/api";
import { DeleteTimelineItemDialog } from "@/features/timeline-items/delete-timeline-item-dialog";
import { historicalDateOrdinal } from "@/features/timeline-items/historical-date";
import { TimelineItemForm } from "@/features/timeline-items/timeline-item-form";
import { TimelineStoreProvider } from "@/features/timeline-items/timeline-store";
import {
  TimelineViewport,
  type TimelineDisplayEntry,
} from "@/features/timeline-items/timeline-viewport";
import {
  TIMELINE_SORT_LABELS,
  TIMELINE_SORT_MODES,
  type HistoricalDate,
  type TimelineItemSummary,
  type TimelineSortMode,
} from "@/features/timeline-items/types";
import type { Project } from "@/features/projects/types";

const selectClassName =
  "h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
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
}: {
  project: Project;
  initialItems: TimelineItemSummary[];
  initialEvents: TimelineEventSummary[];
  itemTypes: TimelineItemType[];
  currentDate: HistoricalDate;
  onEditItemTypes?: () => void;
  onOpenEvent?: (eventId: string, editing: boolean) => void;
  onOpenItem?: (itemId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<"create" | string | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [eventDraft, setEventDraft] = useState<{
    parentId?: string;
    date?: HistoricalDate;
  } | null>(null);
  const [sortMode, setSortMode] = useState<TimelineSortMode>("manual");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [groupByType, setGroupByType] = useState(false);
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
    () => [...items].sort(compareItems(sortMode, direction, currentDate)),
    [currentDate, direction, items, sortMode],
  );
  const groups = useMemo(() => {
    const visibleItems = sorted.filter((item) => item.isVisible);
    const hiddenItems = sorted.filter((item) => !item.isVisible);
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
  }, [currentItemTypes, groupByType, sorted]);
  const entries = useMemo<TimelineDisplayEntry[]>(
    () =>
      groups.flatMap((group) => {
        if (!group.showHeader) {
          return group.items.map((item) => ({ kind: "item" as const, item }));
        }
        const groupEntry: TimelineDisplayEntry = {
          kind: "group",
          id: group.id,
          label: group.label,
          color: group.color,
          itemCount: group.items.length,
          collapsed: collapsed.has(group.id),
        };
        return collapsed.has(group.id)
          ? [groupEntry]
          : [
              groupEntry,
              ...group.items.map((item) => ({ kind: "item" as const, item })),
            ];
      }),
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
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
        <label className="flex items-center gap-2 text-sm">
          並び順
          <select
            aria-label="並び順"
            className={selectClassName}
            value={sortMode}
            onChange={(event) =>
              setSortMode(event.target.value as TimelineSortMode)
            }
          >
            {TIMELINE_SORT_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {TIMELINE_SORT_LABELS[mode]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          方向
          <select
            aria-label="並び方向"
            className={selectClassName}
            value={direction}
            onChange={(event) =>
              setDirection(event.target.value as "asc" | "desc")
            }
          >
            <option value="asc">昇順</option>
            <option value="desc">降順</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch
            aria-label="対象種別でグループ化"
            checked={groupByType}
            onCheckedChange={setGroupByType}
          />
          対象種別でグループ化
        </label>
        <Badge variant="outline">{items.length}アイテム</Badge>
        {sortMode !== "manual" ? (
          <span className="text-xs text-muted-foreground">
            自動並べ替え中はドラッグできません。
          </span>
        ) : null}
      </div>

      {currentItemTypes.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card px-6 py-12 text-center">
          <p className="font-medium">先に対象種別を作成してください。</p>
          <p className="mt-1 text-sm text-muted-foreground">
            プロジェクト設定の「対象種別」から追加できます。
          </p>
          {onEditItemTypes ? (
            <Button className="mt-4" onClick={onEditItemTypes}>
              対象種別を作成
            </Button>
          ) : null}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card px-6 py-12 text-center">
          <p className="font-medium">タイムラインアイテムはまだありません。</p>
          <Button className="mt-4" onClick={() => setEditor("create")}>
            <Plus aria-hidden="true" className="size-4" />
            最初のタイムラインを作成
          </Button>
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
            <TimelineViewport
              allItems={items}
              currentDate={currentDate}
              entries={entries}
              events={events}
              project={project}
              showItemType={!groupByType}
              sortDisabled={sortMode !== "manual"}
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
          </SortableContext>
        </DndContext>
      )}

      {moveMutation.error ? (
        <p role="alert" className="text-sm text-destructive">
          並べ替えを保存できませんでした。{moveMutation.error.message}
        </p>
      ) : null}

      <Sheet open={editor !== null} onOpenChange={closeEditor}>
        <SheetContent className="w-full overflow-y-auto sm:!w-[min(52rem,calc(100vw-2rem))] sm:!max-w-3xl">
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
                onSaved={() => {
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

      <Sheet
        open={eventDraft !== null}
        onOpenChange={(open) => {
          if (!open) setEventDraft(null);
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:!w-[min(52rem,calc(100vw-2rem))] sm:!max-w-3xl">
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
}) {
  return (
    <TimelineStoreProvider settings={props.project.settings}>
      <TimelineWorkspaceContent
        {...props}
        initialEvents={props.initialEvents ?? []}
      />
    </TimelineStoreProvider>
  );
}
