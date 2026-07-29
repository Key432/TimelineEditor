import { describe, expect, it } from "vitest";

import {
  customFieldDefinitionSchema,
  customFieldEntriesSchema,
  eventTypeSchema,
} from "@/features/classification/validation";

describe("Phase L9 classification validation", () => {
  it("accepts visual marker shapes and normalizes colors", () => {
    const parsed = eventTypeSchema.parse({
      name: "出版",
      color: "#ff3399",
      markerShape: "diamond",
      description: "刊行イベント",
    });
    expect(parsed).toMatchObject({ color: "#FF3399", markerShape: "diamond" });
  });

  it("requires options for selection fields and a target for type-scoped fields", () => {
    expect(
      customFieldDefinitionSchema.safeParse({
        entityType: "timeline_item",
        scope: "project",
        targetTypeId: null,
        name: "分類",
        fieldType: "single_select",
        isRequired: false,
        options: [],
        description: null,
      }).success,
    ).toBe(false);
    expect(
      customFieldDefinitionSchema.safeParse({
        entityType: "timeline_event",
        scope: "type",
        targetTypeId: null,
        name: "会場",
        fieldType: "text",
        isRequired: false,
        options: [],
        description: null,
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate values and historical dates with a day but no month", () => {
    const fieldId = "11111111-1111-4111-8111-111111111111";
    expect(
      customFieldEntriesSchema.safeParse([
        { fieldId, value: "A" },
        { fieldId, value: "B" },
      ]).success,
    ).toBe(false);
    expect(
      customFieldEntriesSchema.safeParse([
        {
          fieldId,
          value: {
            era: "ce",
            precision: "day",
            year: 1900,
            month: null,
            day: 1,
            originalText: null,
            calendar: "proleptic_gregorian",
          },
        },
      ]).success,
    ).toBe(false);
  });
});
