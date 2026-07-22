import { z } from "zod";

import { SEARCH_ENTITY_TYPES } from "@/features/search/types";

const query = z.string().trim().min(1).max(100);

export const globalSearchSchema = z.object({
  q: query,
  type: z.enum(SEARCH_ENTITY_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const timelineSearchSchema = z.object({ q: query });

export type GlobalSearchInput = z.input<typeof globalSearchSchema>;
