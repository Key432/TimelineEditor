import { z } from "zod";

import {
  CUSTOM_FIELD_TYPES,
  MARKER_SHAPES,
} from "@/features/classification/types";

const optionalDescription = z
  .string()
  .trim()
  .max(1000)
  .transform((value) => value || null)
  .nullable()
  .default(null);
const color = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "色は #RRGGBB 形式で入力してください。")
  .transform((value) => value.toUpperCase());
const name = z
  .string()
  .trim()
  .min(1, "名前を入力してください。")
  .max(100, "名前は100文字以内で入力してください。");
const historicalDateValueSchema = z
  .object({
    era: z.enum(["ce", "bce"]).optional(),
    precision: z.enum(["day", "month", "year", "decade", "century"]).optional(),
    year: z.number().int().min(1),
    month: z.number().int().min(1).max(12).nullable(),
    day: z.number().int().min(1).max(31).nullable(),
    originalText: z.string().max(200).nullable().optional(),
    calendar: z.string().min(1).max(50).optional(),
  })
  .refine(
    (value) => value.day === null || value.month !== null,
    "月未入力時に日は指定できません。",
  );

export const tagSchema = z.object({
  name,
  color,
  description: optionalDescription,
});
export const eventTypeSchema = z.object({
  name,
  color,
  markerShape: z.enum(MARKER_SHAPES),
  description: optionalDescription,
});

export const customFieldDefinitionSchema = z
  .object({
    entityType: z.enum(["timeline_item", "timeline_event"]),
    scope: z.enum(["project", "type"]).default("project"),
    targetTypeId: z.uuid().nullable().default(null),
    name,
    fieldType: z.enum(CUSTOM_FIELD_TYPES),
    isRequired: z.boolean().default(false),
    options: z.array(name).max(100).default([]),
    description: optionalDescription,
  })
  .superRefine((value, context) => {
    if (value.scope === "project" && value.targetTypeId !== null)
      context.addIssue({
        code: "custom",
        path: ["targetTypeId"],
        message: "プロジェクト共通フィールドには対象種別を指定できません。",
      });
    if (value.scope === "type" && value.targetTypeId === null)
      context.addIssue({
        code: "custom",
        path: ["targetTypeId"],
        message: "対象種別を選択してください。",
      });
    if (
      ["single_select", "multi_select"].includes(value.fieldType) &&
      value.options.length === 0
    )
      context.addIssue({
        code: "custom",
        path: ["options"],
        message: "選択肢を1件以上入力してください。",
      });
  });

const entityReferenceSchema = z.object({
  entityType: z.enum(["timeline_item", "timeline_event"]),
  entityId: z.uuid(),
});
export const customFieldEntrySchema = z.object({
  fieldId: z.uuid(),
  value: z.union([
    z.string().max(20000),
    z.number().finite(),
    z.boolean(),
    z.array(z.string().max(100)).max(100),
    historicalDateValueSchema,
    entityReferenceSchema,
  ]),
});
export const customFieldEntriesSchema = z
  .array(customFieldEntrySchema)
  .max(100)
  .superRefine((entries, context) => {
    const ids = new Set<string>();
    entries.forEach((entry, index) => {
      if (ids.has(entry.fieldId))
        context.addIssue({
          code: "custom",
          path: [index, "fieldId"],
          message: "同じカスタムフィールドを重複して保存できません。",
        });
      ids.add(entry.fieldId);
    });
  });

export type TagInput = z.output<typeof tagSchema>;
export type EventTypeInput = z.output<typeof eventTypeSchema>;
export type CustomFieldDefinitionInput = z.output<
  typeof customFieldDefinitionSchema
>;
