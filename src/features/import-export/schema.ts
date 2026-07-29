import { z } from "zod";

import { timelineEventSchema } from "@/features/timeline-events/validation";
import { timelineItemSchema } from "@/features/timeline-items/validation";
import {
  DATA_COMPATIBILITY_BASELINE,
  LEGACY_UNVERSIONED_SCHEMA_VERSION,
  unsupportedSchemaVersionMessage,
} from "@/lib/data-compatibility";
import { customFieldEntrySchema } from "@/features/classification/validation";
import {
  CUSTOM_FIELD_TYPES,
  MARKER_SHAPES,
} from "@/features/classification/types";

export const IMPORT_SCHEMA_VERSION = DATA_COMPATIBILITY_BASELINE.json.version;
export const importSectionSchema = z.enum([
  "itemTypes",
  "timelineItems",
  "timelineEvents",
  "classification",
]);

const nullableString = z.string().nullable();
const historicalDate = z
  .object({
    era: z.enum(["ce", "bce"]),
    precision: z.enum(["day", "month", "year", "decade", "century"]),
    year: z.number().int(),
    month: z.number().int().nullable(),
    day: z.number().int().nullable(),
    originalText: z.string().max(200).nullable(),
    calendar: z.string().min(1).max(50),
  })
  .nullable();

const itemTypeSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(50),
  defaultColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  icon: nullableString,
  sortOrder: z.number().int().min(0),
  isVisible: z.boolean(),
});

const itemSchema = z.object({
  id: z.uuid(),
  typeId: z.uuid(),
  title: z.string(),
  aliases: z.array(z.string().trim().min(1).max(200)).max(20),
  tagIds: z.array(z.uuid()).max(100).default([]),
  customFields: z.array(customFieldEntrySchema).max(100).default([]),
  description: nullableString,
  sourceText: nullableString,
  externalUrl: nullableString,
  temporalType: z.enum(["range", "point"]),
  colorOverride: nullableString,
  manualOrder: z.number().int().min(0),
  isVisible: z.boolean(),
  start: historicalDate,
  isStartApproximate: z.boolean(),
  startUncertaintyYears: z.number().int().min(0).nullable(),
  endDateStatus: z.enum(["specified", "ongoing", "unknown"]).nullable(),
  end: historicalDate,
  isEndApproximate: z.boolean(),
  endUncertaintyYears: z.number().int().min(0).nullable(),
  lastConfirmed: historicalDate,
  point: historicalDate,
  isPointApproximate: z.boolean(),
});

const eventSchema = z.object({
  id: z.uuid(),
  timelineItemId: z.uuid(),
  title: z.string(),
  aliases: z.array(z.string().trim().min(1).max(200)).max(20),
  eventTypeId: z.uuid().nullable().default(null),
  tagIds: z.array(z.uuid()).max(100).default([]),
  customFields: z.array(customFieldEntrySchema).max(100).default([]),
  date: historicalDate.unwrap(),
  isApproximate: z.boolean(),
  description: nullableString,
  sourceText: nullableString,
  externalUrl: nullableString,
});

export const projectBackupSchema = z
  .object({
    schemaVersion: z.literal(IMPORT_SCHEMA_VERSION),
    appVersion: z.string().min(1),
    exportedAt: z.iso.datetime(),
    project: z.object({
      id: z.uuid(),
      name: z.string().trim().min(1).max(200),
      description: nullableString,
      visibility: z.enum(["private", "public"]),
      publicId: nullableString,
      publishedAt: nullableString,
    }),
    settings: z.object({
      defaultUncertaintyYears: z.number().int().min(0).max(1000),
      initialStartYear: z.number().int().min(1),
      initialEndYear: z.number().int().min(1),
      initialZoomPreset: z.enum(["fit-range", "century", "decade", "year"]),
      timelineDensity: z.enum(["comfortable", "compact"]),
      minimumTimeUnit: z.enum(["year", "month", "day"]),
    }),
    itemTypes: z.array(itemTypeSchema).max(1000),
    tags: z
      .array(
        z.object({
          id: z.uuid(),
          name: z.string().trim().min(1).max(100),
          color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
          description: nullableString,
        }),
      )
      .max(1000)
      .default([]),
    eventTypes: z
      .array(
        z.object({
          id: z.uuid(),
          name: z.string().trim().min(1).max(100),
          color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
          markerShape: z.enum(MARKER_SHAPES),
          description: nullableString,
          sortOrder: z.number().int().min(0),
        }),
      )
      .max(1000)
      .default([]),
    customFields: z
      .array(
        z.object({
          id: z.uuid(),
          entityType: z.enum(["timeline_item", "timeline_event"]),
          scope: z.enum(["project", "type"]),
          targetTypeId: z.uuid().nullable(),
          name: z.string().trim().min(1).max(100),
          fieldType: z.enum(CUSTOM_FIELD_TYPES),
          isRequired: z.boolean(),
          options: z.array(z.string().trim().min(1).max(100)).max(100),
          description: nullableString,
          sortOrder: z.number().int().min(0),
        }),
      )
      .max(1000)
      .default([]),
    timelineItems: z.array(itemSchema).max(5000),
    timelineEvents: z.array(eventSchema).max(50000),
    importSections: z.array(importSectionSchema).min(1).optional(),
  })
  .superRefine((backup, context) => {
    if (backup.settings.initialEndYear < backup.settings.initialStartYear) {
      context.addIssue({
        code: "custom",
        path: ["settings", "initialEndYear"],
        message: "初期表示終了年は開始年以降にしてください。",
      });
    }
    const typeIds = new Set(backup.itemTypes.map((type) => type.id));
    const itemIds = new Set(backup.timelineItems.map((item) => item.id));
    const eventIds = new Set(backup.timelineEvents.map((event) => event.id));
    const tagIds = new Set(backup.tags.map((tag) => tag.id));
    const eventTypeIds = new Set(backup.eventTypes.map((type) => type.id));
    const fields = new Map(
      backup.customFields.map((field) => [field.id, field]),
    );
    const validatesTypes =
      !backup.importSections || backup.importSections.includes("itemTypes");
    const validatesItems =
      !backup.importSections || backup.importSections.includes("timelineItems");
    const validatesClassification =
      !backup.importSections ||
      backup.importSections.includes("classification");
    for (const [index, field] of backup.customFields.entries())
      if (
        field.scope === "type" &&
        !(field.entityType === "timeline_item" ? typeIds : eventTypeIds).has(
          field.targetTypeId!,
        )
      )
        context.addIssue({
          code: "custom",
          path: ["customFields", index, "targetTypeId"],
          message: "カスタムフィールドの対象種別が見つかりません。",
        });
    for (const [index, item] of backup.timelineItems.entries()) {
      if (validatesTypes && !typeIds.has(item.typeId))
        context.addIssue({
          code: "custom",
          path: ["timelineItems", index, "typeId"],
          message: "対象種別が見つかりません。",
        });
      const parsed = timelineItemSchema.safeParse(item);
      if (!parsed.success)
        context.addIssue({
          code: "custom",
          path: ["timelineItems", index],
          message: parsed.error.issues[0]?.message ?? "項目が不正です。",
        });
      if (validatesClassification && item.tagIds.some((id) => !tagIds.has(id)))
        context.addIssue({
          code: "custom",
          path: ["timelineItems", index, "tagIds"],
          message: "タグが見つかりません。",
        });
      for (const entry of item.customFields) {
        const field = fields.get(entry.fieldId);
        if (
          validatesClassification &&
          (!field || field.entityType !== "timeline_item")
        )
          context.addIssue({
            code: "custom",
            path: ["timelineItems", index, "customFields"],
            message: "カスタムフィールドが見つかりません。",
          });
        if (
          typeof entry.value === "object" &&
          !Array.isArray(entry.value) &&
          "entityId" in entry.value &&
          !(
            entry.value.entityType === "timeline_item" ? itemIds : eventIds
          ).has(entry.value.entityId)
        )
          context.addIssue({
            code: "custom",
            path: ["timelineItems", index, "customFields"],
            message: "参照先が見つかりません。",
          });
      }
    }
    for (const [index, event] of backup.timelineEvents.entries()) {
      if (validatesItems && !itemIds.has(event.timelineItemId))
        context.addIssue({
          code: "custom",
          path: ["timelineEvents", index, "timelineItemId"],
          message: "親項目が見つかりません。",
        });
      const parsed = timelineEventSchema.safeParse(event);
      if (!parsed.success)
        context.addIssue({
          code: "custom",
          path: ["timelineEvents", index],
          message: parsed.error.issues[0]?.message ?? "イベントが不正です。",
        });
      if (
        validatesClassification &&
        event.eventTypeId &&
        !eventTypeIds.has(event.eventTypeId)
      )
        context.addIssue({
          code: "custom",
          path: ["timelineEvents", index, "eventTypeId"],
          message: "イベント種別が見つかりません。",
        });
      if (validatesClassification && event.tagIds.some((id) => !tagIds.has(id)))
        context.addIssue({
          code: "custom",
          path: ["timelineEvents", index, "tagIds"],
          message: "タグが見つかりません。",
        });
      for (const entry of event.customFields) {
        const field = fields.get(entry.fieldId);
        if (
          validatesClassification &&
          (!field || field.entityType !== "timeline_event")
        )
          context.addIssue({
            code: "custom",
            path: ["timelineEvents", index, "customFields"],
            message: "カスタムフィールドが見つかりません。",
          });
        if (
          typeof entry.value === "object" &&
          !Array.isArray(entry.value) &&
          "entityId" in entry.value &&
          !(
            entry.value.entityType === "timeline_item" ? itemIds : eventIds
          ).has(entry.value.entityId)
        )
          context.addIssue({
            code: "custom",
            path: ["timelineEvents", index, "customFields"],
            message: "参照先が見つかりません。",
          });
      }
    }
  });

export type ProjectBackup = z.output<typeof projectBackupSchema>;
export type ImportMode = "create" | "duplicate" | "overwrite" | "append";

export type ImportPreview = {
  sourceProjectId: string | null;
  sourceProjectName: string;
  itemTypeCount: number;
  timelineItemCount: number;
  timelineEventCount: number;
  errors: string[];
  warnings: string[];
  payload?: ProjectBackup;
};

type ImportMigration = (
  input: Record<string, unknown>,
) => Record<string, unknown>;

function migrateHistoricalDate(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const date = value as Record<string, unknown>;
  const month = date.month;
  const day = date.day;
  return {
    ...date,
    era: "ce",
    precision: day != null ? "day" : month != null ? "month" : "year",
    originalText: null,
    calendar: "proleptic_gregorian",
  };
}

function migrateVersionOne(input: Record<string, unknown>) {
  const timelineItems = Array.isArray(input.timelineItems)
    ? input.timelineItems.map((value) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          return value;
        }
        const item = value as Record<string, unknown>;
        return {
          ...item,
          start: migrateHistoricalDate(item.start),
          end: migrateHistoricalDate(item.end),
          lastConfirmed: migrateHistoricalDate(item.lastConfirmed),
          point: migrateHistoricalDate(item.point),
        };
      })
    : input.timelineItems;
  const timelineEvents = Array.isArray(input.timelineEvents)
    ? input.timelineEvents.map((value) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          return value;
        }
        const event = value as Record<string, unknown>;
        return { ...event, date: migrateHistoricalDate(event.date) };
      })
    : input.timelineEvents;
  return { ...input, schemaVersion: 2, timelineItems, timelineEvents };
}

function migrateVersionTwo(input: Record<string, unknown>) {
  const addAliases = (value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? { ...(value as Record<string, unknown>), aliases: [] }
      : value;
  return {
    ...input,
    schemaVersion: 3,
    timelineItems: Array.isArray(input.timelineItems)
      ? input.timelineItems.map(addAliases)
      : input.timelineItems,
    timelineEvents: Array.isArray(input.timelineEvents)
      ? input.timelineEvents.map(addAliases)
      : input.timelineEvents,
  };
}

function migrateVersionThree(input: Record<string, unknown>) {
  const addMetadata = (value: unknown, event = false) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? {
          ...(value as Record<string, unknown>),
          ...(event ? { eventTypeId: null } : {}),
          tagIds: [],
          customFields: [],
        }
      : value;
  return {
    ...input,
    schemaVersion: 4,
    tags: [],
    eventTypes: [],
    customFields: [],
    timelineItems: Array.isArray(input.timelineItems)
      ? input.timelineItems.map((value) => addMetadata(value))
      : input.timelineItems,
    timelineEvents: Array.isArray(input.timelineEvents)
      ? input.timelineEvents.map((value) => addMetadata(value, true))
      : input.timelineEvents,
  };
}

const importMigrations: Record<number, ImportMigration> = {
  [LEGACY_UNVERSIONED_SCHEMA_VERSION]: (input) => ({
    ...input,
    schemaVersion: 1,
  }),
  1: migrateVersionOne,
  2: migrateVersionTwo,
  3: migrateVersionThree,
};

export type ImportMigrationResult = {
  inputVersion: number | null;
  output?: unknown;
  errors: string[];
  warnings: string[];
};

export function migrateProjectBackup(input: unknown): ImportMigrationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      inputVersion: null,
      errors: ["JSONのルートはオブジェクトにしてください。"],
      warnings: [],
    };
  }

  const raw = input as Record<string, unknown>;
  const declaredVersion = raw.schemaVersion;
  const inputVersion =
    declaredVersion === undefined
      ? LEGACY_UNVERSIONED_SCHEMA_VERSION
      : declaredVersion;
  if (!Number.isInteger(inputVersion) || (inputVersion as number) < 0) {
    return {
      inputVersion: null,
      errors: ["schemaVersionは0以上の整数にしてください。"],
      warnings: [],
    };
  }
  if ((inputVersion as number) > IMPORT_SCHEMA_VERSION) {
    return {
      inputVersion: inputVersion as number,
      errors: [unsupportedSchemaVersionMessage("json", inputVersion as number)],
      warnings: [],
    };
  }

  let version = inputVersion as number;
  let output = { ...raw };
  while (version < IMPORT_SCHEMA_VERSION) {
    const migration = importMigrations[version];
    if (!migration) {
      return {
        inputVersion: version,
        errors: [`JSONスキーマバージョン${version}の移行処理がありません。`],
        warnings: [],
      };
    }
    output = migration(output);
    version += 1;
  }

  return {
    inputVersion: inputVersion as number,
    output,
    errors: [],
    warnings:
      inputVersion === LEGACY_UNVERSIONED_SCHEMA_VERSION
        ? ["旧JSON形式をスキーマバージョン4へ移行しました。"]
        : inputVersion === 1
          ? ["JSONスキーマバージョン1をバージョン4へ移行しました。"]
          : inputVersion === 2
            ? ["JSONスキーマバージョン2をバージョン4へ移行しました。"]
            : inputVersion === 3
              ? ["JSONスキーマバージョン3をバージョン4へ移行しました。"]
              : [],
  };
}

export function previewBackup(input: unknown): ImportPreview {
  const migrated = migrateProjectBackup(input);
  if (migrated.errors.length > 0) {
    return {
      sourceProjectId: null,
      sourceProjectName: "読み取り不可",
      itemTypeCount: 0,
      timelineItemCount: 0,
      timelineEventCount: 0,
      errors: migrated.errors,
      warnings: migrated.warnings,
    };
  }
  const parsed = projectBackupSchema.safeParse(migrated.output);
  if (!parsed.success) {
    return {
      sourceProjectId: null,
      sourceProjectName: "読み取り不可",
      itemTypeCount: 0,
      timelineItemCount: 0,
      timelineEventCount: 0,
      errors: parsed.error.issues
        .slice(0, 50)
        .map(
          (issue) => `${issue.path.join(".") || "ファイル"}: ${issue.message}`,
        ),
      warnings: migrated.warnings,
    };
  }
  const backup = parsed.data;
  return {
    sourceProjectId: backup.project.id,
    sourceProjectName: backup.project.name,
    itemTypeCount: backup.itemTypes.length,
    timelineItemCount: backup.timelineItems.length,
    timelineEventCount: backup.timelineEvents.length,
    errors: [],
    warnings: [
      ...migrated.warnings,
      ...(backup.project.visibility === "public"
        ? [
            "上書きでは公開状態と共有URLも復元されます。複製は非公開で作成されます。",
          ]
        : []),
    ],
    payload: backup,
  };
}
