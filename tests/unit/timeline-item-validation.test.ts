import { describe, expect, it } from "vitest";

import {
  daysInMonth,
  formatHistoricalDate,
  isLeapYear,
  isValidHistoricalDate,
} from "@/features/timeline-items/historical-date";
import {
  emptyTimelineItemValues,
  timelineItemSchema,
} from "@/features/timeline-items/validation";

const typeId = "11111111-1111-4111-8111-111111111111";

function rangeInput() {
  return {
    ...emptyTimelineItemValues(typeId),
    title: "夏目漱石",
    start: { year: 1867, month: 2, day: 9 },
    end: { year: 1916, month: 12, day: 9 },
  };
}

describe("historical dates", () => {
  it.each([
    [1600, true],
    [1900, false],
    [2000, true],
    [2026, false],
  ])("evaluates leap year %i", (year, expected) => {
    expect(isLeapYear(year)).toBe(expected);
  });

  it("validates month lengths without JavaScript Date", () => {
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(isValidHistoricalDate({ year: 2000, month: 2, day: 29 })).toBe(true);
    expect(isValidHistoricalDate({ year: 1900, month: 2, day: 29 })).toBe(
      false,
    );
    expect(isValidHistoricalDate({ year: 2026, month: null, day: 1 })).toBe(
      false,
    );
    expect(isValidHistoricalDate({ year: 0, month: null, day: null })).toBe(
      false,
    );
  });

  it("formats partial historical dates without timezone conversion", () => {
    expect(formatHistoricalDate({ year: 1867, month: null, day: null })).toBe(
      "1867",
    );
    expect(formatHistoricalDate({ year: 1867, month: 2, day: 9 })).toBe(
      "1867/02/09",
    );
  });
});

describe("timeline item validation", () => {
  it("accepts a specified range with independent approximate flags", () => {
    const result = timelineItemSchema.safeParse({
      ...rangeInput(),
      isStartApproximate: true,
      isEndApproximate: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts ongoing and unknown ranges with their permitted fields", () => {
    const ongoing = timelineItemSchema.safeParse({
      ...rangeInput(),
      endDateStatus: "ongoing",
      end: null,
      isEndApproximate: false,
    });
    const unknown = timelineItemSchema.safeParse({
      ...rangeInput(),
      endDateStatus: "unknown",
      end: null,
      isEndApproximate: false,
      lastConfirmed: { year: 1910, month: null, day: null },
    });
    expect(ongoing.success).toBe(true);
    expect(unknown.success).toBe(true);
  });

  it("accepts a point item and rejects a missing point date", () => {
    const valid = timelineItemSchema.safeParse({
      ...rangeInput(),
      temporalType: "point",
      start: null,
      endDateStatus: null,
      end: null,
      point: { year: 1905, month: 1, day: 1 },
    });
    const invalid = timelineItemSchema.safeParse({
      ...rangeInput(),
      temporalType: "point",
      start: null,
      endDateStatus: null,
      end: null,
      point: null,
    });
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("normalizes untouched hidden date inputs when switching to a point", () => {
    const result = timelineItemSchema.parse({
      ...emptyTimelineItemValues(typeId),
      title: "刊行",
      temporalType: "point",
      start: { year: "1905", month: "", day: "" },
      point: { year: "1905", month: "", day: "" },
    });
    expect(result.end).toBeNull();
    expect(result.point).toEqual({ year: 1905, month: null, day: null });
  });

  it("rejects reversed, impossible, and incomplete dates", () => {
    expect(
      timelineItemSchema.safeParse({
        ...rangeInput(),
        end: { year: 1800, month: null, day: null },
      }).success,
    ).toBe(false);
    expect(
      timelineItemSchema.safeParse({
        ...rangeInput(),
        start: { year: 1900, month: 2, day: 29 },
      }).success,
    ).toBe(false);
    expect(
      timelineItemSchema.safeParse({
        ...rangeInput(),
        start: { year: 1900, month: null, day: 1 },
      }).success,
    ).toBe(false);
  });

  it("allows only http and https external URLs", () => {
    expect(
      timelineItemSchema.safeParse({
        ...rangeInput(),
        externalUrl: "https://example.com/source",
      }).success,
    ).toBe(true);
    expect(
      timelineItemSchema.safeParse({
        ...rangeInput(),
        externalUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });
});
