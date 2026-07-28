import type { ProjectBackup } from "@/features/import-export/schema";
import {
  IMPORT_SCHEMA_VERSION,
  previewBackup,
  type ImportPreview,
} from "@/features/import-export/schema";
import { createStoredZip, readStoredZip } from "@/features/import-export/zip";
import {
  LEGACY_UNVERSIONED_SCHEMA_VERSION,
  unsupportedSchemaVersionMessage,
} from "@/lib/data-compatibility";

const BOM = "\uFEFF";
const PRIMARY_COLOR = "#00B0B0";
const CSV_VERSION_PREFIX = "# timeline-editor-schema-version=";
const CSV_MANIFEST_NAME = "manifest.json";
const README = `# Timeline Editor CSV

CSVスキーマバージョン: ${IMPORT_SCHEMA_VERSION}

各CSVの先頭行に \`${CSV_VERSION_PREFIX}${IMPORT_SCHEMA_VERSION}\` を記録する。旧形式はこの行がなくてもバージョン0として移行できる。

## 各CSVのカラム項目

### timeline-items.csv

- id: タイムラインアイテムID。新規作成する場合は空欄にするとインポート時に採番される。
- type_id: 対象種別。item-types.csv の id を指定する。
- type_name: 対象種別名。IDがない場合は必須。
- title: タイムラインアイテム名。必須。
- description: 本文。任意。
- source_text: 出典・参考文献。任意。
- external_url: 外部URL。任意。
- temporal_type: range（期間）または point（時点）。必須。
- color_override: 上書き色のカラーコード。任意。
- manual_order: 手動指定の表示順。必須。
- is_visible: 表示状態を TRUE/FALSE で指定。必須。
- start_year: 期間の開始年、または時点の日付の年。1以上。必須。
- start_month: 期間の開始月、または時点の日付の月。任意。
- start_day: 期間の開始日、または時点の日付の日。任意。月が空欄の場合は日も空欄。
- start_era/start_precision: ce/bce と day/month/year/decade/century。
- start_original_text/start_calendar: 原資料表記と暦法識別子。
- is_start_approximate: 期間開始日のあいまいフラグ。TRUE/FALSE。
- start_uncertainty_years: 期間開始日の不確かさ（年）。任意。
- end_date_status: 期間の終了状態。specified/ongoing/unknown。
- end_year: specified の終了年、または unknown の最終確認年。任意。
- end_month: specified の終了月、または unknown の最終確認月。任意。
- end_day: specified の終了日、または unknown の最終確認日。任意。月が空欄の場合は日も空欄。
- end_era/end_precision/end_original_text/end_calendar: 終了側の日付属性。
- is_end_approximate: 期間終了日のあいまいフラグ。TRUE/FALSE。
- end_uncertainty_years: 期間終了日の不確かさ（年）。任意。
- is_point_approximate: 時点の日付のあいまいフラグ。TRUE/FALSE。

### timeline-events.csv

- id: イベントID。新規作成する場合は空欄にするとインポート時に採番される。
- timeline_item_id: 親タイムラインアイテムID。
- timeline_item_title: 親タイムラインアイテムのタイトル。IDがない場合は必須。
- title: イベントのタイトル。必須。
- event_year: イベントの年。1以上。必須。
- event_month: イベントの月。任意。
- event_day: イベントの日。任意。月が空欄の場合は日も空欄。
- event_era/event_precision/event_original_text/event_calendar: イベント日付属性。
- is_approximate: 日付のあいまいフラグ。TRUE/FALSE。
- description: 説明本文。任意。
- source_text: 出典・参考文献。任意。
- external_url: 外部URL。任意。

### item-types.csv

- id: 対象種別ID。新規作成する場合は空欄にするとインポート時に採番される。
- name: 対象種別名。必須。
- default_color: デフォルト色のカラーコード（例: #33CCBB）。
- icon: アイコン。未指定、または user-round/brain/sparkles/newspaper/users-round/book-open/image/swords/landmark/gallery-horizontal/circle-dot。
- sort_order: 対象種別の並び順。
- is_visible: 表示状態を TRUE/FALSE で指定。
`;

function exportFileName(
  projectName: string,
  extension: "json" | "zip",
  date: Date,
) {
  const safeName =
    projectName
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
      .replace(/[. ]+$/g, "")
      .trim() || "project";
  return `${safeName}_${date.toISOString().slice(0, 10)}.${extension}`;
}

export function csvArchiveFileName(projectName: string, date = new Date()) {
  return exportFileName(projectName, "zip", date);
}

export function jsonExportFileName(projectName: string, date = new Date()) {
  return exportFileName(projectName, "json", date);
}

function cell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csv(headers: string[], rows: unknown[][]) {
  return (
    BOM +
    `${CSV_VERSION_PREFIX}${IMPORT_SCHEMA_VERSION}\r\n` +
    [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") +
    "\r\n"
  );
}

const dateCells = (
  date: ProjectBackup["timelineEvents"][number]["date"] | null,
) => [
  date?.year ?? "",
  date?.month ?? "",
  date?.day ?? "",
  date?.era ?? "",
  date?.precision ?? "",
  date?.originalText ?? "",
  date?.calendar ?? "",
];

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
      "aliases_json",
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
      "start_era",
      "start_precision",
      "start_original_text",
      "start_calendar",
      "is_start_approximate",
      "start_uncertainty_years",
      "end_date_status",
      "end_year",
      "end_month",
      "end_day",
      "end_era",
      "end_precision",
      "end_original_text",
      "end_calendar",
      "is_end_approximate",
      "end_uncertainty_years",
      "is_point_approximate",
    ],
    backup.timelineItems.map((item) => [
      item.id,
      item.typeId,
      backup.itemTypes.find((type) => type.id === item.typeId)?.name,
      item.title,
      JSON.stringify(item.aliases),
      item.description,
      item.sourceText,
      item.externalUrl,
      item.temporalType,
      item.colorOverride,
      item.manualOrder,
      item.isVisible,
      ...dateCells(item.temporalType === "point" ? item.point : item.start),
      item.isStartApproximate,
      item.startUncertaintyYears,
      item.endDateStatus,
      ...dateCells(
        item.endDateStatus === "unknown" ? item.lastConfirmed : item.end,
      ),
      item.isEndApproximate,
      item.endUncertaintyYears,
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
      "aliases_json",
      "event_year",
      "event_month",
      "event_day",
      "event_era",
      "event_precision",
      "event_original_text",
      "event_calendar",
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
      JSON.stringify(event.aliases),
      ...dateCells(event.date),
      event.isApproximate,
      event.description,
      event.sourceText,
      event.externalUrl,
    ]),
  );
  return createStoredZip([
    {
      name: CSV_MANIFEST_NAME,
      content: JSON.stringify(
        {
          format: "timeline-editor-csv",
          schemaVersion: IMPORT_SCHEMA_VERSION,
          appVersion: backup.appVersion,
          exportedAt: backup.exportedAt,
        },
        null,
        2,
      ),
    },
    { name: "timeline-items.csv", content: items },
    { name: "timeline-events.csv", content: events },
    { name: "item-types.csv", content: types },
    { name: "README.md", content: BOM + README.replaceAll("\n", "\r\n") },
  ]);
}

function parseCsv(text: string) {
  const normalizedText = text.replace(/^\uFEFF/, "");
  const firstLineEnd = normalizedText.search(/\r?\n/);
  const firstLine =
    firstLineEnd === -1
      ? normalizedText
      : normalizedText.slice(0, firstLineEnd);
  let schemaVersion: number = LEGACY_UNVERSIONED_SCHEMA_VERSION;
  let csvText = normalizedText;
  if (firstLine.startsWith(CSV_VERSION_PREFIX)) {
    const rawVersion = firstLine.slice(CSV_VERSION_PREFIX.length);
    schemaVersion = Number(rawVersion);
    if (!Number.isInteger(schemaVersion) || schemaVersion < 0) {
      throw new Error("CSVスキーマバージョンが不正です。");
    }
    csvText = firstLineEnd === -1 ? "" : normalizedText.slice(firstLineEnd + 1);
  }
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];
    if (quoted) {
      if (character === '"' && csvText[index + 1] === '"') {
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
  if (!headers) return { rows: [], schemaVersion };
  return {
    schemaVersion,
    rows: data.map((values) =>
      Object.fromEntries(
        headers.map((header, index) => [header, values[index] ?? ""]),
      ),
    ),
  };
}

const nullable = (value: string | undefined) => value?.trim() || null;
const parseAliases = (value: string | undefined) => {
  if (!value?.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((alias): alias is string => typeof alias === "string")
      : [];
  } catch {
    return [];
  }
};
const normalizedName = (value: string | undefined) =>
  value?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";
const number = (value: string | undefined) =>
  value?.trim() ? Number(value) : null;
const boolean = (value: string | undefined, fallback = false) =>
  value?.trim() ? value.toLowerCase() === "true" : fallback;
const date = (row: Record<string, string>, prefix: string) => {
  const year = number(row[`${prefix}_year`]);
  return year === null
    ? null
    : {
        era:
          row[`${prefix}_era`] === "bce" ? ("bce" as const) : ("ce" as const),
        precision: (row[`${prefix}_precision`] ||
          (row[`${prefix}_day`]
            ? "day"
            : row[`${prefix}_month`]
              ? "month"
              : "year")) as "day" | "month" | "year" | "decade" | "century",
        year,
        month: number(row[`${prefix}_month`]),
        day: number(row[`${prefix}_day`]),
        originalText: nullable(row[`${prefix}_original_text`]),
        calendar: row[`${prefix}_calendar`] || "proleptic_gregorian",
      };
};

const CSV_NAMES = [
  "item-types.csv",
  "timeline-items.csv",
  "timeline-events.csv",
] as const;

type CsvName = (typeof CSV_NAMES)[number];

export function parseCsvImport(
  input: Uint8Array,
  fileName: string,
  base: ProjectBackup,
): ImportPreview {
  const errors: string[] = [];
  const warnings: string[] = [];
  let files: Map<string, string>;
  const normalizedFileName = fileName.split(/[\\/]/).at(-1) ?? fileName;
  if (normalizedFileName.endsWith(".zip")) {
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
    for (const name of CSV_NAMES)
      if (!files.has(name)) errors.push(`${name} がありません。`);
  } else if ((CSV_NAMES as readonly string[]).includes(normalizedFileName)) {
    files = new Map([[normalizedFileName, new TextDecoder().decode(input)]]);
  } else {
    return {
      sourceProjectId: null,
      sourceProjectName: base.project.name,
      itemTypeCount: 0,
      timelineItemCount: 0,
      timelineEventCount: 0,
      errors: [
        "ファイル名は item-types.csv、timeline-items.csv、timeline-events.csv のいずれかにしてください。",
      ],
      warnings: [],
    };
  }
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
    const sections = CSV_NAMES.filter((name) => files.has(name));
    const documents = new Map(
      sections.map((name) => [name, parseCsv(files.get(name)!)]),
    );
    let manifestVersion: number | null = null;
    if (files.has(CSV_MANIFEST_NAME)) {
      const manifest = JSON.parse(files.get(CSV_MANIFEST_NAME)!) as {
        format?: unknown;
        schemaVersion?: unknown;
      };
      if (
        manifest.format !== "timeline-editor-csv" ||
        !Number.isInteger(manifest.schemaVersion)
      ) {
        throw new Error("CSV manifestが不正です。");
      }
      manifestVersion = manifest.schemaVersion as number;
    }
    const declaredVersions = new Set(
      [...documents.values()].map((document) => document.schemaVersion),
    );
    if (declaredVersions.size > 1) {
      throw new Error("CSVファイル間でスキーマバージョンが一致しません。");
    }
    const fileVersion =
      declaredVersions.values().next().value ??
      LEGACY_UNVERSIONED_SCHEMA_VERSION;
    if (manifestVersion !== null && manifestVersion !== fileVersion) {
      throw new Error(
        "CSV manifestとCSVファイルのスキーマバージョンが一致しません。",
      );
    }
    const schemaVersion = manifestVersion ?? fileVersion;
    if (schemaVersion > IMPORT_SCHEMA_VERSION) {
      throw new Error(unsupportedSchemaVersionMessage("csv", schemaVersion));
    }
    if (schemaVersion < LEGACY_UNVERSIONED_SCHEMA_VERSION) {
      throw new Error("CSVスキーマバージョンが不正です。");
    }
    if (schemaVersion === LEGACY_UNVERSIONED_SCHEMA_VERSION) {
      warnings.push("旧CSV形式をスキーマバージョン3へ移行しました。");
    } else if (schemaVersion === 1) {
      warnings.push("CSVスキーマバージョン1をバージョン3へ移行しました。");
    } else if (schemaVersion === 2) {
      warnings.push("CSVスキーマバージョン2をバージョン3へ移行しました。");
    } else if (schemaVersion !== IMPORT_SCHEMA_VERSION) {
      throw new Error(
        `CSVスキーマバージョン${schemaVersion}の移行処理がありません。`,
      );
    }
    const rawTypes = documents.get("item-types.csv")?.rows ?? [];
    const rawItems = documents.get("timeline-items.csv")?.rows ?? [];
    const rawEvents = documents.get("timeline-events.csv")?.rows ?? [];
    const originalTypeIds = new Map<string, string>();
    const typeIdsByName = new Map(
      base.itemTypes.map((type) => [normalizedName(type.name), type.id]),
    );
    for (const type of base.itemTypes) originalTypeIds.set(type.id, type.id);
    const itemTypes = rawTypes.map((row, index) => {
      const id = row.id || crypto.randomUUID();
      if (row.id) originalTypeIds.set(row.id, id);
      typeIdsByName.set(normalizedName(row.name), id);
      return {
        id,
        name: row.name,
        defaultColor: row.default_color,
        icon: nullable(row.icon),
        sortOrder: number(row.sort_order) ?? index,
        isVisible: boolean(row.is_visible, true),
      };
    });
    let nextTypeSortOrder =
      Math.max(
        -1,
        ...base.itemTypes.map((type) => type.sortOrder),
        ...itemTypes.map((type) => type.sortOrder),
      ) + 1;
    let createdTimelineItemCount = 0;
    let createdItemTypeCount = 0;
    const originalItemIds = new Map<string, string>();
    const titleIds = new Map<string, string[]>();
    for (const item of base.timelineItems) {
      originalItemIds.set(item.id, item.id);
      titleIds.set(item.title, [...(titleIds.get(item.title) ?? []), item.id]);
    }
    const timelineItems = rawItems.map((row, index) => {
      const id = row.id || crypto.randomUUID();
      if (!row.id) createdTimelineItemCount += 1;
      else originalItemIds.set(row.id, id);
      if (!base.timelineItems.some((item) => item.id === id))
        titleIds.set(row.title, [...(titleIds.get(row.title) ?? []), id]);
      const typeName = normalizedName(row.type_name);
      let typeId =
        originalTypeIds.get(row.type_id) ?? typeIdsByName.get(typeName);
      if (!typeId && !row.type_id && typeName) {
        typeId = crypto.randomUUID();
        itemTypes.push({
          id: typeId,
          name: row.type_name.trim(),
          defaultColor: PRIMARY_COLOR,
          icon: null,
          sortOrder: nextTypeSortOrder,
          isVisible: true,
        });
        nextTypeSortOrder += 1;
        createdItemTypeCount += 1;
        typeIdsByName.set(typeName, typeId);
      }
      return {
        id,
        typeId: typeId ?? row.type_id,
        title: row.title,
        aliases: parseAliases(row.aliases_json),
        description: nullable(row.description),
        sourceText: nullable(row.source_text),
        externalUrl: nullable(row.external_url),
        temporalType: row.temporal_type as "range" | "point",
        colorOverride: nullable(row.color_override),
        manualOrder: number(row.manual_order) ?? index,
        isVisible: boolean(row.is_visible, true),
        start: row.temporal_type === "point" ? null : date(row, "start"),
        isStartApproximate: boolean(row.is_start_approximate),
        startUncertaintyYears: number(row.start_uncertainty_years),
        endDateStatus: nullable(row.end_date_status) as
          "specified" | "ongoing" | "unknown" | null,
        end: row.end_date_status === "specified" ? date(row, "end") : null,
        isEndApproximate: boolean(row.is_end_approximate),
        endUncertaintyYears: number(row.end_uncertainty_years),
        lastConfirmed:
          row.end_date_status === "unknown" ? date(row, "end") : null,
        point: row.temporal_type === "point" ? date(row, "start") : null,
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
      return [
        {
          id,
          timelineItemId: parent,
          title: row.title,
          aliases: parseAliases(row.aliases_json),
          date: {
            era: row.event_era === "bce" ? "bce" : "ce",
            precision: (row.event_precision ||
              (row.event_day ? "day" : row.event_month ? "month" : "year")) as
              "day" | "month" | "year" | "decade" | "century",
            year: number(row.event_year) ?? 0,
            month: number(row.event_month),
            day: number(row.event_day),
            originalText: nullable(row.event_original_text),
            calendar: row.event_calendar || "proleptic_gregorian",
          },
          isApproximate: boolean(row.is_approximate),
          description: nullable(row.description),
          sourceText: nullable(row.source_text),
          externalUrl: nullable(row.external_url),
        },
      ];
    });
    if (createdTimelineItemCount > 0)
      warnings.push(
        `${createdTimelineItemCount}件のタイムライン項目を新規作成しました。`,
      );
    if (createdItemTypeCount > 0)
      warnings.push(`${createdItemTypeCount}件の対象種別を新規作成しました`);
    const importSections = sections.map(
      (name: CsvName) =>
        ({
          "item-types.csv": "itemTypes",
          "timeline-items.csv": "timelineItems",
          "timeline-events.csv": "timelineEvents",
        })[name],
    );
    if (createdItemTypeCount > 0 && !importSections.includes("itemTypes"))
      importSections.unshift("itemTypes");
    const preview = previewBackup({
      schemaVersion: IMPORT_SCHEMA_VERSION,
      appVersion: base.appVersion,
      exportedAt: new Date().toISOString(),
      project: base.project,
      settings: base.settings,
      itemTypes,
      timelineItems,
      timelineEvents,
      importSections,
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
