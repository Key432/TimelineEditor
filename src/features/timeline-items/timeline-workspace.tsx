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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  EyeOff,
  GripVertical,
  Pencil,
  Plus,
} from "lucide-react";
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
import type { TimelineItemType } from "@/features/item-types/types";
import {
  getTimelineItem,
  listTimelineItems,
  moveTimelineItem,
  timelineItemKeys,
} from "@/features/timeline-items/api";
import { DeleteTimelineItemDialog } from "@/features/timeline-items/delete-timeline-item-dialog";
import {
  effectiveItemYear,
  formatHistoricalDate,
} from "@/features/timeline-items/historical-date";
import { TimelineItemForm } from "@/features/timeline-items/timeline-item-form";
import {
  TIMELINE_SORT_LABELS,
  TIMELINE_SORT_MODES,
  type TimelineItemSummary,
  type TimelineSortMode,
} from "@/features/timeline-items/types";
import type { Project } from "@/features/projects/types";
import { cn } from "@/lib/utils";

const selectClassName =
  "h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function endYear(item: TimelineItemSummary, currentYear: number) {
  if (item.temporalType === "point") return item.point?.year ?? 1;
  if (item.endDateStatus === "specified") return item.end?.year ?? 1;
  if (item.endDateStatus === "ongoing") return currentYear;
  return item.lastConfirmed?.year ?? item.start?.year ?? 1;
}

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
  minYear,
  maxYear,
  currentYear,
  uncertaintyYears,
}: {
  item: TimelineItemSummary;
  minYear: number;
  maxYear: number;
  currentYear: number;
  uncertaintyYears: number;
}) {
  const span = Math.max(1, maxYear - minYear);
  const start = effectiveItemYear(item);
  const finish =
    item.endDateStatus === "unknown"
      ? endYear(item, currentYear) + uncertaintyYears
      : endYear(item, currentYear);
  const left = Math.max(0, Math.min(100, ((start - minYear) / span) * 100));
  const right = Math.max(
    left,
    Math.min(100, ((finish - minYear) / span) * 100),
  );
  const color = item.colorOverride ?? item.itemType.defaultColor;

  if (item.temporalType === "point") {
    return (
      <span
        aria-label={`時点型マーカー ${formatHistoricalDate(item.point)}`}
        className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-white shadow-sm"
        style={{ left: `${left}%`, backgroundColor: color }}
      />
    );
  }

  const gradient =
    item.endDateStatus === "unknown"
      ? `linear-gradient(to right, ${color} 0%, ${color} 72%, transparent 100%)`
      : item.isStartApproximate && item.isEndApproximate
        ? `linear-gradient(to right, transparent 0%, ${color} 18%, ${color} 82%, transparent 100%)`
        : item.isStartApproximate
          ? `linear-gradient(to right, transparent 0%, ${color} 22%)`
          : item.isEndApproximate
            ? `linear-gradient(to right, ${color} 78%, transparent 100%)`
            : color;

  return (
    <span
      aria-label={`期間型バー ${itemDateLabel(item)}`}
      className={cn(
        "absolute top-1/2 h-3 min-w-1 -translate-y-1/2 rounded-sm",
        item.endDateStatus === "ongoing" &&
          "after:absolute after:top-0 after:-right-1 after:h-3 after:w-1 after:bg-current",
      )}
      style={{
        left: `${left}%`,
        width: `${Math.max(0.5, right - left)}%`,
        background: gradient,
        color,
      }}
    />
  );
}

function SortableRow({
  item,
  project,
  currentYear,
  disabled,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onEdit,
}: {
  item: TimelineItemSummary;
  project: Project;
  currentYear: number;
  disabled: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id, disabled });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "grid min-h-16 grid-cols-[2rem_minmax(13rem,18rem)_1fr_auto] items-stretch border-b bg-card last:border-b-0",
        !item.isVisible && "opacity-55",
      )}
      data-testid={`timeline-row-${item.id}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        aria-label={`${item.title}を並べ替え`}
        className="flex cursor-grab items-center justify-center border-r text-muted-foreground disabled:cursor-not-allowed"
        disabled={disabled}
        type="button"
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" className="size-4" />
      </button>
      <div className="min-w-0 border-r px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-full"
            style={{
              backgroundColor: item.colorOverride ?? item.itemType.defaultColor,
            }}
          />
          <button
            className="truncate text-left text-sm font-medium hover:underline"
            type="button"
            onClick={onEdit}
          >
            {item.title}
          </button>
          {!item.isVisible ? (
            <EyeOff aria-label="非表示" className="size-3.5 shrink-0" />
          ) : null}
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {item.itemType.name} · {itemDateLabel(item)}
        </p>
      </div>
      <div
        className="relative min-w-80 overflow-hidden bg-[repeating-linear-gradient(to_right,var(--color-border)_0,var(--color-border)_1px,transparent_1px,transparent_10%)] px-3"
        data-testid={`timeline-glyph-${item.id}`}
      >
        <TimelineGlyph
          currentYear={currentYear}
          item={item}
          maxYear={project.settings.initialEndYear}
          minYear={project.settings.initialStartYear}
          uncertaintyYears={project.settings.defaultUncertaintyYears}
        />
      </div>
      <div className="flex items-center gap-1 border-l px-2">
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
        result = a.itemType.name.localeCompare(b.itemType.name, "ja");
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
}: {
  projectId: string;
  itemId: string;
  itemTypes: TimelineItemType[];
  onSaved: () => void;
  onDirtyChange: (dirty: boolean) => void;
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

export function TimelineWorkspace({
  project,
  initialItems,
  itemTypes,
  currentYear,
}: {
  project: Project;
  initialItems: TimelineItemSummary[];
  itemTypes: TimelineItemType[];
  currentYear: number;
}) {
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<"create" | string | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [sortMode, setSortMode] = useState<TimelineSortMode>("manual");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [groupByType, setGroupByType] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const { data: items = initialItems } = useQuery({
    queryKey: timelineItemKeys.list(project.id),
    queryFn: () => listTimelineItems(project.id),
    initialData: initialItems,
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
    () => [...items].sort(compareItems(sortMode, direction, currentYear)),
    [currentYear, direction, items, sortMode],
  );
  const groups = useMemo(() => {
    if (!groupByType) return [{ type: null, items: sorted }];
    return itemTypes
      .map((type) => ({
        type,
        items: sorted.filter((item) => item.typeId === type.id),
      }))
      .filter((group) => group.items.length > 0);
  }, [groupByType, itemTypes, sorted]);

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
          disabled={itemTypes.length === 0}
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

      {itemTypes.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card px-6 py-12 text-center">
          <p className="font-medium">先に対象種別を作成してください。</p>
          <p className="mt-1 text-sm text-muted-foreground">
            プロジェクト設定の「対象種別」から追加できます。
          </p>
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
            <div className="overflow-x-auto rounded-lg border">
              <div className="min-w-240">
                <div className="grid grid-cols-[2rem_minmax(13rem,18rem)_1fr_auto] border-b bg-muted/70 text-xs font-medium text-muted-foreground">
                  <span />
                  <span className="border-r px-3 py-2">項目</span>
                  <span className="px-3 py-2">
                    {project.settings.initialStartYear} —{" "}
                    {project.settings.initialEndYear}
                  </span>
                  <span className="w-12 border-l" />
                </div>
                {groups.map((group) => {
                  const isCollapsed =
                    group.type && collapsed.has(group.type.id);
                  return (
                    <section key={group.type?.id ?? "all"}>
                      {group.type ? (
                        <button
                          className="flex w-full items-center gap-2 border-b bg-muted px-3 py-2 text-left text-sm font-medium"
                          type="button"
                          onClick={() =>
                            setCollapsed((current) => {
                              const next = new Set(current);
                              if (next.has(group.type!.id)) {
                                next.delete(group.type!.id);
                              } else {
                                next.add(group.type!.id);
                              }
                              return next;
                            })
                          }
                        >
                          {isCollapsed ? (
                            <ChevronRight className="size-4" />
                          ) : (
                            <ChevronDown className="size-4" />
                          )}
                          <span
                            className="size-2.5 rounded-full"
                            style={{ backgroundColor: group.type.defaultColor }}
                          />
                          {group.type.name}
                          <Badge variant="outline">{group.items.length}</Badge>
                        </button>
                      ) : null}
                      {!isCollapsed
                        ? group.items.map((item) => {
                            const manualIndex = items.findIndex(
                              (candidate) =>
                                candidate.manualOrder === item.manualOrder,
                            );
                            return (
                              <SortableRow
                                key={item.id}
                                canMoveDown={manualIndex < items.length - 1}
                                canMoveUp={manualIndex > 0}
                                currentYear={currentYear}
                                disabled={sortMode !== "manual"}
                                item={item}
                                project={project}
                                onEdit={() => setEditor(item.id)}
                                onMoveDown={() => moveByButton(item.id, 1)}
                                onMoveUp={() => moveByButton(item.id, -1)}
                              />
                            );
                          })
                        : null}
                    </section>
                  );
                })}
              </div>
            </div>
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
                itemTypes={itemTypes}
                projectId={project.id}
                onDirtyChange={setEditorDirty}
                onSaved={() => {
                  setEditorDirty(false);
                  setEditor(null);
                }}
              />
            ) : editor ? (
              <ItemEditor
                itemId={editor}
                itemTypes={itemTypes}
                projectId={project.id}
                onDirtyChange={setEditorDirty}
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
