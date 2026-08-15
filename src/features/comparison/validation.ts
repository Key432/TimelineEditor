import { z } from "zod";

export const comparisonRangeSchema = z
  .object({
    from: z.coerce.number().finite(),
    to: z.coerce.number().finite(),
  })
  .refine((value) => value.to >= value.from, {
    message: "表示終了位置は開始位置以降にしてください。",
    path: ["to"],
  });

const nameFilterSchema = z.array(z.string().trim().min(1).max(100)).max(100);

export const comparisonViewConfigurationSchema = z
  .object({
    version: z.literal(1),
    projectIds: z.array(z.uuid()).min(1).max(6),
    hiddenProjectIds: z.array(z.uuid()).max(6),
    visibleStartOrdinal: z.number().finite(),
    visibleEndOrdinal: z.number().finite(),
    zoomLevel: z.number().int().min(0).max(4),
    highlightStartOrdinal: z.number().finite().nullable(),
    highlightEndOrdinal: z.number().finite().nullable(),
    filters: z.object({
      tagNames: nameFilterSchema,
      typeNames: nameFilterSchema,
      eventTypeNames: nameFilterSchema,
    }),
  })
  .refine((value) => value.visibleEndOrdinal >= value.visibleStartOrdinal, {
    message: "表示終了位置は開始位置以降にしてください。",
    path: ["visibleEndOrdinal"],
  })
  .refine(
    (value) =>
      value.highlightStartOrdinal === null ||
      value.highlightEndOrdinal === null ||
      value.highlightEndOrdinal >= value.highlightStartOrdinal,
    {
      message: "強調終了位置は開始位置以降にしてください。",
      path: ["highlightEndOrdinal"],
    },
  )
  .refine(
    (value) =>
      value.hiddenProjectIds.every((id) => value.projectIds.includes(id)),
    {
      message: "非表示プロジェクトは比較対象から選択してください。",
      path: ["hiddenProjectIds"],
    },
  );

export const createComparisonSavedViewSchema = z.object({
  name: z.string().trim().min(1, "ビュー名を入力してください。").max(80),
  configuration: comparisonViewConfigurationSchema,
});

export const updateComparisonSavedViewSchema =
  createComparisonSavedViewSchema.partial();
