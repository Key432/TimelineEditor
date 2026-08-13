import { describe, expect, it } from "vitest";

import { historicalDateOrdinal } from "@/features/timeline-items/historical-date";
import type { TimelineItemSummary } from "@/features/timeline-items/types";
import { calculatePdfPagination } from "@/features/visual-export/client";
import {
  buildVisualExportSvg,
  resolveVisualExportRange,
} from "@/features/visual-export/svg";
import type {
  VisualExportOptions,
  VisualExportSnapshot,
} from "@/features/visual-export/types";
import { visualExportOptionsSchema } from "@/features/visual-export/types";

const projectId = "22222222-2222-4222-8222-222222222222";
const itemType = {
  id: "type-1",
  projectId,
  name: "人物",
  defaultColor: "#00B0B0",
  icon: "user-round" as const,
  sortOrder: 0,
  isVisible: true,
  isSystemSeed: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function item(id: string, title: string, year: number): TimelineItemSummary {
  return {
    id,
    projectId,
    typeId: itemType.id,
    itemType,
    title,
    tags: [],
    temporalType: "point",
    colorOverride: null,
    manualOrder: 0,
    isVisible: true,
    start: null,
    isStartApproximate: false,
    startUncertaintyYears: null,
    endDateStatus: null,
    end: null,
    isEndApproximate: false,
    endUncertaintyYears: null,
    lastConfirmed: null,
    point: { year, month: null, day: null },
    isPointApproximate: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

function snapshot(): VisualExportSnapshot {
  const items = [item("a", "夏目漱石", 1867), item("b", "森鴎外", 1862)];
  return {
    project: {
      name: "日本文学史",
      description: "近代文学の流れ",
      settings: {
        defaultUncertaintyYears: 5,
        initialStartYear: 1800,
        initialEndYear: 2026,
        initialZoomPreset: "fit-range",
        timelineDensity: "comfortable",
        minimumTimeUnit: "day",
      },
    },
    currentDate: { year: 2026, month: 8, day: 14 },
    groups: [
      {
        id: "people",
        label: "人物",
        color: "#00B0B0",
        showHeader: true,
        collapsed: false,
        items,
      },
    ],
    items,
    events: [],
    networkItems: items,
    networkEvents: [],
    dimmedItemIds: [],
    backgroundLayers: [],
    relationships: { relationships: [], entities: [] },
    viewport: {
      startOrdinal: historicalDateOrdinal({ year: 1850, month: 1, day: 1 }),
      endOrdinal: historicalDateOrdinal({ year: 1900, month: 12, day: 31 }),
    },
    highlightRange: {
      startOrdinal: historicalDateOrdinal({ year: 1860, month: 1, day: 1 }),
      endOrdinal: historicalDateOrdinal({ year: 1870, month: 12, day: 31 }),
    },
  };
}

const options: VisualExportOptions = {
  layout: "row",
  rangeMode: "all",
  customStartYear: 1800,
  customEndYear: 2000,
  includeTitle: true,
  includeDescription: true,
  includeLegend: true,
};

describe("Phase L17 visual export", () => {
  it("resolves full-data and explicitly specified ranges without Date", () => {
    const data = snapshot();
    const full = resolveVisualExportRange(data, options);
    expect(full.startOrdinal).toBe(
      historicalDateOrdinal({ year: 1862, month: null, day: null }),
    );
    expect(full.endOrdinal).toBe(
      historicalDateOrdinal({ year: 1867, month: null, day: null }),
    );
    const specified = resolveVisualExportRange(data, {
      ...options,
      rangeMode: "custom",
      customStartYear: -100,
      customEndYear: 100,
    });
    expect(specified.startOrdinal).toBe(
      historicalDateOrdinal({ era: "bce", year: 100, month: 1, day: 1 }),
    );
    expect(specified.endOrdinal).toBe(
      historicalDateOrdinal({ year: 100, month: 12, day: 31 }, "end"),
    );
  });

  it("rejects year zero for a specified historical range", () => {
    const result = visualExportOptionsSchema.safeParse({
      ...options,
      rangeMode: "custom",
      customStartYear: 0,
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0]?.message).toBe("西暦0年は指定できません。");
  });

  it.each(["row", "compact", "network"] as const)(
    "builds an editable Japanese SVG for %s output",
    (layout) => {
      const result = buildVisualExportSvg(snapshot(), { ...options, layout });
      expect(result.svg).toMatch(/^<svg/);
      expect(result.svg).toContain("日本文学史");
      expect(result.svg).toContain("夏目漱石");
      expect(result.svg).toContain("Noto Sans JP");
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
    },
  );

  it("calculates one-page, fit-height, and original-size PDF tiling", () => {
    const base = {
      pageSize: "a4" as const,
      orientation: "landscape" as const,
      marginMm: 10,
    };
    expect(
      calculatePdfPagination(4000, 2000, {
        ...base,
        scaleMode: "fit-page",
      }),
    ).toMatchObject({ columns: 1, rows: 1 });
    expect(
      calculatePdfPagination(4000, 2000, {
        ...base,
        scaleMode: "fit-height",
      }).columns,
    ).toBeGreaterThan(1);
    expect(
      calculatePdfPagination(4000, 2000, {
        ...base,
        scaleMode: "original",
      }),
    ).toMatchObject({ columns: 4, rows: 3 });
  });
});
