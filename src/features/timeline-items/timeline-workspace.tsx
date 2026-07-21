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
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { itemTypeKeys, listItemTypes } from "@/features/item-types/api";
import type { TimelineItemType } from "@/features/item-types/types";
import {
  getTimelineItem,
  listTimelineItems,
  moveTimelineItem,
  timelineItemKeys,
} from "@/features/timeline-items/api";
import { DeleteTimelineItemDialog } from "@/features/timeline-items/delete-timeline-item-dialog";
import { effectiveItemYear } from "@/features/timeline-items/historical-date";
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

function endYear(item: TimelineItemSummary, currentYear: number) {
  if (item.temporalType === "point") return item.point?.year ?? 1;
  if (item.endDateStatus === "specified") return item.end?.year ?? 1;
  if (item.endDateStatus === "ongoing") return currentYear;
  return item.lastConfirmed?.year ?? item.start?.year ?? 1;
}

function compareItems(
  mode: TimelineSortMode,
  direction: "asc" | "desc",
  currentYear: number,
) {
  const factor = direction === "asc" ? 1 : -1;
  return (a: TimelineItemSummary, b: TimelineItemSummary) => {
    let result = 0;
    switch (mode) {
      case "manual":
        result = a.manualOrder - b.manualOrder;
        break;
      case "startDate":
        result = effectiveItemYear(a) - effectiveItemYear(b);
        break;
      case "endDate":
        result = endYear(a, currentYear) - endYear(b, currentYear);
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
}: {
  projectId: string;
  itemId: string;
  itemTypes: TimelineItemType[];
  onSaved: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onEditItemTypes?: () => void;
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
      <DeleteTimelineItemDialog
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
  itemTypes,
  currentDate,
  onEditItemTypes,
}: {
  project: Project;
  initialItems: TimelineItemSummary[];
  itemTypes: TimelineItemType[];
  currentDate: HistoricalDate;
  onEditItemTypes?: () => void;
}) {
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<"create" | string | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
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
    () => [...items].sort(compareItems(sortMode, direction, currentDate.year)),
    [currentDate.year, direction, items, sortMode],
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
        <Button
          disabled={currentItemTypes.length === 0}
          onClick={() => setEditor("create")}
        >
          <Plus aria-hidden="true" className="size-4" />
          項目を追加
        </Button>
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
        <Badge variant="outline">{items.length}項目</Badge>
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
          <p className="font-medium">タイムライン項目はまだありません。</p>
          <Button className="mt-4" onClick={() => setEditor("create")}>
            <Plus aria-hidden="true" className="size-4" />
            最初の項目を作成
          </Button>
        </div>
      ) : (
        <DndContext
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
              project={project}
              sortDisabled={sortMode !== "manual"}
              onEdit={setEditor}
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
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>
              {editor === "create" ? "タイムライン項目を追加" : "項目を編集"}
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
    </div>
  );
}

export function TimelineWorkspace(props: {
  project: Project;
  initialItems: TimelineItemSummary[];
  itemTypes: TimelineItemType[];
  currentDate: HistoricalDate;
  onEditItemTypes?: () => void;
}) {
  return (
    <TimelineStoreProvider settings={props.project.settings}>
      <TimelineWorkspaceContent {...props} />
    </TimelineStoreProvider>
  );
}
