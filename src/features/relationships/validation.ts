import { z } from "zod";

import {
  RELATIONSHIP_ENTITY_TYPES,
  RELATIONSHIP_LINE_STYLES,
  RELATIONSHIP_MARKERS,
} from "@/features/relationships/types";

export const relationshipInputSchema = z
  .object({
    sourceType: z.enum(RELATIONSHIP_ENTITY_TYPES),
    sourceId: z.uuid(),
    targetType: z.enum(RELATIONSHIP_ENTITY_TYPES),
    targetId: z.uuid(),
    relationType: z.string().trim().min(1).max(80),
    lineStyle: z.enum(RELATIONSHIP_LINE_STYLES).default("single"),
    sourceMarker: z.enum(RELATIONSHIP_MARKERS).default("none"),
    targetMarker: z.enum(RELATIONSHIP_MARKERS).default("none"),
    note: z.string().trim().max(2000).nullable().default(null),
  })
  .superRefine((value, context) => {
    if (
      value.sourceType === value.targetType &&
      value.sourceId === value.targetId
    ) {
      context.addIssue({
        code: "custom",
        message: "同じ項目同士は関係付けできません。",
        path: ["targetId"],
      });
    }
  });
