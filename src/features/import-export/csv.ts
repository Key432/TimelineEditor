import type { ProjectBackup } from "@/features/import-export/schema";
import {
  previewBackup,
  type ImportPreview,
} from "@/features/import-export/schema";
import { createStoredZip, readStoredZip } from "@/features/import-export/zip";

const BOM = "\uFEFF";
const README = `Timeline Editor CSV backup\r\n\r\nUTF-8 BOM付きCSVです。IDを空欄にするとインポート時に新しいIDを生成します。\r\nイベントの親は timeline_item_id を優先し、空欄の場合は timeline_item_title で照合します。同名の親が複数ある場合はエラーです。\r\n日付は西暦1年以降で、月が空欄の場合は日も空欄にしてください。\r\n`;

function cell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csv(headers: string[], rows: unknown[][]) {
  return (
    BOM +
    [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") +
    "\r\n"
  );
}

const dateCells = (
  date: { year: number; month: number | null; day: number | null } | null,
) => [date?.year ?? "", date?.month ?? "", date?.day ?? ""];

export function createCsvArchive(backup: ProjectBackup) {
  const types = csv(
    ["id", "name", "default_color", "icon", "sort_order", "is_visible"],
    backup.itemTypes.map((type) => [
      type.id,
      type.name,
      type.defaultColor,
      type.icon,
      type.sortOrder,
      type.isVisible,
    ]),
  );
  const items = csv(
    [
      "id",
      "type_id",
      "type_name",
      "title",
      "description",
      "source_text",
      "external_url",
      "temporal_type",
      "color_override",
      "manual_order",
      "is_visible",
      "start_year",
      "start_month",
      "start_day",
      "is_start_approximate",
      "start_uncertainty_years",
      "end_date_status",
      "end_year",
      "end_month",
      "end_day",
      "is_end_approximate",
      "end_uncertainty_years",
      "last_confirmed_year",
      "last_confirmed_month",
      "last_confirmed_day",
      "point_year",
      "point_month",
      "point_day",
      "is_point_approximate",
    ],
    backup.timelineItems.map((item) => [
      item.id,
      item.typeId,
      backup.itemTypes.find((type) => type.id === item.typeId)?.name,
      item.title,
      item.description,
      item.sourceText,
      item.externalUrl,
      item.temporalType,
      item.colorOverride,
      item.manualOrder,
      item.isVisible,
      ...dateCells(item.start),
      item.isStartApproximate,
      item.startUncertaintyYears,
      item.endDateStatus,
      ...dateCells(item.end),
      item.isEndApproximate,
      item.endUncertaintyYears,
      ...dateCells(item.lastConfirmed),
      ...dateCells(item.point),
      item.isPointApproximate,
    ]),
  );
  const titleById = new Map(
    backup.timelineItems.map((item) => [item.id, item.title]),
  );
  const events = csv(
    [
      "id",
      "timeline_item_id",
      "timeline_item_title",
      "title",
      "event_year",
      "event_month",
      "event_day",
      "is_approximate",
      "description",
      "source_text",
      "external_url",
    ],
    backup.timelineEvents.map((event) => [
      event.id,
      event.timelineItemId,
      titleById.get(event.timelineItemId),
      event.title,
      event.date.year,
      event.date.month,
      event.date.day,
      event.isApproximate,
      event.description,
      event.sourceText,
      event.externalUrl,
    ]),
  );
  return createStoredZip([
    { name: "timeline-items.csv", content: items },
    { name: "timeline-events.csv", content: events },
    { name: "item-types.csv", content: types },
    { name: "README.txt", content: BOM + README },
  ]);
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else value += character;
    } else if (character === '"' && value.length === 0) quoted = true;
    else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else value += character;
  }
  if (quoted) throw new Error("閉じられていない引用符があります。");
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  const [headers, ...data] = rows.filter((entry) => entry.some(Boolean));
  if (!headers) return [];
  return data.map((values) =>
    Object.fromEntries(
      headers.map((header, index) => [
        header.replace(/^\uFEFF/, ""),
        values[index] ?? "",
      ]),
    ),
  );
}

const nullable = (value: string | undefined) => value?.trim() || null;
const number = (value: string | undefined) =>
  value?.trim() ? Number(value) : null;
const boolean = (value: string | undefined, fallback = false) =>
  value?.trim() ? value.toLowerCase() === "true" : fallback;
const date = (row: Record<string, string>, prefix: string) => {
  const year = number(row[`${prefix}_year`]);
  return year === null
    ? null
    : {
        year,
        month: number(row[`${prefix}_month`]),
        day: number(row[`${prefix}_day`]),
      };
};

export function parseCsvArchive(
  input: Uint8Array,
  base: Pick<ProjectBackup, "project" | "settings" | "appVersion">,
): ImportPreview {
  const errors: string[] = [];
  const warnings: string[] = [];
  let files: Map<string, string>;
  try {
    files = readStoredZip(input);
  } catch (error) {
    return {
      sourceProjectId: null,
      sourceProjectName: base.project.name,
      itemTypeCount: 0,
      timelineItemCount: 0,
      timelineEventCount: 0,
      errors: [
        error instanceof Error ? error.message : "ZIPを読み取れません。",
      ],
      warnings: [],
    };
  }
  const required = [
    "item-types.csv",
    "timeline-items.csv",
    "timeline-events.csv",
  ];
  for (const name of required)
    if (!files.has(name)) errors.push(`${name} がありません。`);
  if (errors.length)
    return {
      sourceProjectId: null,
      sourceProjectName: base.project.name,
      itemTypeCount: 0,
      timelineItemCount: 0,
      timelineEventCount: 0,
      errors,
      warnings,
    };
  try {
    const rawTypes = parseCsv(files.get("item-types.csv")!);
    const rawItems = parseCsv(files.get("timeline-items.csv")!);
    const rawEvents = parseCsv(files.get("timeline-events.csv")!);
    const originalTypeIds = new Map<string, string>();
    const typeIdsByName = new Map<string, string>();
    const itemTypes = rawTypes.map((row, index) => {
      const id = row.id || crypto.randomUUID();
      if (!row.id)
        warnings.push(`item-types.csv ${index + 2}行: IDを生成しました。`);
      else originalTypeIds.set(row.id, id);
      typeIdsByName.set(row.name.trim().toLowerCase(), id);
      return {
        id,
        name: row.name,
        defaultColor: row.default_color,
        icon: nullable(row.icon),
        sortOrder: number(row.sort_order) ?? index,
        isVisible: boolean(row.is_visible, true),
      };
    });
    const originalItemIds = new Map<string, string>();
    const titleIds = new Map<string, string[]>();
    const timelineItems = rawItems.map((row, index) => {
      const id = row.id || crypto.randomUUID();
      if (!row.id)
        warnings.push(`timeline-items.csv ${index + 2}行: IDを生成しました。`);
      else originalItemIds.set(row.id, id);
      titleIds.set(row.title, [...(titleIds.get(row.title) ?? []), id]);
      return {
        id,
        typeId:
          originalTypeIds.get(row.type_id) ??
          typeIdsByName.get(row.type_name.trim().toLowerCase()) ??
          row.type_id,
        title: row.title,
        description: nullable(row.description),
        sourceText: nullable(row.source_text),
        externalUrl: nullable(row.external_url),
        temporalType: row.temporal_type as "range" | "point",
        colorOverride: nullable(row.color_override),
        manualOrder: number(row.manual_order) ?? index,
        isVisible: boolean(row.is_visible, true),
        start: date(row, "start"),
        isStartApproximate: boolean(row.is_start_approximate),
        startUncertaintyYears: number(row.start_uncertainty_years),
        endDateStatus: nullable(row.end_date_status) as
          "specified" | "ongoing" | "unknown" | null,
        end: date(row, "end"),
        isEndApproximate: boolean(row.is_end_approximate),
        endUncertaintyYears: number(row.end_uncertainty_years),
        lastConfirmed: date(row, "last_confirmed"),
        point: date(row, "point"),
        isPointApproximate: boolean(row.is_point_approximate),
      };
    });
    const timelineEvents = rawEvents.flatMap((row, index) => {
      let parent = row.timeline_item_id
        ? originalItemIds.get(row.timeline_item_id)
        : undefined;
      if (!parent && row.timeline_item_title) {
        const candidates = titleIds.get(row.timeline_item_title) ?? [];
        if (candidates.length === 1) parent = candidates[0];
        else
          errors.push(
            `timeline-events.csv ${index + 2}行: 親タイトル「${row.timeline_item_title}」を一意に照合できません。`,
          );
      }
      if (!parent) {
        errors.push(
          `timeline-events.csv ${index + 2}行: 親項目が見つかりません。`,
        );
        return [];
      }
      const id = row.id || crypto.randomUUID();
      if (!row.id)
        warnings.push(`timeline-events.csv ${index + 2}行: IDを生成しました。`);
      return [
        {
          id,
          timelineItemId: parent,
          title: row.title,
          date: {
            year: number(row.event_year) ?? 0,
            month: number(row.event_month),
            day: number(row.event_day),
          },
          isApproximate: boolean(row.is_approximate),
          description: nullable(row.description),
          sourceText: nullable(row.source_text),
          externalUrl: nullable(row.external_url),
        },
      ];
    });
    const preview = previewBackup({
      schemaVersion: 1,
      appVersion: base.appVersion,
      exportedAt: new Date().toISOString(),
      project: base.project,
      settings: base.settings,
      itemTypes,
      timelineItems,
      timelineEvents,
    });
    return {
      ...preview,
      errors: [...errors, ...preview.errors],
      warnings: [...warnings, ...preview.warnings],
    };
  } catch (error) {
    return {
      sourceProjectId: null,
      sourceProjectName: base.project.name,
      itemTypeCount: 0,
      timelineItemCount: 0,
      timelineEventCount: 0,
      errors: [
        error instanceof Error ? error.message : "CSVを読み取れません。",
      ],
      warnings,
    };
  }
}
