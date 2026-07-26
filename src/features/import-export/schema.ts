import { z } from "zod";

import { timelineEventSchema } from "@/features/timeline-events/validation";
import { timelineItemSchema } from "@/features/timeline-items/validation";
import {
  DATA_COMPATIBILITY_BASELINE,
  LEGACY_UNVERSIONED_SCHEMA_VERSION,
  unsupportedSchemaVersionMessage,
} from "@/lib/data-compatibility";

export const IMPORT_SCHEMA_VERSION = DATA_COMPATIBILITY_BASELINE.json.version;
export const importSectionSchema = z.enum([
  "itemTypes",
  "timelineItems",
  "timelineEvents",
]);

const nullableString = z.string().nullable();
const historicalDate = z
  .object({
    year: z.number().int(),
    month: z.number().int().nullable(),
    day: z.number().int().nullable(),
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
    const validatesTypes =
      !backup.importSections || backup.importSections.includes("itemTypes");
    const validatesItems =
      !backup.importSections || backup.importSections.includes("timelineItems");
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

const importMigrations: Record<number, ImportMigration> = {
  [LEGACY_UNVERSIONED_SCHEMA_VERSION]: (input) => ({
    ...input,
    schemaVersion: IMPORT_SCHEMA_VERSION,
  }),
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
        ? ["旧JSON形式をスキーマバージョン1へ移行しました。"]
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
