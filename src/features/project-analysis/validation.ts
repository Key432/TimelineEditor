import { z } from "zod";

const commaSeparatedIds = z
  .string()
  .max(4_000)
  .optional()
  .transform((value) => value?.split(",").filter(Boolean) ?? [])
  .pipe(z.array(z.uuid()).max(100));

const optionalOrdinal = z
  .string()
  .optional()
  .transform((value) => (value === undefined ? null : Number(value)))
  .pipe(z.number().int().finite().nullable());

export const projectAnalysisFiltersSchema = z.object({
  query: z.string().max(200).optional().default(""),
  typeIds: commaSeparatedIds,
  tagIds: commaSeparatedIds,
  tagMode: z.enum(["and", "or"]).optional().default("or"),
  eventTypeIds: commaSeparatedIds,
  fromOrdinal: optionalOrdinal,
  toOrdinal: optionalOrdinal,
  hasEvents: z.enum(["all", "yes", "no"]).optional().default("all"),
  approximate: z
    .enum(["all", "start", "end", "any", "none"])
    .optional()
    .default("all"),
  hasCustomColor: z.enum(["all", "yes", "no"]).optional().default("all"),
  visibility: z.enum(["all", "visible", "hidden"]).optional().default("all"),
});

export const mergeEntitiesSchema = z
  .object({
    entityType: z.enum(["timeline_item", "timeline_event"]),
    survivorId: z.uuid(),
    mergedId: z.uuid(),
    preview: z.boolean().default(false),
  })
  .refine((value) => value.survivorId !== value.mergedId, {
    message: "異なるデータを選択してください。",
  });

export const undoEntityMergeSchema = z.object({ operationId: z.uuid() });
