import type {
  CustomFieldDefinition,
  CustomFieldEntry,
} from "@/features/classification/types";
import type { TimelineEvent } from "@/features/timeline-events/types";
import type { TimelineEventInput } from "@/features/timeline-events/validation";
import type {
  HistoricalDate,
  TimelineItem,
} from "@/features/timeline-items/types";
import type { TimelineItemInput } from "@/features/timeline-items/validation";

export type TableEntityType = "timeline_item" | "timeline_event";
export type TableColumn = {
  id: string;
  label: string;
  kind:
    | "title"
    | "date"
    | "status"
    | "temporalType"
    | "type"
    | "parents"
    | "tags"
    | "boolean"
    | "color"
    | "url"
    | "custom";
  customField?: CustomFieldDefinition;
  defaultWidth: number;
};

const ITEM_COLUMNS: TableColumn[] = [
  { id: "title", label: "名称", kind: "title", defaultWidth: 280 },
  {
    id: "temporalType",
    label: "形式",
    kind: "temporalType",
    defaultWidth: 110,
  },
  {
    id: "start",
    label: "開始・時点日",
    kind: "date",
    defaultWidth: 150,
  },
  { id: "end", label: "終了日", kind: "date", defaultWidth: 150 },
  {
    id: "endDateStatus",
    label: "終了状態",
    kind: "status",
    defaultWidth: 130,
  },
  {
    id: "typeId",
    label: "タイムライン種別",
    kind: "type",
    defaultWidth: 170,
  },
  { id: "tags", label: "タグ", kind: "tags", defaultWidth: 180 },
  {
    id: "isVisible",
    label: "表示",
    kind: "boolean",
    defaultWidth: 90,
  },
  { id: "colorOverride", label: "個別色", kind: "color", defaultWidth: 120 },
  { id: "externalUrl", label: "外部URL", kind: "url", defaultWidth: 220 },
];

const EVENT_COLUMNS: TableColumn[] = [
  { id: "title", label: "名称", kind: "title", defaultWidth: 280 },
  { id: "date", label: "イベント日", kind: "date", defaultWidth: 150 },
  {
    id: "parents",
    label: "親タイムライン",
    kind: "parents",
    defaultWidth: 220,
  },
  { id: "eventTypeId", label: "イベント種別", kind: "type", defaultWidth: 170 },
  { id: "tags", label: "タグ", kind: "tags", defaultWidth: 180 },
  { id: "externalUrl", label: "外部URL", kind: "url", defaultWidth: 220 },
];

export function buildTableColumns(
  entityType: TableEntityType,
  definitions: CustomFieldDefinition[],
) {
  const builtIn = entityType === "timeline_item" ? ITEM_COLUMNS : EVENT_COLUMNS;
  return [
    ...builtIn,
    ...definitions
      .filter((field) => field.entityType === entityType)
      .map<TableColumn>((customField) => ({
        id: `custom:${customField.id}`,
        label: customField.name,
        kind: "custom",
        customField,
        defaultWidth: customField.fieldType === "multiline" ? 260 : 180,
      })),
  ];
}

export function formatHistoricalDate(value: HistoricalDate | null) {
  if (!value) return "";
  const prefix = value.era === "bce" ? "紀元前" : "";
  const month =
    value.month === null ? "" : `-${String(value.month).padStart(2, "0")}`;
  const day =
    value.day === null ? "" : `-${String(value.day).padStart(2, "0")}`;
  return `${prefix}${value.year}${month}${day}`;
}

export function parseHistoricalDate(value: string): HistoricalDate | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const match = /^(紀元前|BCE\s*)?(\d+)(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/i.exec(
    normalized,
  );
  if (!match) return null;
  const year = Number(match[2]);
  const month = match[3] ? Number(match[3]) : null;
  const day = match[4] ? Number(match[4]) : null;
  if (
    year < 1 ||
    (month !== null && (month < 1 || month > 12)) ||
    (day !== null && (day < 1 || day > 31)) ||
    (day !== null && month === null)
  )
    return null;
  return {
    era: match[1] ? "bce" : "ce",
    precision: day !== null ? "day" : month !== null ? "month" : "year",
    year,
    month,
    day,
    originalText: null,
    calendar: "proleptic_gregorian",
  };
}

export function itemToInput(item: TimelineItem): TimelineItemInput {
  return {
    typeId: item.typeId,
    title: item.title,
    aliases: item.aliases,
    tagIds: item.tags?.map((tag) => tag.id) ?? [],
    customFields: item.customFields ?? [],
    addPreviousTitleToAliases: false,
    description: item.description ?? "",
    sourceText: item.sourceText ?? "",
    citations: item.citations ?? [],
    externalUrl: item.externalUrl ?? "",
    temporalType: item.temporalType,
    colorOverride: item.colorOverride,
    isVisible: item.isVisible,
    start: item.start,
    isStartApproximate: item.isStartApproximate,
    endDateStatus: item.endDateStatus,
    end: item.end,
    isEndApproximate: item.isEndApproximate,
    lastConfirmed: item.lastConfirmed,
    point: item.point,
    isPointApproximate: item.isPointApproximate,
  };
}

export function eventToInput(event: TimelineEvent): TimelineEventInput {
  return {
    timelineItemIds: event.timelineItemIds,
    eventTypeId: event.eventTypeId ?? null,
    tagIds: event.tags?.map((tag) => tag.id) ?? [],
    customFields: event.customFields ?? [],
    title: event.title,
    aliases: event.aliases,
    addPreviousTitleToAliases: false,
    date: event.date,
    isApproximate: event.isApproximate,
    description: event.description ?? "",
    sourceText: event.sourceText ?? "",
    citations: event.citations ?? [],
    externalUrl: event.externalUrl ?? "",
  };
}

export function setCustomFieldValue(
  entries: CustomFieldEntry[],
  fieldId: string,
  value: CustomFieldEntry["value"] | null,
) {
  const remaining = entries.filter((entry) => entry.fieldId !== fieldId);
  return value === null || value === ""
    ? remaining
    : [...remaining, { fieldId, value }];
}

export function escapeCsvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
