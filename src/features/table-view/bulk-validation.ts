import { z } from "zod";

const ids = z
  .array(z.uuid())
  .min(1)
  .max(1000)
  .refine((value) => new Set(value).size === value.length);
export const bulkEditSchema = z.object({
  entityType: z.enum(["timeline_item", "timeline_event"]),
  ids,
  preview: z.boolean().default(false),
  operation: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("set_visibility"), value: z.boolean() }),
    z.object({
      kind: z.literal("set_color"),
      value: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .nullable(),
    }),
    z.object({ kind: z.literal("set_type"), value: z.uuid().nullable() }),
    z.object({
      kind: z.literal("tags"),
      mode: z.enum(["add", "remove", "replace"]),
      tagIds: z.array(z.uuid()).max(100),
    }),
    z.object({ kind: z.literal("delete") }),
  ]),
});

export const undoBulkEditSchema = z.object({ operationId: z.uuid() });
export type BulkEditInput = z.infer<typeof bulkEditSchema>;
