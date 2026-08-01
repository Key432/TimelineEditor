import { describe, expect, it } from "vitest";

import { overlappingBackgroundPeriodIds } from "@/features/background-layers/overlap";
import type { TimelineBackgroundPeriod } from "@/features/background-layers/types";
import { backgroundPeriodSchema } from "@/features/background-layers/validation";

function period(
  id: string,
  start: number,
  end: number,
): TimelineBackgroundPeriod {
  return {
    id,
    projectId: "11111111-1111-4111-8111-111111111111",
    layerId: "22222222-2222-4222-8222-222222222222",
    title: id,
    description: null,
    color: "#7C9A92",
    start: {
      era: "ce",
      precision: "year",
      year: start,
      month: null,
      day: null,
      originalText: null,
      calendar: "proleptic_gregorian",
    },
    end: {
      era: "ce",
      precision: "year",
      year: end,
      month: null,
      day: null,
      originalText: null,
      calendar: "proleptic_gregorian",
    },
    isStartApproximate: false,
    isEndApproximate: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

describe("background layers", () => {
  it("warns for direct and nested overlaps but not adjacent periods", () => {
    const overlaps = overlappingBackgroundPeriodIds([
      period("long", 1800, 1900),
      period("nested", 1850, 1860),
      period("later", 1901, 1910),
    ]);
    expect([...overlaps].sort()).toEqual(["long", "nested"]);
  });

  it("accepts BCE centuries and rejects a reversed period", () => {
    const base = {
      title: "古代",
      description: "",
      color: "#AA5500",
      start: {
        era: "bce",
        precision: "century",
        year: 5,
        month: null,
        day: null,
        originalText: "前5世紀",
        calendar: "proleptic_gregorian",
      },
      end: {
        era: "bce",
        precision: "century",
        year: 4,
        month: null,
        day: null,
        originalText: "前4世紀",
        calendar: "proleptic_gregorian",
      },
      isStartApproximate: true,
      isEndApproximate: true,
    };
    expect(backgroundPeriodSchema.safeParse(base).success).toBe(true);
    expect(
      backgroundPeriodSchema.safeParse({
        ...base,
        start: { ...base.start, era: "ce", year: 2000 },
        end: { ...base.end, era: "ce", year: 1900 },
      }).success,
    ).toBe(false);
  });
});
