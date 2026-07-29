import { z } from "zod";

const itemTypeNameSchema = z
  .string()
  .trim()
  .min(1, "タイムライン種別名を入力してください。")
  .max(50, "タイムライン種別名は50文字以内で入力してください。")
  .transform((value) => value.replace(/\s+/g, " "));

const colorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "色は #RRGGBB 形式で入力してください。")
  .transform((value) => value.toUpperCase());

const iconSchema = z
  .string()
  .trim()
  .max(50, "アイコン名は50文字以内で入力してください。")
  .transform((value) => value || null);

export const createItemTypeSchema = z.object({
  name: itemTypeNameSchema,
  defaultColor: colorSchema,
  icon: iconSchema.default(""),
});

export const updateItemTypeSchema = z
  .object({
    name: itemTypeNameSchema.optional(),
    defaultColor: colorSchema.optional(),
    icon: iconSchema.optional(),
    isVisible: z.boolean().optional(),
    sortOrder: z
      .number()
      .int("並び順は整数で指定してください。")
      .min(0, "並び順は0以上で指定してください。")
      .optional(),
  })
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    {
      message: "変更内容を指定してください。",
    },
  )
  .refine(
    (value) => value.sortOrder === undefined || Object.keys(value).length === 1,
    {
      message: "並べ替えと内容変更は別々に実行してください。",
      path: ["sortOrder"],
    },
  );

export type CreateItemTypeInput = z.input<typeof createItemTypeSchema>;
export type UpdateItemTypeInput = z.input<typeof updateItemTypeSchema>;
