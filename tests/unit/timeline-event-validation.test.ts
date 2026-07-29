import { describe, expect, it } from "vitest";

import {
  eventSnapPrecision,
  snapTimelineDate,
} from "@/features/timeline-events/snap";
import {
  isEventOutsideParent,
  timelineEventDraftSchema,
  timelineEventSchema,
} from "@/features/timeline-events/validation";
import { historicalDateOrdinal } from "@/features/timeline-items/historical-date";

const parent = {
  temporalType: "range" as const,
  start: { year: 1900, month: 1, day: 1 },
  endDateStatus: "specified" as const,
  end: { year: 1910, month: 12, day: 31 },
  lastConfirmed: null,
};

describe("timeline event validation and snapping", () => {
  it("accepts partial historical dates and normalizes optional text", () => {
    const result = timelineEventSchema.parse({
      timelineItemIds: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ],
      title: "  出版  ",
      date: { year: "1905", month: "", day: "" },
      isApproximate: false,
      description: "",
      sourceText: "",
      externalUrl: "",
    });
    expect(result).toMatchObject({
      timelineItemIds: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ],
      title: "出版",
      date: { year: 1905, month: null, day: null },
      description: null,
    });
  });

  it("rejects impossible dates, missing titles, and unsafe URLs", () => {
    const result = timelineEventSchema.safeParse({
      timelineItemIds: [],
      title: "",
      date: { year: 1900, month: 2, day: 29 },
      isApproximate: false,
      description: "",
      sourceText: "",
      externalUrl: "javascript:alert(1)",
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate parents", () => {
    const parentId = "11111111-1111-4111-8111-111111111111";
    const result = timelineEventSchema.safeParse({
      timelineItemIds: [parentId, parentId],
      title: "重複親",
      date: { year: 1900, month: null, day: null },
      isApproximate: false,
      description: "",
      sourceText: "",
      externalUrl: "",
    });
    expect(result.success).toBe(false);
  });

  it("validates an event draft before its parent item has an id", () => {
    expect(
      timelineEventDraftSchema.parse({
        title: "同時追加イベント",
        date: { year: "1905", month: "6", day: "" },
        isApproximate: true,
        description: "",
        sourceText: "",
        externalUrl: "",
      }),
    ).toMatchObject({
      title: "同時追加イベント",
      date: { year: 1905, month: 6, day: null },
    });
  });

  it("warns outside the parent range without rejecting the date", () => {
    const today = { year: 2026, month: 7, day: 21 };
    expect(
      isEventOutsideParent({ year: 1899, month: 12, day: 31 }, parent, today),
    ).toBe(true);
    expect(
      isEventOutsideParent(
        { year: 1905, month: null, day: null },
        parent,
        today,
      ),
    ).toBe(false);
    expect(
      isEventOutsideParent({ year: 1911, month: 1, day: 1 }, parent, today),
    ).toBe(true);
  });

  it("snaps coarse, year, and close zoom levels to year, month, and day", () => {
    expect(eventSnapPrecision(0.03)).toBe("year");
    expect(eventSnapPrecision(1.4)).toBe("month");
    expect(eventSnapPrecision(9)).toBe("day");
    const origin = historicalDateOrdinal({ year: 1900, month: 1, day: 1 });
    const target = historicalDateOrdinal({ year: 1905, month: 6, day: 17 });
    expect(snapTimelineDate((target - origin) * 0.03, origin, 0.03)).toEqual({
      precision: "year",
      year: 1905,
      month: null,
      day: null,
    });
    expect(snapTimelineDate((target - origin) * 1.4, origin, 1.4)).toEqual({
      precision: "month",
      year: 1905,
      month: 6,
      day: null,
    });
    expect(snapTimelineDate((target - origin) * 9, origin, 9)).toEqual({
      precision: "day",
      year: 1905,
      month: 6,
      day: 17,
    });
  });
});
