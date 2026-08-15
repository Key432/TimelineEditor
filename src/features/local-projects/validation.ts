import { z } from "zod";

export const localProjectCreateSchema = z.object({
  name: z.string().trim().min(1, "プロジェクト名を入力してください。").max(100),
  description: z.string().trim().max(2000).optional(),
  template: z.enum(["literature", "art", "philosophy", "general", "empty"]),
});

export const localItemCreateSchema = z
  .object({
    title: z.string().trim().min(1, "名称を入力してください。").max(200),
    typeId: z.uuid(),
    temporalType: z.enum(["range", "point"]),
    era: z.enum(["ce", "bce"]),
    startYear: z.coerce.number<number>().int().min(1),
    endDateStatus: z.enum(["specified", "ongoing", "unknown"]),
    endYear: z.coerce.number<number>().int().min(1).optional(),
    description: z.string().trim().max(10000).optional(),
  })
  .refine(
    (value) =>
      value.temporalType === "point" ||
      value.endDateStatus !== "specified" ||
      value.endYear !== undefined,
    { path: ["endYear"], message: "終了年を入力してください。" },
  );

export const localEventCreateSchema = z.object({
  title: z.string().trim().min(1, "イベント名を入力してください。").max(200),
  timelineItemIds: z
    .array(z.uuid())
    .min(1, "親タイムラインを選択してください。"),
  era: z.enum(["ce", "bce"]),
  year: z.coerce.number<number>().int().min(1),
  description: z.string().trim().max(10000).optional(),
});
