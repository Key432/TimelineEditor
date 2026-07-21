import { describe, expect, it } from "vitest";

import {
  historicalDateFromOrdinal,
  historicalDateOrdinal,
} from "@/features/timeline-items/historical-date";
import {
  chooseTickUnit,
  dateToX,
  generateTimelineTicks,
  scrollLeftAfterZoom,
  timelineItemVisualBounds,
  uncertaintyWidth,
  xToDate,
} from "@/features/timeline-items/timeline-math";
import type { TimelineItemSummary } from "@/features/timeline-items/types";

describe("timeline date coordinates", () => {
  it.each([
    { year: 1, month: 1, day: 1 },
    { year: 1600, month: 2, day: 29 },
    { year: 1900, month: 3, day: 1 },
    { year: 2000, month: 2, day: 29 },
    { year: 2026, month: 12, day: 31 },
  ])("round-trips $year/$month/$day", (date) => {
    expect(historicalDateFromOrdinal(historicalDateOrdinal(date))).toEqual(
      date,
    );
  });

  it("keeps adjacent month and leap-day boundaries one day apart", () => {
    expect(
      historicalDateOrdinal({ year: 2000, month: 3, day: 1 }) -
        historicalDateOrdinal({ year: 2000, month: 2, day: 29 }),
    ).toBe(1);
    expect(
      historicalDateOrdinal({ year: 1900, month: 3, day: 1 }) -
        historicalDateOrdinal({ year: 1900, month: 2, day: 28 }),
    ).toBe(1);
  });

  it("converts between dates and x coordinates", () => {
    const origin = historicalDateOrdinal({ year: 1900, month: 1, day: 1 });
    const date = { year: 1901, month: 1, day: 1 };
    const x = dateToX(date, origin, 2);
    expect(x).toBe(730);
    expect(xToDate(x, origin, 2)).toEqual(date);
  });

  it("preserves the date below the cursor while zooming", () => {
    const next = scrollLeftAfterZoom(200, 300, 2, 4);
    expect((next + 300) / 4).toBe((200 + 300) / 2);
    const offsetNext = scrollLeftAfterZoom(200, 300, 2, 4, 24);
    expect((offsetNext + 300 - 24) / 4).toBe((200 + 300 - 24) / 2);
  });
});

describe("timeline ticks and uncertainty", () => {
  it("selects century, decade, year, month, and day granularity", () => {
    expect(chooseTickUnit(0.01)).toBe("century");
    expect(chooseTickUnit(0.1)).toBe("decade");
    expect(chooseTickUnit(1)).toBe("year");
    expect(chooseTickUnit(8)).toBe("month");
    expect(chooseTickUnit(30)).toBe("day");
  });

  it("generates leap-day daily ticks", () => {
    const start = historicalDateOrdinal({ year: 2000, month: 2, day: 28 });
    const result = generateTimelineTicks(start, start + 2, 30);
    expect(result.unit).toBe("day");
    expect(result.ticks).toHaveLength(3);
    expect(historicalDateFromOrdinal(result.ticks[1]!.ordinal)).toEqual({
      year: 2000,
      month: 2,
      day: 29,
    });
  });

  it("does not exceed the project's minimum time unit", () => {
    const start = historicalDateOrdinal({ year: 2000, month: 1, day: 1 });
    expect(generateTimelineTicks(start, start + 10, 36, "year").unit).toBe(
      "year",
    );
    expect(generateTimelineTicks(start, start + 10, 36, "month").unit).toBe(
      "month",
    );
  });

  it("keeps coarse major labels at a readable distance", () => {
    const start = historicalDateOrdinal({ year: 1, month: 1, day: 1 });
    const end = historicalDateOrdinal({ year: 2026, month: 12, day: 31 });
    const scale = 0.0014;
    const labels = generateTimelineTicks(start, end, scale).ticks.filter(
      (tick) => tick.label,
    );
    for (let index = 1; index < labels.length; index += 1) {
      expect(
        (labels[index]!.ordinal - labels[index - 1]!.ordinal) * scale,
      ).toBeGreaterThanOrEqual(79);
    }
  });

  it("converts uncertainty years to a clipped gradient width", () => {
    expect(uncertaintyWidth(5, 2, 5000)).toBeCloseTo(3652.425);
    expect(uncertaintyWidth(5, 2, 300)).toBe(300);
  });

  it("uses the server-provided current day as an ongoing endpoint", () => {
    const ongoing = {
      id: "item",
      projectId: "project",
      typeId: "type",
      itemType: {
        id: "type",
        projectId: "project",
        name: "人物",
        defaultColor: "#2878B5",
        icon: null,
        sortOrder: 0,
        isVisible: true,
        isSystemSeed: false,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
      title: "継続中",
      summary: null,
      temporalType: "range",
      colorOverride: null,
      manualOrder: 0,
      isVisible: true,
      start: { year: 2026, month: 7, day: 1 },
      isStartApproximate: false,
      startUncertaintyYears: null,
      endDateStatus: "ongoing",
      end: null,
      isEndApproximate: false,
      endUncertaintyYears: null,
      lastConfirmed: null,
      point: null,
      isPointApproximate: false,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    } satisfies TimelineItemSummary;
    const currentDate = { year: 2026, month: 7, day: 21 };
    expect(timelineItemVisualBounds(ongoing, currentDate, 5).end).toBe(
      historicalDateOrdinal(currentDate),
    );
  });
});
