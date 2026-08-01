import { z } from "zod";

export const tableEntityTypeSchema = z.enum([
  "timeline_item",
  "timeline_event",
]);

export const tablePreferenceSchema = z.object({
  entityType: tableEntityTypeSchema,
  visibleColumns: z.array(z.string().min(1).max(100)).max(100),
  columnWidths: z.record(z.string(), z.number().int().min(80).max(800)),
  wrappedColumns: z.array(z.string().min(1).max(100)).max(100),
  frozenColumnCount: z.number().int().min(1).max(20),
});

export type TablePreferenceInput = z.infer<typeof tablePreferenceSchema>;

export const csvMappingProfileSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(100),
  entityType: tableEntityTypeSchema,
  mapping: z.record(z.string().max(100), z.string().max(200)),
  dateFormat: z.enum(["separate", "iso", "japanese"]),
});
