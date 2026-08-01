import { z } from "zod";

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
