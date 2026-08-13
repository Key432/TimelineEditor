import { z } from "zod";

import type { TimelineBackgroundLayer } from "@/features/background-layers/types";
import type { Project } from "@/features/projects/types";
import type { RelationshipDataset } from "@/features/relationships/types";
import type { TimelineEventSummary } from "@/features/timeline-events/types";
import type {
  HistoricalDate,
  TimelineItemSummary,
} from "@/features/timeline-items/types";

export const VISUAL_EXPORT_LAYOUTS = ["row", "compact", "network"] as const;
export type VisualExportLayout = (typeof VISUAL_EXPORT_LAYOUTS)[number];

export const VISUAL_EXPORT_RANGE_MODES = [
  "viewport",
  "highlight",
  "all",
  "custom",
] as const;
export type VisualExportRangeMode = (typeof VISUAL_EXPORT_RANGE_MODES)[number];

export type VisualExportGroup = {
  id: string;
  label: string;
  color: string;
  showHeader: boolean;
  collapsed: boolean;
  items: TimelineItemSummary[];
};

export type VisualExportSnapshot = {
  project: Pick<Project, "name" | "description" | "settings">;
  currentDate: HistoricalDate;
  groups: VisualExportGroup[];
  items: TimelineItemSummary[];
  events: TimelineEventSummary[];
  networkItems: TimelineItemSummary[];
  networkEvents: TimelineEventSummary[];
  dimmedItemIds: string[];
  backgroundLayers: TimelineBackgroundLayer[];
  relationships: RelationshipDataset;
  viewport: { startOrdinal: number; endOrdinal: number } | null;
  highlightRange: { startOrdinal: number; endOrdinal: number } | null;
};

export const visualExportOptionsSchema = z
  .object({
    layout: z.enum(VISUAL_EXPORT_LAYOUTS),
    rangeMode: z.enum(VISUAL_EXPORT_RANGE_MODES),
    customStartYear: z.number().int().min(-9999).max(9999),
    customEndYear: z.number().int().min(-9999).max(9999),
    includeTitle: z.boolean(),
    includeDescription: z.boolean(),
    includeLegend: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.customStartYear === 0) {
      context.addIssue({
        code: "custom",
        message: "西暦0年は指定できません。",
        path: ["customStartYear"],
      });
    }
    if (value.customEndYear === 0) {
      context.addIssue({
        code: "custom",
        message: "西暦0年は指定できません。",
        path: ["customEndYear"],
      });
    }
    if (
      value.rangeMode === "custom" &&
      value.customStartYear > value.customEndYear
    ) {
      context.addIssue({
        code: "custom",
        message: "任意年代の開始年は終了年以下にしてください。",
        path: ["customEndYear"],
      });
    }
  });

export type VisualExportOptions = z.infer<typeof visualExportOptionsSchema>;

export const PDF_PAGE_SIZES = ["a4", "a3", "letter"] as const;
export const PDF_ORIENTATIONS = ["portrait", "landscape"] as const;
export const PDF_SCALE_MODES = [
  "fit-page",
  "fit-height",
  "fit-width",
  "original",
] as const;

export const pdfExportOptionsSchema = z.object({
  pageSize: z.enum(PDF_PAGE_SIZES),
  orientation: z.enum(PDF_ORIENTATIONS),
  marginMm: z.number().int().min(0).max(40),
  scaleMode: z.enum(PDF_SCALE_MODES),
});

export type PdfExportOptions = z.infer<typeof pdfExportOptionsSchema>;
