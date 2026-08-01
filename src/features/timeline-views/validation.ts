import { z } from "zod";

import {
  TIMELINE_LAYOUT_MODES,
  TIMELINE_SORT_MODES,
} from "@/features/timeline-items/types";

const filtersSchema = z.object({
  query: z.string().max(200),
  typeIds: z.array(z.uuid()).max(100),
  tagIds: z.array(z.uuid()).max(100).default([]),
  tagMode: z.enum(["and", "or"]).default("or"),
  eventTypeIds: z.array(z.uuid()).max(100).default([]),
  fromYear: z.number().int().min(1).nullable(),
  toYear: z.number().int().min(1).nullable(),
  hasEvents: z.enum(["all", "yes", "no"]),
  approximate: z.enum(["all", "start", "end", "any", "none"]),
  hasCustomColor: z.enum(["all", "yes", "no"]),
  visibility: z.enum(["all", "visible", "hidden"]),
  mode: z.enum(["hide", "dim"]),
});

export const timelineViewConfigurationSchema = z
  .object({
    version: z.literal(1),
    visibleStartOrdinal: z.number().finite(),
    visibleEndOrdinal: z.number().finite(),
    zoomLevel: z.number().int().min(0).max(5),
    scrollLeft: z.number().finite().min(0),
    filters: filtersSchema,
    sortMode: z.enum(TIMELINE_SORT_MODES),
    sortDirection: z.enum(["asc", "desc"]),
    groupByType: z.boolean(),
    layoutMode: z.enum(TIMELINE_LAYOUT_MODES),
    density: z.enum(["comfortable", "compact"]),
    tags: z.array(z.string().max(100)).max(100),
    backgroundLayerIds: z.array(z.uuid()).max(100),
    showRelationships: z.boolean(),
    visibleColumns: z.array(z.string().max(100)).max(100),
  })
  .refine((value) => value.visibleEndOrdinal >= value.visibleStartOrdinal, {
    message: "表示終了位置は開始位置以降にしてください。",
    path: ["visibleEndOrdinal"],
  });

export const createTimelineSavedViewSchema = z.object({
  name: z.string().trim().min(1, "ビュー名を入力してください。").max(80),
  configuration: timelineViewConfigurationSchema,
});

export const updateTimelineSavedViewSchema =
  createTimelineSavedViewSchema.partial();
