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
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Ellipsis,
  ExternalLink,
  Eye,
  EyeOff,
  GripVertical,
  LoaderCircle,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  classificationKeys,
  createCustomField,
  listClassification,
} from "@/features/classification/api";
import type {
  CustomFieldEntry,
  CustomFieldType,
} from "@/features/classification/types";
import type { TimelineItemType } from "@/features/item-types/types";
import type { EntityRelationship } from "@/features/relationships/types";
import { ItemTypeIcon } from "@/features/item-types/item-type-icon";
import {
  createTimelineEvent,
  getTimelineEvent,
  timelineEventKeys,
  updateTimelineEvent,
} from "@/features/timeline-events/api";
import type { TimelineEventSummary } from "@/features/timeline-events/types";
import {
  emptyTimelineEventValues,
  type TimelineEventInput,
} from "@/features/timeline-events/validation";
import {
  createTimelineItem,
  getTimelineItem,
  timelineItemKeys,
  updateTimelineItem,
} from "@/features/timeline-items/api";
import type {
  HistoricalDate,
  TimelineItemSummary,
} from "@/features/timeline-items/types";
import type { TimelineDisplayGroup } from "@/features/timeline-items/timeline-viewport";
import {
  emptyTimelineItemValues,
  type TimelineItemInput,
} from "@/features/timeline-items/validation";
import {
  listTablePreferences,
  previewBulkEdit,
  runBulkEdit,
  saveTablePreference,
  tablePreferenceKeys,
  undoBulkEdit,
  type BulkOperation,
  type SavedTablePreference,
} from "@/features/table-view/api";
import {
  buildTableColumns,
  eventToInput,
  escapeCsvCell,
  formatHistoricalDate,
  itemToInput,
  parseHistoricalDate,
  relationshipsToCsvCell,
  setCustomFieldValue,
  type TableColumn,
  type TableEntityType,
} from "@/features/table-view/table-model";
import type { TablePreferenceInput } from "@/features/table-view/validation";
import { cn } from "@/lib/utils";

type RowSummary = TimelineItemSummary | TimelineEventSummary;
type TableDisplayEntry =
  | { kind: "group"; group: TimelineDisplayGroup }
  | { kind: "row"; row: RowSummary };
type DraftItem = {
  key: string;
  values: TimelineItemInput;
  startText: string;
  endText: string;
  saving: boolean;
  error: string;
};
type DraftEvent = {
  key: string;
  values: TimelineEventInput;
  dateText: string;
  saving: boolean;
  error: string;
};

const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: "文字列",
  multiline: "複数行",
  number: "数値",
  boolean: "真偽値",
  single_select: "単一選択",
  multi_select: "複数選択",
  url: "URL",
  historical_date: "歴史日付",
  entity_reference: "他アイテム参照",
};

function CellEditor({
  value,
  type = "text",
  disabled,
  wrap = false,
  options,
  onCommit,
}: {
  value: string;
  type?: "text" | "number" | "url" | "select";
  disabled?: boolean;
  wrap?: boolean;
  options?: { value: string; label: string }[];
  onCommit: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const displayValue =
    type === "select"
      ? (options?.find((option) => option.value === value)?.label ?? "未選択")
      : value;
  if (disabled)
    return (
      <span className="w-full px-2 text-muted-foreground">
        {displayValue || "未選択"}
      </span>
    );
  if (!editing)
    return (
      <button
        className={cn(
          "min-h-8 w-full px-2 text-left hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-primary",
          wrap
            ? "py-2 break-words whitespace-normal"
            : "truncate whitespace-nowrap",
        )}
        type="button"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
      >
        {displayValue || <span className="text-muted-foreground">未入力</span>}
      </button>
    );
  const commit = () => {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  };
  return type === "select" ? (
    <select
      autoFocus
      className="h-8 w-full border-0 bg-background px-2 text-sm ring-2 ring-primary outline-none"
      value={draft}
      onBlur={commit}
      onChange={(event) => {
        setDraft(event.target.value);
        queueMicrotask(() => event.target.blur());
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
    >
      <option value="">未選択</option>
      {options?.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ) : (
    <input
      autoFocus
      className="h-8 w-full border-0 bg-background px-2 text-sm ring-2 ring-primary outline-none"
      type={type}
      value={draft}
      onBlur={commit}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
    />
  );
}

function PropertyDialog({
  open,
  entityType,
  projectId,
  onOpenChange,
}: {
  open: boolean;
  entityType: TableEntityType;
  projectId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const client = useQueryClient();
  const [name, setName] = useState("");
  const [fieldType, setFieldType] = useState<CustomFieldType>("text");
  const [options, setOptions] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      createCustomField(projectId, {
        entityType,
        scope: "project",
        targetTypeId: null,
        name,
        fieldType,
        isRequired: false,
        options: options
          .split(",")
          .map((option) => option.trim())
          .filter(Boolean),
        description: null,
      }),
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: classificationKeys.all(projectId),
      });
      setName("");
      setOptions("");
      onOpenChange(false);
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新しいプロパティ</DialogTitle>
          <DialogDescription>
            追加したプロパティは詳細画面でも使えるカスタムフィールドになります。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="table-property-name">名前</Label>
            <Input
              id="table-property-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="table-property-type">種類</Label>
            <select
              id="table-property-type"
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={fieldType}
              onChange={(event) =>
                setFieldType(event.target.value as CustomFieldType)
              }
            >
              {Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {fieldType === "single_select" || fieldType === "multi_select" ? (
            <div className="space-y-1">
              <Label htmlFor="table-property-options">
                選択肢（カンマ区切り）
              </Label>
              <Input
                id="table-property-options"
                value={options}
                onChange={(event) => setOptions(event.target.value)}
              />
            </div>
          ) : null}
          <Button
            disabled={
              !name.trim() ||
              mutation.isPending ||
              ((fieldType === "single_select" ||
                fieldType === "multi_select") &&
                !options.trim())
            }
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Plus aria-hidden="true" />
            )}
            プロパティを追加
          </Button>
          {mutation.error ? (
            <p role="alert" className="text-sm text-destructive">
              {mutation.error.message}
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function tagText(row: { tags?: { name: string }[] }) {
  return row.tags?.map((tag) => tag.name).join(", ") ?? "";
}

function TagCell({
  tags,
  selectedIds,
  wrap,
  onCommit,
}: {
  tags: { id: string; name: string; color: string }[];
  selectedIds: string[];
  wrap: boolean;
  onCommit: (ids: string[]) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "min-h-8 w-full px-2 text-left hover:bg-muted/70",
            wrap
              ? "py-2 break-words whitespace-normal"
              : "truncate whitespace-nowrap",
          )}
        >
          {tags
            .filter((tag) => selectedIds.includes(tag.id))
            .map((tag) => tag.name)
            .join(", ") || (
            <span className="text-muted-foreground">未設定</span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-72 overflow-y-auto">
        {tags.map((tag) => (
          <DropdownMenuCheckboxItem
            key={tag.id}
            checked={selectedIds.includes(tag.id)}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(checked) =>
              onCommit(
                checked
                  ? [...new Set([...selectedIds, tag.id])]
                  : selectedIds.filter((id) => id !== tag.id),
              )
            }
          >
            <span
              className="size-3 rounded-sm"
              style={{ backgroundColor: tag.color }}
            />
            {tag.name}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function handleCellKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
  if (event.target !== event.currentTarget) return;
  const cell = event.currentTarget;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
    event.preventDefault();
    void navigator.clipboard.writeText(cell.innerText.trim());
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    cell.querySelector<HTMLElement>("button, input, select")?.click();
    return;
  }
  const row = cell.parentElement;
  if (!row) return;
  const cells = [...row.querySelectorAll<HTMLElement>("[role='cell']")];
  const index = cells.indexOf(cell);
  let target: HTMLElement | undefined;
  if (event.key === "ArrowLeft") target = cells[index - 1];
  if (event.key === "ArrowRight") target = cells[index + 1];
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    const sibling =
      event.key === "ArrowUp"
        ? row.parentElement?.previousElementSibling
        : row.parentElement?.nextElementSibling;
    target = sibling?.querySelectorAll<HTMLElement>("[role='cell']")[index];
  }
  if (target) {
    event.preventDefault();
    target.focus();
  }
}

function SortableColumnControl({
  column,
  visible,
  onVisibilityChange,
}: {
  column: TableColumn;
  visible: boolean;
  onVisibilityChange: (visible: boolean) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
        isDragging && "z-50 bg-background shadow-md",
      )}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        aria-label={`${column.label}をドラッグして並べ替え`}
        className="cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing"
        type="button"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>
      <span className={cn("min-w-0 flex-1 truncate", !visible && "opacity-50")}>
        {column.label}
      </span>
      <button
        aria-label={`${column.label}を${visible ? "非表示" : "表示"}`}
        aria-pressed={visible}
        className="rounded p-1 hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-30"
        disabled={column.id === "title"}
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onPointerUp={(event) => {
          event.stopPropagation();
          onVisibilityChange(!visible);
        }}
        onClick={(event) => {
          if (event.detail === 0) onVisibilityChange(!visible);
        }}
      >
        {visible ? (
          <Eye className="size-4" aria-hidden="true" />
        ) : (
          <EyeOff className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

function ItemRow({
  row,
  projectId,
  columns,
  itemTypes,
  allTags,
  widths,
  wrapped,
  frozenCount,
  selected,
  dimmed,
  onSelectedChange,
  onOpen,
}: {
  row: TimelineItemSummary;
  projectId: string;
  columns: TableColumn[];
  itemTypes: TimelineItemType[];
  allTags: { id: string; name: string; color: string }[];
  widths: Record<string, number>;
  wrapped: Set<string>;
  frozenCount: number;
  selected: boolean;
  dimmed: boolean;
  onSelectedChange: (checked: boolean) => void;
  onOpen: () => void;
}) {
  const client = useQueryClient();
  const detail = useQuery({
    queryKey: timelineItemKeys.detail(projectId, row.id),
    queryFn: () => getTimelineItem(projectId, row.id),
  });
  const update = useMutation({
    mutationFn: (values: TimelineItemInput) =>
      updateTimelineItem(projectId, row.id, values, detail.data!.updatedAt),
    onSuccess: async (item) => {
      client.setQueryData(timelineItemKeys.detail(projectId, row.id), item);
      await client.invalidateQueries({
        queryKey: timelineItemKeys.list(projectId),
      });
    },
  });
  const item = detail.data;
  const commit = (column: TableColumn, raw: string | boolean) => {
    if (!item || update.isPending) return;
    let values = itemToInput(item);
    if (column.id === "title") values = { ...values, title: String(raw) };
    else if (column.id === "start") {
      const date = parseHistoricalDate(String(raw));
      if (!date) return;
      values =
        item.temporalType === "point"
          ? { ...values, point: date }
          : { ...values, start: date };
    } else if (column.id === "end") {
      const date = parseHistoricalDate(String(raw));
      if (!date || item.temporalType === "point") return;
      values = { ...values, end: date, endDateStatus: "specified" };
    } else if (column.id === "endDateStatus") {
      const status = String(raw) as "specified" | "ongoing" | "unknown";
      values = {
        ...values,
        endDateStatus: status,
        end: status === "specified" ? values.end : null,
      };
    } else if (column.id === "temporalType") {
      if (raw === "point") {
        values = {
          ...values,
          temporalType: "point",
          point: item.start ?? item.point,
          start: null,
          endDateStatus: null,
          end: null,
          lastConfirmed: null,
        };
      } else {
        values = {
          ...values,
          temporalType: "range",
          start: item.point ?? item.start,
          point: null,
          endDateStatus: "unknown",
        };
      }
    } else if (column.id === "typeId")
      values = { ...values, typeId: String(raw) };
    else if (column.id === "tags")
      values = { ...values, tagIds: String(raw).split(",").filter(Boolean) };
    else if (column.id === "isVisible")
      values = { ...values, isVisible: Boolean(raw) };
    else if (column.id === "colorOverride")
      values = { ...values, colorOverride: String(raw) || null };
    else if (column.id === "externalUrl")
      values = { ...values, externalUrl: String(raw) };
    else if (column.customField) {
      const field = column.customField;
      const parsedValue: CustomFieldEntry["value"] | null =
        field.fieldType === "number"
          ? raw === ""
            ? null
            : Number(raw)
          : field.fieldType === "boolean"
            ? Boolean(raw)
            : field.fieldType === "multi_select"
              ? String(raw)
                  .split(",")
                  .map((value) => value.trim())
                  .filter(Boolean)
              : field.fieldType === "historical_date"
                ? parseHistoricalDate(String(raw))
                : field.fieldType === "entity_reference"
                  ? (() => {
                      const [entityType, entityId] = String(raw).split(":");
                      return entityId &&
                        (entityType === "timeline_item" ||
                          entityType === "timeline_event")
                        ? { entityType, entityId }
                        : null;
                    })()
                  : String(raw);
      values = {
        ...values,
        customFields: setCustomFieldValue(
          values.customFields ?? [],
          field.id,
          parsedValue,
        ),
      };
    }
    update.mutate(values);
  };
  return (
    <div
      className={cn(
        "flex min-w-max border-b bg-background text-sm",
        dimmed && "opacity-40 grayscale",
      )}
      data-testid={`table-item-row-${row.id}`}
      role="row"
    >
      <label className="sticky left-0 z-20 flex w-10 shrink-0 items-center justify-center border-r bg-background">
        <input
          aria-label={`${row.title}を選択`}
          checked={selected}
          type="checkbox"
          onChange={(event) => onSelectedChange(event.target.checked)}
        />
      </label>
      {columns.map((column, index) => {
        const width = widths[column.id] ?? column.defaultWidth;
        const frozen = index < frozenCount;
        const left =
          40 +
          columns
            .slice(0, index)
            .reduce(
              (sum, previous) =>
                sum + (widths[previous.id] ?? previous.defaultWidth),
              0,
            );
        const value = !item
          ? column.id === "title"
            ? row.title
            : ""
          : column.id === "title"
            ? item.title
            : column.id === "start"
              ? formatHistoricalDate(
                  item.temporalType === "point" ? item.point : item.start,
                )
              : column.id === "end"
                ? formatHistoricalDate(item.end)
                : column.id === "endDateStatus"
                  ? (item.endDateStatus ?? "")
                  : column.id === "temporalType"
                    ? item.temporalType
                    : column.id === "typeId"
                      ? item.typeId
                      : column.id === "tags"
                        ? tagText(item)
                        : column.id === "colorOverride"
                          ? (item.colorOverride ?? "")
                          : column.id === "externalUrl"
                            ? (item.externalUrl ?? "")
                            : column.customField
                              ? String(
                                  item.customFields?.find(
                                    (entry) =>
                                      entry.fieldId === column.customField!.id,
                                  )?.value ?? "",
                                )
                              : "";
        const style = { width, left: frozen ? left : undefined };
        return (
          <div
            key={column.id}
            className={cn(
              "flex min-h-10 shrink-0 items-center border-r",
              frozen &&
                "sticky z-10 bg-background shadow-[1px_0_0_hsl(var(--border))]",
              wrapped.has(column.id)
                ? "whitespace-normal"
                : "whitespace-nowrap",
            )}
            role="cell"
            style={style}
            tabIndex={0}
            onKeyDown={handleCellKeyDown}
          >
            {column.id === "title" ? (
              <div className="flex min-w-0 flex-1 items-center">
                <CellEditor
                  wrap={wrapped.has(column.id)}
                  value={value}
                  onCommit={(next) => commit(column, next)}
                />
                <Button
                  className="mr-1 h-7 px-2"
                  size="sm"
                  variant="ghost"
                  onClick={onOpen}
                >
                  開く
                </Button>
              </div>
            ) : column.id === "isVisible" ? (
              <button
                aria-label={
                  item?.isVisible
                    ? "表示中。クリックで非表示"
                    : "非表示。クリックで表示"
                }
                className="flex w-full items-center justify-center"
                disabled={!item}
                type="button"
                onClick={() => commit(column, !item?.isVisible)}
              >
                {item?.isVisible ? (
                  <Eye className="size-4" />
                ) : (
                  <EyeOff className="size-4" />
                )}
              </button>
            ) : column.id === "typeId" ? (
              <CellEditor
                type="select"
                value={value}
                options={itemTypes.map((type) => ({
                  value: type.id,
                  label: type.name,
                }))}
                onCommit={(next) => commit(column, next)}
              />
            ) : column.id === "temporalType" ? (
              <CellEditor
                type="select"
                value={value}
                options={[
                  { value: "range", label: "期間" },
                  { value: "point", label: "時点" },
                ]}
                onCommit={(next) => commit(column, next)}
              />
            ) : column.id === "endDateStatus" ? (
              <CellEditor
                disabled={item?.temporalType === "point"}
                type="select"
                value={value}
                options={[
                  { value: "specified", label: "終了日指定" },
                  { value: "ongoing", label: "継続中" },
                  { value: "unknown", label: "終了日不明" },
                ]}
                onCommit={(next) => commit(column, next)}
              />
            ) : column.id === "end" ? (
              <CellEditor
                disabled={item?.temporalType === "point"}
                wrap={wrapped.has(column.id)}
                value={value}
                onCommit={(next) => commit(column, next)}
              />
            ) : column.id === "tags" ? (
              <TagCell
                selectedIds={item?.tags?.map((tag) => tag.id) ?? []}
                tags={allTags}
                wrap={wrapped.has(column.id)}
                onCommit={(ids) => commit(column, ids.join(","))}
              />
            ) : column.id === "colorOverride" ? (
              <label className="flex w-full items-center gap-2 px-2">
                <input
                  aria-label="個別色"
                  type="color"
                  value={value || "#00B0B0"}
                  onChange={(event) => commit(column, event.target.value)}
                />
                <span>{value || "既定"}</span>
              </label>
            ) : column.id === "externalUrl" ? (
              <div className="flex min-w-0 flex-1 items-center">
                <CellEditor
                  type="url"
                  wrap={wrapped.has(column.id)}
                  value={value}
                  onCommit={(next) => commit(column, next)}
                />
                {value ? (
                  <a
                    aria-label="外部URLを開く"
                    className="mr-2 text-primary"
                    href={value}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ExternalLink className="size-4" />
                  </a>
                ) : null}
              </div>
            ) : column.customField?.fieldType === "boolean" ? (
              <label className="flex w-full items-center gap-2 px-2">
                <input
                  checked={value === "true"}
                  type="checkbox"
                  onChange={(event) => commit(column, event.target.checked)}
                />
                {value === "true" ? "はい" : "いいえ"}
              </label>
            ) : column.customField?.fieldType === "single_select" ? (
              <CellEditor
                type="select"
                value={value}
                options={column.customField.options.map((option) => ({
                  value: option,
                  label: option,
                }))}
                onCommit={(next) => commit(column, next)}
              />
            ) : (
              <CellEditor
                type={
                  column.customField?.fieldType === "number"
                    ? "number"
                    : column.customField?.fieldType === "url"
                      ? "url"
                      : "text"
                }
                wrap={wrapped.has(column.id)}
                value={value}
                onCommit={(next) => commit(column, next)}
              />
            )}
          </div>
        );
      })}
      {update.error ? (
        <span
          className="self-center px-3 text-xs text-destructive"
          role="alert"
        >
          {update.error.message}
        </span>
      ) : null}
    </div>
  );
}

function EventRow({
  row,
  projectId,
  columns,
  eventTypes,
  allTags,
  allItems,
  widths,
  wrapped,
  frozenCount,
  selected,
  dimmed,
  onSelectedChange,
  onOpen,
}: {
  row: TimelineEventSummary;
  projectId: string;
  columns: TableColumn[];
  eventTypes: { id: string; name: string }[];
  allTags: { id: string; name: string; color: string }[];
  allItems: TimelineItemSummary[];
  widths: Record<string, number>;
  wrapped: Set<string>;
  frozenCount: number;
  selected: boolean;
  dimmed: boolean;
  onSelectedChange: (checked: boolean) => void;
  onOpen: () => void;
}) {
  const client = useQueryClient();
  const detail = useQuery({
    queryKey: timelineEventKeys.detail(projectId, row.id),
    queryFn: () => getTimelineEvent(projectId, row.id),
  });
  const update = useMutation({
    mutationFn: (values: TimelineEventInput) =>
      updateTimelineEvent(projectId, row.id, values, detail.data!.updatedAt),
    onSuccess: async (event) => {
      client.setQueryData(timelineEventKeys.detail(projectId, row.id), event);
      await client.invalidateQueries({
        queryKey: timelineEventKeys.list(projectId),
      });
    },
  });
  const event = detail.data;
  const commit = (column: TableColumn, raw: string | boolean) => {
    if (!event || update.isPending) return;
    let values = eventToInput(event);
    if (column.id === "title") values = { ...values, title: String(raw) };
    else if (column.id === "date") {
      const date = parseHistoricalDate(String(raw));
      if (!date) return;
      values = { ...values, date };
    } else if (column.id === "eventTypeId")
      values = { ...values, eventTypeId: String(raw) || null };
    else if (column.id === "tags")
      values = { ...values, tagIds: String(raw).split(",").filter(Boolean) };
    else if (column.id === "parents")
      values = {
        ...values,
        timelineItemIds: String(raw).split(",").filter(Boolean),
      };
    else if (column.id === "externalUrl")
      values = { ...values, externalUrl: String(raw) };
    else if (column.customField) {
      const field = column.customField;
      const parsedValue: CustomFieldEntry["value"] | null =
        field.fieldType === "number"
          ? raw === ""
            ? null
            : Number(raw)
          : field.fieldType === "boolean"
            ? Boolean(raw)
            : field.fieldType === "multi_select"
              ? String(raw)
                  .split(",")
                  .map((value) => value.trim())
                  .filter(Boolean)
              : field.fieldType === "historical_date"
                ? parseHistoricalDate(String(raw))
                : String(raw);
      values = {
        ...values,
        customFields: setCustomFieldValue(
          values.customFields ?? [],
          field.id,
          parsedValue,
        ),
      };
    }
    update.mutate(values);
  };
  return (
    <div
      className={cn(
        "flex min-w-max border-b bg-background text-sm",
        dimmed && "opacity-40 grayscale",
      )}
      data-testid={`table-event-row-${row.id}`}
      role="row"
    >
      <label className="sticky left-0 z-20 flex w-10 shrink-0 items-center justify-center border-r bg-background">
        <input
          aria-label={`${row.title}を選択`}
          checked={selected}
          type="checkbox"
          onChange={(event) => onSelectedChange(event.target.checked)}
        />
      </label>
      {columns.map((column, index) => {
        const width = widths[column.id] ?? column.defaultWidth;
        const frozen = index < frozenCount;
        const left =
          40 +
          columns
            .slice(0, index)
            .reduce(
              (sum, previous) =>
                sum + (widths[previous.id] ?? previous.defaultWidth),
              0,
            );
        const value = !event
          ? column.id === "title"
            ? row.title
            : ""
          : column.id === "title"
            ? event.title
            : column.id === "date"
              ? formatHistoricalDate(event.date)
              : column.id === "parents"
                ? event.parents.map((parent) => parent.title).join(", ")
                : column.id === "eventTypeId"
                  ? (event.eventTypeId ?? "")
                  : column.id === "tags"
                    ? tagText(event)
                    : column.id === "externalUrl"
                      ? (event.externalUrl ?? "")
                      : column.customField
                        ? String(
                            event.customFields?.find(
                              (entry) =>
                                entry.fieldId === column.customField!.id,
                            )?.value ?? "",
                          )
                        : "";
        return (
          <div
            key={column.id}
            className={cn(
              "flex min-h-10 shrink-0 items-center border-r",
              frozen &&
                "sticky z-10 bg-background shadow-[1px_0_0_hsl(var(--border))]",
              wrapped.has(column.id)
                ? "whitespace-normal"
                : "whitespace-nowrap",
            )}
            role="cell"
            style={{ width, left: frozen ? left : undefined }}
            tabIndex={0}
            onKeyDown={handleCellKeyDown}
          >
            {column.id === "title" ? (
              <div className="flex min-w-0 flex-1 items-center">
                <CellEditor
                  wrap={wrapped.has(column.id)}
                  value={value}
                  onCommit={(next) => commit(column, next)}
                />
                <Button
                  className="mr-1 h-7 px-2"
                  size="sm"
                  variant="ghost"
                  onClick={onOpen}
                >
                  開く
                </Button>
              </div>
            ) : column.id === "eventTypeId" ? (
              <CellEditor
                type="select"
                value={value}
                options={eventTypes.map((type) => ({
                  value: type.id,
                  label: type.name,
                }))}
                onCommit={(next) => commit(column, next)}
              />
            ) : column.id === "tags" ? (
              <TagCell
                selectedIds={event?.tags?.map((tag) => tag.id) ?? []}
                tags={allTags}
                wrap={wrapped.has(column.id)}
                onCommit={(ids) => commit(column, ids.join(","))}
              />
            ) : column.id === "parents" ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "min-h-8 w-full px-2 text-left hover:bg-muted/70",
                      wrapped.has(column.id)
                        ? "py-2 break-words whitespace-normal"
                        : "truncate whitespace-nowrap",
                    )}
                  >
                    {value || "未設定"}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-72 overflow-y-auto">
                  {allItems
                    .filter((item) => item.temporalType === "range")
                    .map((item) => (
                      <DropdownMenuCheckboxItem
                        key={item.id}
                        checked={event?.timelineItemIds.includes(item.id)}
                        disabled={
                          event?.timelineItemIds.includes(item.id) &&
                          event.timelineItemIds.length === 1
                        }
                        onSelect={(selectEvent) => selectEvent.preventDefault()}
                        onCheckedChange={(checked) => {
                          const current = event?.timelineItemIds ?? [];
                          commit(
                            column,
                            (checked
                              ? [...new Set([...current, item.id])]
                              : current.filter((id) => id !== item.id)
                            ).join(","),
                          );
                        }}
                      >
                        {item.title}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : column.id === "externalUrl" ? (
              <div className="flex min-w-0 flex-1 items-center">
                <CellEditor
                  type="url"
                  wrap={wrapped.has(column.id)}
                  value={value}
                  onCommit={(next) => commit(column, next)}
                />
                {value ? (
                  <a
                    className="mr-2 text-primary"
                    href={value}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ExternalLink className="size-4" />
                  </a>
                ) : null}
              </div>
            ) : column.customField?.fieldType === "boolean" ? (
              <label className="flex w-full items-center gap-2 px-2">
                <input
                  checked={value === "true"}
                  type="checkbox"
                  onChange={(changeEvent) =>
                    commit(column, changeEvent.target.checked)
                  }
                />
                {value === "true" ? "はい" : "いいえ"}
              </label>
            ) : column.customField?.fieldType === "single_select" ? (
              <CellEditor
                type="select"
                value={value}
                options={column.customField.options.map((option) => ({
                  value: option,
                  label: option,
                }))}
                onCommit={(next) => commit(column, next)}
              />
            ) : (
              <CellEditor
                wrap={wrapped.has(column.id)}
                value={value}
                onCommit={(next) => commit(column, next)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function TimelineTableView({
  projectId,
  items,
  itemGroups,
  events,
  relationships,
  itemTypes,
  currentDate,
  dimmedItemIds,
  dimmedEventIds,
  onToggleItemGroup,
  onOpenItem,
  onOpenEvent,
}: {
  projectId: string;
  items: TimelineItemSummary[];
  itemGroups: TimelineDisplayGroup[];
  events: TimelineEventSummary[];
  relationships: EntityRelationship[];
  itemTypes: TimelineItemType[];
  currentDate: HistoricalDate;
  dimmedItemIds: ReadonlySet<string>;
  dimmedEventIds: ReadonlySet<string>;
  onToggleItemGroup: (groupId: string) => void;
  onOpenItem?: (itemId: string) => void;
  onOpenEvent?: (eventId: string, editing: boolean) => void;
}) {
  const client = useQueryClient();
  const [entityType, setEntityType] =
    useState<TableEntityType>("timeline_item");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [propertyOpen, setPropertyOpen] = useState(false);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [draftEvents, setDraftEvents] = useState<DraftEvent[]>([]);
  const [lastOperation, setLastOperation] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [bulkError, setBulkError] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    types: true,
    tags: true,
    parents: true,
    relationships: true,
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const classification = useQuery({
    queryKey: classificationKeys.all(projectId),
    queryFn: () => listClassification(projectId),
  });
  const preferences = useQuery({
    queryKey: tablePreferenceKeys.list(projectId),
    queryFn: () => listTablePreferences(projectId),
  });
  const allColumns = useMemo(
    () =>
      buildTableColumns(entityType, classification.data?.customFields ?? []),
    [classification.data?.customFields, entityType],
  );
  const saved = preferences.data?.find(
    (preference) => preference.entityType === entityType,
  );
  const [localVisible, setLocalVisible] = useState<
    Record<TableEntityType, string[]>
  >({
    timeline_item: [],
    timeline_event: [],
  });
  const [localOrder, setLocalOrder] = useState<
    Record<TableEntityType, string[]>
  >({
    timeline_item: [],
    timeline_event: [],
  });
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [wrapped, setWrapped] = useState<Set<string>>(new Set());
  const [frozenCount, setFrozenCount] = useState(1);
  const preferenceSnapshotRef = useRef<TablePreferenceInput | null>(null);
  const preferenceSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    if (!saved) return;
    setLocalVisible((value) => ({
      ...value,
      [entityType]: saved.visibleColumns,
    }));
    setLocalOrder((value) => ({
      ...value,
      [entityType]: saved.columnOrder,
    }));
    setWidths(saved.columnWidths);
    setWrapped(new Set(saved.wrappedColumns));
    setFrozenCount(saved.frozenColumnCount);
    if (preferenceSnapshotRef.current?.entityType !== entityType)
      preferenceSnapshotRef.current = saved;
  }, [entityType, saved]);
  const visibleIds = localVisible[entityType].length
    ? localVisible[entityType]
    : allColumns.map((column) => column.id);
  const columnOrderIds = [
    ...localOrder[entityType].filter((id) =>
      allColumns.some((column) => column.id === id),
    ),
    ...allColumns
      .map((column) => column.id)
      .filter((id) => !localOrder[entityType].includes(id)),
  ];
  const columns = columnOrderIds
    .filter((id) => visibleIds.includes(id))
    .map((id) => allColumns.find((column) => column.id === id))
    .filter((column): column is TableColumn => Boolean(column));
  const displayedRows = useMemo<RowSummary[]>(
    () =>
      entityType === "timeline_item"
        ? itemGroups.flatMap((group) => (group.collapsed ? [] : group.items))
        : events,
    [entityType, events, itemGroups],
  );
  const displayEntries = useMemo<TableDisplayEntry[]>(
    () =>
      entityType === "timeline_item"
        ? itemGroups.flatMap((group) => [
            ...(group.showHeader ? [{ kind: "group" as const, group }] : []),
            ...(group.collapsed
              ? []
              : group.items.map((row) => ({ kind: "row" as const, row }))),
          ])
        : events.map((row) => ({ kind: "row" as const, row })),
    [entityType, events, itemGroups],
  );
  useEffect(() => {
    const displayedIds = new Set(displayedRows.map((row) => row.id));
    setSelected((current) => {
      const next = new Set([...current].filter((id) => displayedIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [displayedRows]);
  const virtualizer = useVirtualizer({
    count: displayEntries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 41,
    overscan: 8,
  });
  const persist = (next: {
    visibleColumns?: string[];
    columnOrder?: string[];
    columnWidths?: Record<string, number>;
    wrappedColumns?: string[];
    frozenColumnCount?: number;
  }) => {
    const current =
      preferenceSnapshotRef.current?.entityType === entityType
        ? preferenceSnapshotRef.current
        : {
            entityType,
            visibleColumns: visibleIds,
            columnOrder: columnOrderIds,
            columnWidths: widths,
            wrappedColumns: [...wrapped],
            frozenColumnCount: frozenCount,
          };
    const input = {
      entityType,
      visibleColumns: next.visibleColumns ?? current.visibleColumns,
      columnOrder: next.columnOrder ?? current.columnOrder,
      columnWidths: next.columnWidths ?? current.columnWidths,
      wrappedColumns: next.wrappedColumns ?? current.wrappedColumns,
      frozenColumnCount: next.frozenColumnCount ?? current.frozenColumnCount,
    };
    preferenceSnapshotRef.current = input;
    const saveLatestPreference = async () => {
      const savedPreference = await saveTablePreference(projectId, input);
      client.setQueryData<SavedTablePreference[]>(
        tablePreferenceKeys.list(projectId),
        (current = []) => [
          ...current.filter(
            (preference) => preference.entityType !== input.entityType,
          ),
          savedPreference,
        ],
      );
    };
    preferenceSaveQueueRef.current = preferenceSaveQueueRef.current.then(
      saveLatestPreference,
      saveLatestPreference,
    );
    void preferenceSaveQueueRef.current;
  };
  const setVisibleColumns = (next: string[]) => {
    setLocalVisible((value) => ({ ...value, [entityType]: next }));
    persist({ visibleColumns: next });
  };
  const columnSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const handleColumnDragEnd = (event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) return;
    const oldIndex = columnOrderIds.indexOf(String(event.active.id));
    const newIndex = columnOrderIds.indexOf(String(event.over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(columnOrderIds, oldIndex, newIndex);
    setLocalOrder((value) => ({ ...value, [entityType]: next }));
    persist({ columnOrder: next });
  };
  const orderedColumns = columnOrderIds
    .map((id) => allColumns.find((column) => column.id === id))
    .filter((column): column is TableColumn => Boolean(column));
  const renderColumnControls = (source: "toolbar" | "header") => (
    <>
      <DropdownMenuLabel>列の表示・非表示と順番</DropdownMenuLabel>
      <DndContext
        id={`table-columns-${source}-${entityType}`}
        collisionDetection={closestCenter}
        sensors={columnSensors}
        onDragEnd={handleColumnDragEnd}
      >
        <SortableContext
          items={columnOrderIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-0.5 py-1">
            {orderedColumns.map((column) => (
              <SortableColumnControl
                key={column.id}
                column={column}
                visible={visibleIds.includes(column.id)}
                onVisibilityChange={(visible) => {
                  const next = visible
                    ? columnOrderIds.filter(
                        (id) => id === column.id || visibleIds.includes(id),
                      )
                    : visibleIds.filter((id) => id !== column.id);
                  setVisibleColumns(next);
                }}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>左から固定する列数</DropdownMenuLabel>
      {[1, 2, 3, 4].map((count) => (
        <DropdownMenuItem
          key={count}
          onSelect={() => {
            setFrozenCount(count);
            persist({ frozenColumnCount: count });
          }}
        >
          {frozenCount === count ? (
            <Check className="size-4" />
          ) : (
            <span className="size-4" />
          )}
          {count}列
        </DropdownMenuItem>
      ))}
    </>
  );
  const addDraft = () => {
    if (entityType === "timeline_item") {
      setDraftItems((drafts) => [
        ...drafts,
        {
          key: crypto.randomUUID(),
          values: emptyTimelineItemValues(itemTypes[0]?.id ?? ""),
          startText: "",
          endText: "",
          saving: false,
          error: "",
        },
      ]);
    } else {
      setDraftEvents((drafts) => [
        ...drafts,
        {
          key: crypto.randomUUID(),
          values: emptyTimelineEventValues(
            items.find((item) => item.temporalType === "range")?.id ?? "",
            currentDate,
          ),
          dateText: formatHistoricalDate(currentDate),
          saving: false,
          error: "",
        },
      ]);
    }
  };
  const applyBulk = async (operation: BulkOperation) => {
    if (!selected.size || bulkBusy) return;
    setBulkBusy(true);
    setBulkError("");
    try {
      const ids = [...selected];
      if (operation.kind === "delete") {
        const { preview } = await previewBulkEdit(
          projectId,
          entityType,
          ids,
          operation,
        );
        const references = preview.references
          ? `\n関連リンク ${preview.references}件も影響を受けます。`
          : "";
        if (
          !window.confirm(`${preview.selected}件を削除しますか？${references}`)
        )
          return;
      }
      const result = await runBulkEdit(projectId, entityType, ids, operation);
      setLastOperation(result.operation);
      setSelected(new Set());
      await Promise.all([
        client.invalidateQueries({
          queryKey: timelineItemKeys.list(projectId),
        }),
        client.invalidateQueries({
          queryKey: timelineEventKeys.list(projectId),
        }),
      ]);
    } catch (reason) {
      setBulkError(
        reason instanceof Error ? reason.message : "一括操作に失敗しました。",
      );
    } finally {
      setBulkBusy(false);
    }
  };
  const exportSelected = () => {
    const selectedRows = displayedRows.filter((row) => selected.has(row.id));
    const headers =
      entityType === "timeline_item"
        ? [
            "id",
            "title",
            ...(exportOptions.types ? ["type"] : []),
            "start_or_point",
            "end",
            "end_status",
            ...(exportOptions.tags ? ["tags"] : []),
            ...(exportOptions.relationships ? ["relationships"] : []),
          ]
        : [
            "id",
            "title",
            "date",
            ...(exportOptions.types ? ["event_type"] : []),
            ...(exportOptions.parents ? ["parent_ids"] : []),
            ...(exportOptions.tags ? ["tags"] : []),
            ...(exportOptions.relationships ? ["relationships"] : []),
          ];
    const csvRows = selectedRows.map((summary) => {
      if (entityType === "timeline_item") {
        const item = summary as TimelineItemSummary;
        return [
          item.id,
          item.title,
          ...(exportOptions.types ? [item.itemType.name] : []),
          formatHistoricalDate(
            item.temporalType === "point" ? item.point : item.start,
          ),
          formatHistoricalDate(item.end),
          item.endDateStatus ?? "",
          ...(exportOptions.tags ? [tagText(item)] : []),
          ...(exportOptions.relationships
            ? [relationshipsToCsvCell(relationships, "timeline_item", item.id)]
            : []),
        ];
      }
      const event = summary as TimelineEventSummary;
      return [
        event.id,
        event.title,
        formatHistoricalDate(event.date),
        ...(exportOptions.types ? [event.eventType?.name ?? ""] : []),
        ...(exportOptions.parents
          ? [JSON.stringify(event.timelineItemIds)]
          : []),
        ...(exportOptions.tags ? [tagText(event)] : []),
        ...(exportOptions.relationships
          ? [relationshipsToCsvCell(relationships, "timeline_event", event.id)]
          : []),
      ];
    });
    const content = [headers, ...csvRows]
      .map((row) => row.map(escapeCsvCell).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download =
      entityType === "timeline_item"
        ? "timeline-selection.csv"
        : "event-selection.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-background"
      aria-label="テーブルビュー"
    >
      <div className="flex flex-wrap items-center gap-2 border-b px-2 py-2">
        <Tabs
          value={entityType}
          onValueChange={(value) => {
            setEntityType(value as TableEntityType);
            setSelected(new Set());
          }}
        >
          <TabsList>
            <TabsTrigger value="timeline_item">タイムライン表</TabsTrigger>
            <TabsTrigger value="timeline_event">イベント表</TabsTrigger>
          </TabsList>
        </Tabs>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              <Settings2 aria-hidden="true" />列{" "}
              <ChevronDown aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="max-h-96 w-72 overflow-y-auto"
          >
            {renderColumnControls("toolbar")}
          </DropdownMenuContent>
        </DropdownMenu>
        {selected.size ? (
          <>
            <span className="text-sm text-muted-foreground">
              {selected.size}件選択
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={bulkBusy} size="sm" variant="outline">
                  一括変更 <ChevronDown aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                {entityType === "timeline_item" ? (
                  <>
                    <DropdownMenuItem
                      onSelect={() =>
                        void applyBulk({ kind: "set_visibility", value: true })
                      }
                    >
                      <Eye className="size-4" />
                      表示する
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        void applyBulk({ kind: "set_visibility", value: false })
                      }
                    >
                      <EyeOff className="size-4" />
                      非表示にする
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                ) : null}
                <DropdownMenuLabel>種別を変更</DropdownMenuLabel>
                {(entityType === "timeline_item"
                  ? itemTypes
                  : (classification.data?.eventTypes ?? [])
                ).map((type) => (
                  <DropdownMenuItem
                    key={type.id}
                    onSelect={() =>
                      void applyBulk({ kind: "set_type", value: type.id })
                    }
                  >
                    {type.name}
                  </DropdownMenuItem>
                ))}
                {entityType === "timeline_event" ? (
                  <DropdownMenuItem
                    onSelect={() =>
                      void applyBulk({ kind: "set_type", value: null })
                    }
                  >
                    種別なし
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuCheckboxItem
                  checked={exportOptions.relationships}
                  onCheckedChange={(checked) =>
                    setExportOptions((value) => ({
                      ...value,
                      relationships: checked === true,
                    }))
                  }
                >
                  関係性を含める
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>タグを追加</DropdownMenuLabel>
                {(classification.data?.tags ?? []).map((tag) => (
                  <DropdownMenuItem
                    key={tag.id}
                    onSelect={() =>
                      void applyBulk({
                        kind: "tags",
                        mode: "add",
                        tagIds: [tag.id],
                      })
                    }
                  >
                    <span
                      className="size-3 rounded-sm"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>タグを削除</DropdownMenuLabel>
                {(classification.data?.tags ?? []).map((tag) => (
                  <DropdownMenuItem
                    key={`remove-${tag.id}`}
                    onSelect={() =>
                      void applyBulk({
                        kind: "tags",
                        mode: "remove",
                        tagIds: [tag.id],
                      })
                    }
                  >
                    {tag.name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>タグを置換</DropdownMenuLabel>
                {(classification.data?.tags ?? []).map((tag) => (
                  <DropdownMenuItem
                    key={`replace-${tag.id}`}
                    onSelect={() =>
                      void applyBulk({
                        kind: "tags",
                        mode: "replace",
                        tagIds: [tag.id],
                      })
                    }
                  >
                    {tag.name}だけにする
                  </DropdownMenuItem>
                ))}
                {entityType === "timeline_item" ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>個別色を変更</DropdownMenuLabel>
                    <div className="flex items-center gap-2 px-2 py-1 text-sm">
                      <input
                        aria-label="一括設定する個別色"
                        type="color"
                        defaultValue="#00B0B0"
                        onChange={(event) =>
                          void applyBulk({
                            kind: "set_color",
                            value: event.target.value,
                          })
                        }
                      />
                      色を選択
                    </div>
                    <DropdownMenuItem
                      onSelect={() =>
                        void applyBulk({ kind: "set_color", value: null })
                      }
                    >
                      個別色を解除
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Download aria-hidden="true" />
                  CSV <ChevronDown aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuCheckboxItem
                  checked={exportOptions.types}
                  onCheckedChange={(checked) =>
                    setExportOptions((value) => ({
                      ...value,
                      types: checked === true,
                    }))
                  }
                >
                  種別を含める
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={exportOptions.tags}
                  onCheckedChange={(checked) =>
                    setExportOptions((value) => ({
                      ...value,
                      tags: checked === true,
                    }))
                  }
                >
                  タグを含める
                </DropdownMenuCheckboxItem>
                {entityType === "timeline_event" ? (
                  <DropdownMenuCheckboxItem
                    checked={exportOptions.parents}
                    onCheckedChange={(checked) =>
                      setExportOptions((value) => ({
                        ...value,
                        parents: checked === true,
                      }))
                    }
                  >
                    親関係を含める
                  </DropdownMenuCheckboxItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={exportSelected}>
                  選択した{selected.size}件を保存
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              disabled={bulkBusy}
              size="sm"
              variant="destructive"
              onClick={() => void applyBulk({ kind: "delete" })}
            >
              <Trash2 aria-hidden="true" />
              削除
            </Button>
          </>
        ) : null}
        {lastOperation ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              try {
                await undoBulkEdit(projectId, lastOperation.id);
                setLastOperation(null);
                await Promise.all([
                  client.invalidateQueries({
                    queryKey: timelineItemKeys.list(projectId),
                  }),
                  client.invalidateQueries({
                    queryKey: timelineEventKeys.list(projectId),
                  }),
                ]);
              } catch (reason) {
                setBulkError(
                  reason instanceof Error
                    ? reason.message
                    : "Undoに失敗しました。",
                );
              }
            }}
          >
            {lastOperation.label}を元に戻す
          </Button>
        ) : null}
        <span className="ml-auto text-xs text-muted-foreground">
          セルを編集後、フォーカスを外すと保存されます
        </span>
      </div>
      {bulkError ? (
        <p className="border-b px-3 py-2 text-sm text-destructive" role="alert">
          {bulkError}
        </p>
      ) : null}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-auto"
        role="table"
      >
        <div
          className="sticky top-0 z-30 flex min-w-max border-b bg-muted/95 text-xs font-medium backdrop-blur"
          role="row"
        >
          <label className="sticky left-0 z-40 flex h-10 w-10 shrink-0 items-center justify-center border-r bg-muted">
            <input
              aria-label="表示中の行をすべて選択"
              checked={
                displayedRows.length > 0 &&
                displayedRows.every((row) => selected.has(row.id))
              }
              type="checkbox"
              onChange={(event) =>
                setSelected(
                  event.target.checked
                    ? new Set(displayedRows.map((row) => row.id))
                    : new Set(),
                )
              }
            />
          </label>
          {columns.map((column, index) => {
            const width = widths[column.id] ?? column.defaultWidth;
            const left =
              40 +
              columns
                .slice(0, index)
                .reduce(
                  (sum, value) =>
                    sum + (widths[value.id] ?? value.defaultWidth),
                  0,
                );
            return (
              <div
                key={column.id}
                className={cn(
                  "group relative flex h-10 shrink-0 items-center gap-1 border-r px-2",
                  index < frozenCount && "sticky z-30 bg-muted",
                )}
                role="columnheader"
                style={{ width, left: index < frozenCount ? left : undefined }}
              >
                <GripVertical
                  className="size-3 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="truncate">{column.label}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      aria-label={`${column.label}の設定`}
                      className="ml-auto rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-background focus:opacity-100"
                    >
                      <ChevronDown className="size-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuCheckboxItem
                      checked={wrapped.has(column.id)}
                      onCheckedChange={(checked) => {
                        const next = new Set(wrapped);
                        if (checked) next.add(column.id);
                        else next.delete(column.id);
                        setWrapped(next);
                        persist({ wrappedColumns: [...next] });
                      }}
                    >
                      折り返して表示する
                    </DropdownMenuCheckboxItem>
                    {column.id !== "title" ? (
                      <DropdownMenuItem
                        onSelect={() => {
                          const next = visibleIds.filter(
                            (id) => id !== column.id,
                          );
                          setLocalVisible((value) => ({
                            ...value,
                            [entityType]: next,
                          }));
                          persist({ visibleColumns: next });
                        }}
                      >
                        列を非表示
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
                <button
                  aria-label={`${column.label}の幅を広げる`}
                  className="absolute inset-y-0 right-0 w-1 cursor-col-resize hover:bg-primary"
                  onDoubleClick={() => {
                    const next = {
                      ...widths,
                      [column.id]: column.defaultWidth,
                    };
                    setWidths(next);
                    persist({ columnWidths: next });
                  }}
                  onPointerDown={(event) => {
                    const startX = event.clientX;
                    const startWidth = width;
                    const move = (moveEvent: PointerEvent) => {
                      setWidths((current) => ({
                        ...current,
                        [column.id]: Math.max(
                          80,
                          Math.min(
                            800,
                            startWidth + moveEvent.clientX - startX,
                          ),
                        ),
                      }));
                    };
                    const up = (upEvent: PointerEvent) => {
                      const nextWidth = Math.max(
                        80,
                        Math.min(800, startWidth + upEvent.clientX - startX),
                      );
                      const next = { ...widths, [column.id]: nextWidth };
                      setWidths(next);
                      persist({ columnWidths: next });
                      window.removeEventListener("pointermove", move);
                      window.removeEventListener("pointerup", up);
                    };
                    window.addEventListener("pointermove", move);
                    window.addEventListener("pointerup", up);
                  }}
                />
              </div>
            );
          })}
          <div
            className="flex h-10 w-20 shrink-0 items-center justify-center gap-1 border-l bg-muted"
            role="columnheader"
            aria-label="列の操作"
          >
            <button
              aria-label="列を追加"
              className="rounded p-1 hover:bg-background focus-visible:ring-2 focus-visible:ring-primary"
              type="button"
              onClick={() => setPropertyOpen(true)}
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="列の表示と順番"
                  className="rounded p-1 hover:bg-background focus-visible:ring-2 focus-visible:ring-primary"
                  type="button"
                >
                  <Ellipsis className="size-4" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="max-h-96 w-72 overflow-y-auto"
              >
                {renderColumnControls("header")}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div
          className="relative"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const entry = displayEntries[virtualRow.index]!;
            const tableWidth =
              40 +
              columns.reduce(
                (sum, column) =>
                  sum + (widths[column.id] ?? column.defaultWidth),
                0,
              ) +
              80;
            return (
              <div
                key={
                  entry.kind === "group"
                    ? `group-${entry.group.id}`
                    : entry.row.id
                }
                data-index={virtualRow.index}
                className="absolute top-0 left-0"
                ref={virtualizer.measureElement}
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                {entry.kind === "group" ? (
                  <div
                    className="flex h-10 border-b bg-muted"
                    role="row"
                    style={{ width: tableWidth }}
                  >
                    <div className="h-10 w-full" role="cell">
                      <button
                        aria-expanded={!entry.group.collapsed}
                        aria-label={`${entry.group.label} ${entry.group.items.length}件`}
                        className="flex h-10 items-center gap-2 px-3 text-left text-sm font-medium"
                        type="button"
                        onClick={() => onToggleItemGroup(entry.group.id)}
                      >
                        {entry.group.collapsed ? (
                          <ChevronRight className="size-4" aria-hidden="true" />
                        ) : (
                          <ChevronDown className="size-4" aria-hidden="true" />
                        )}
                        <ItemTypeIcon
                          className="size-4"
                          color={entry.group.color}
                          icon={entry.group.icon}
                        />
                        {entry.group.label}
                        <Badge variant="outline">
                          {entry.group.items.length}
                        </Badge>
                      </button>
                    </div>
                  </div>
                ) : entityType === "timeline_item" ? (
                  <ItemRow
                    allTags={classification.data?.tags ?? []}
                    columns={columns}
                    frozenCount={frozenCount}
                    itemTypes={itemTypes}
                    dimmed={dimmedItemIds.has(entry.row.id)}
                    onOpen={() => onOpenItem?.(entry.row.id)}
                    onSelectedChange={(checked) =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (checked) next.add(entry.row.id);
                        else next.delete(entry.row.id);
                        return next;
                      })
                    }
                    projectId={projectId}
                    row={entry.row as TimelineItemSummary}
                    selected={selected.has(entry.row.id)}
                    widths={widths}
                    wrapped={wrapped}
                  />
                ) : (
                  <EventRow
                    allItems={items}
                    allTags={classification.data?.tags ?? []}
                    columns={columns}
                    eventTypes={classification.data?.eventTypes ?? []}
                    frozenCount={frozenCount}
                    dimmed={dimmedEventIds.has(entry.row.id)}
                    onOpen={() => onOpenEvent?.(entry.row.id, false)}
                    onSelectedChange={(checked) =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (checked) next.add(entry.row.id);
                        else next.delete(entry.row.id);
                        return next;
                      })
                    }
                    projectId={projectId}
                    row={entry.row as TimelineEventSummary}
                    selected={selected.has(entry.row.id)}
                    widths={widths}
                    wrapped={wrapped}
                  />
                )}
              </div>
            );
          })}
        </div>
        <button
          className="flex h-10 items-center gap-2 px-3 text-sm text-muted-foreground hover:bg-muted"
          type="button"
          onClick={addDraft}
        >
          <Plus className="size-4" aria-hidden="true" />
          新しい行
        </button>
        {(entityType === "timeline_item" ? draftItems : draftEvents).length ? (
          <div className="border-t bg-muted/20 p-3 text-sm">
            <p className="mb-2 font-medium">未保存の新しい行</p>
            {entityType === "timeline_item"
              ? draftItems.map((draft) => (
                  <div
                    key={draft.key}
                    className="mb-2 grid gap-2 rounded-md border bg-background p-2 md:grid-cols-6"
                  >
                    <Input
                      aria-label="新しい項目の名称"
                      placeholder="名称 *"
                      value={draft.values.title}
                      onChange={(event) =>
                        setDraftItems((rows) =>
                          rows.map((row) =>
                            row.key === draft.key
                              ? {
                                  ...row,
                                  values: {
                                    ...row.values,
                                    title: event.target.value,
                                  },
                                }
                              : row,
                          ),
                        )
                      }
                    />
                    <select
                      aria-label="新しい項目の形式"
                      className="h-9 rounded-md border px-2"
                      value={draft.values.temporalType}
                      onChange={(event) =>
                        setDraftItems((rows) =>
                          rows.map((row) =>
                            row.key === draft.key
                              ? {
                                  ...row,
                                  values: {
                                    ...row.values,
                                    temporalType: event.target.value as
                                      "range" | "point",
                                    endDateStatus:
                                      event.target.value === "point"
                                        ? null
                                        : "specified",
                                  },
                                }
                              : row,
                          ),
                        )
                      }
                    >
                      <option value="range">期間</option>
                      <option value="point">時点</option>
                    </select>
                    <Input
                      aria-label="新しい項目の開始・時点日"
                      placeholder="開始・時点日 *"
                      value={draft.startText}
                      onChange={(event) =>
                        setDraftItems((rows) =>
                          rows.map((row) =>
                            row.key === draft.key
                              ? { ...row, startText: event.target.value }
                              : row,
                          ),
                        )
                      }
                    />
                    <select
                      aria-label="新しい項目の終了状態"
                      className="h-9 rounded-md border px-2 disabled:bg-muted"
                      disabled={draft.values.temporalType === "point"}
                      value={draft.values.endDateStatus ?? ""}
                      onChange={(event) =>
                        setDraftItems((rows) =>
                          rows.map((row) =>
                            row.key === draft.key
                              ? {
                                  ...row,
                                  values: {
                                    ...row.values,
                                    endDateStatus: event.target.value as
                                      "specified" | "ongoing" | "unknown",
                                  },
                                }
                              : row,
                          ),
                        )
                      }
                    >
                      <option value="">終了状態 *</option>
                      <option value="specified">終了日指定</option>
                      <option value="ongoing">継続中</option>
                      <option value="unknown">終了日不明</option>
                    </select>
                    <Input
                      aria-label="新しい項目の終了日"
                      disabled={
                        draft.values.temporalType === "point" ||
                        draft.values.endDateStatus !== "specified"
                      }
                      placeholder="終了日"
                      value={draft.endText}
                      onChange={(event) =>
                        setDraftItems((rows) =>
                          rows.map((row) =>
                            row.key === draft.key
                              ? { ...row, endText: event.target.value }
                              : row,
                          ),
                        )
                      }
                    />
                    <Button
                      disabled={
                        draft.saving ||
                        !draft.values.title.trim() ||
                        !draft.startText ||
                        (draft.values.temporalType === "range" &&
                          (!draft.values.endDateStatus ||
                            (draft.values.endDateStatus === "specified" &&
                              !draft.endText)))
                      }
                      onClick={async () => {
                        const start = parseHistoricalDate(draft.startText);
                        const end = parseHistoricalDate(draft.endText);
                        if (!start) return;
                        setDraftItems((rows) =>
                          rows.map((row) =>
                            row.key === draft.key
                              ? { ...row, saving: true, error: "" }
                              : row,
                          ),
                        );
                        try {
                          await createTimelineItem(projectId, {
                            ...draft.values,
                            start:
                              draft.values.temporalType === "range"
                                ? start
                                : null,
                            point:
                              draft.values.temporalType === "point"
                                ? start
                                : null,
                            end:
                              draft.values.endDateStatus === "specified"
                                ? end
                                : null,
                          });
                          setDraftItems((rows) =>
                            rows.filter((row) => row.key !== draft.key),
                          );
                          await client.invalidateQueries({
                            queryKey: timelineItemKeys.list(projectId),
                          });
                        } catch (reason) {
                          setDraftItems((rows) =>
                            rows.map((row) =>
                              row.key === draft.key
                                ? {
                                    ...row,
                                    saving: false,
                                    error:
                                      reason instanceof Error
                                        ? reason.message
                                        : "作成できませんでした。",
                                  }
                                : row,
                            ),
                          );
                        }
                      }}
                    >
                      {draft.saving ? (
                        <LoaderCircle className="animate-spin" />
                      ) : (
                        <Plus />
                      )}
                      作成
                    </Button>
                    {draft.error ? (
                      <p className="text-destructive md:col-span-6">
                        {draft.error}
                      </p>
                    ) : null}
                  </div>
                ))
              : draftEvents.map((draft) => (
                  <div
                    key={draft.key}
                    className="mb-2 grid gap-2 rounded-md border bg-background p-2 md:grid-cols-4"
                  >
                    <Input
                      aria-label="新しいイベントの名称"
                      placeholder="名称 *"
                      value={draft.values.title}
                      onChange={(event) =>
                        setDraftEvents((rows) =>
                          rows.map((row) =>
                            row.key === draft.key
                              ? {
                                  ...row,
                                  values: {
                                    ...row.values,
                                    title: event.target.value,
                                  },
                                }
                              : row,
                          ),
                        )
                      }
                    />
                    <Input
                      aria-label="新しいイベントの日付"
                      placeholder="イベント日 *"
                      value={draft.dateText}
                      onChange={(event) =>
                        setDraftEvents((rows) =>
                          rows.map((row) =>
                            row.key === draft.key
                              ? { ...row, dateText: event.target.value }
                              : row,
                          ),
                        )
                      }
                    />
                    <select
                      aria-label="新しいイベントの親"
                      className="h-9 rounded-md border px-2"
                      value={draft.values.timelineItemIds[0] ?? ""}
                      onChange={(event) =>
                        setDraftEvents((rows) =>
                          rows.map((row) =>
                            row.key === draft.key
                              ? {
                                  ...row,
                                  values: {
                                    ...row.values,
                                    timelineItemIds: [event.target.value],
                                  },
                                }
                              : row,
                          ),
                        )
                      }
                    >
                      <option value="">親タイムライン *</option>
                      {items
                        .filter((item) => item.temporalType === "range")
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.title}
                          </option>
                        ))}
                    </select>
                    <Button
                      disabled={
                        draft.saving ||
                        !draft.values.title.trim() ||
                        !draft.dateText ||
                        !draft.values.timelineItemIds[0]
                      }
                      onClick={async () => {
                        const date = parseHistoricalDate(draft.dateText);
                        if (!date) return;
                        setDraftEvents((rows) =>
                          rows.map((row) =>
                            row.key === draft.key
                              ? { ...row, saving: true, error: "" }
                              : row,
                          ),
                        );
                        try {
                          await createTimelineEvent(projectId, {
                            ...draft.values,
                            date,
                          });
                          setDraftEvents((rows) =>
                            rows.filter((row) => row.key !== draft.key),
                          );
                          await client.invalidateQueries({
                            queryKey: timelineEventKeys.list(projectId),
                          });
                        } catch (reason) {
                          setDraftEvents((rows) =>
                            rows.map((row) =>
                              row.key === draft.key
                                ? {
                                    ...row,
                                    saving: false,
                                    error:
                                      reason instanceof Error
                                        ? reason.message
                                        : "作成できませんでした。",
                                  }
                                : row,
                            ),
                          );
                        }
                      }}
                    >
                      <Plus />
                      作成
                    </Button>
                    {draft.error ? (
                      <p className="text-destructive md:col-span-4">
                        {draft.error}
                      </p>
                    ) : null}
                  </div>
                ))}
          </div>
        ) : null}
      </div>
      <PropertyDialog
        entityType={entityType}
        open={propertyOpen}
        projectId={projectId}
        onOpenChange={setPropertyOpen}
      />
    </section>
  );
}
