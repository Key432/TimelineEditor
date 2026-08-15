import { describe, expect, it } from "vitest";

import {
  analyzeProjectData,
  calculateProjectStatistics,
  type ProjectAnalysisDataset,
} from "@/features/project-analysis/analysis";
import { projectAnalysisFiltersSchema } from "@/features/project-analysis/validation";

const itemA = "11111111-1111-4111-8111-111111111111";
const itemB = "22222222-2222-4222-8222-222222222222";
const eventA = "33333333-3333-4333-8333-333333333333";

function dataset(): ProjectAnalysisDataset {
  return {
    entities: [
      {
        id: itemA,
        entityType: "timeline_item",
        title: "織田 信長",
        aliases: ["信長"],
        typeId: "type-person",
        tagIds: ["tag-a"],
        parentIds: [],
        dateStart: -141000,
        dateEnd: -137000,
        description: "[[item:99999999-9999-4999-8999-999999999999|不明]]",
        sourceMissing: true,
        externalUrl: "javascript:alert(1)",
        requiredFieldIds: ["field-required"],
        filledFieldIds: [],
      },
      {
        id: itemB,
        entityType: "timeline_item",
        title: "織田信長",
        aliases: [],
        typeId: "type-person",
        tagIds: [],
        parentIds: [],
        dateStart: -141000,
        dateEnd: -137000,
        description: "本文",
        sourceMissing: false,
        externalUrl: null,
        requiredFieldIds: [],
        filledFieldIds: [],
      },
      {
        id: eventA,
        entityType: "timeline_event",
        title: "事件",
        aliases: [],
        typeId: null,
        tagIds: [],
        parentIds: [itemA],
        dateStart: -130000,
        dateEnd: -130000,
        description: "未完の [[ 記法",
        sourceMissing: true,
        externalUrl: null,
        requiredFieldIds: [],
        filledFieldIds: [],
      },
    ],
    masters: [
      { kind: "tag", id: "tag-a", name: "使用中", usageCount: 1 },
      { kind: "tag", id: "tag-unused", name: "未使用", usageCount: 0 },
      {
        kind: "timeline_item_type",
        id: "type-person",
        name: "人物",
        usageCount: 2,
      },
    ],
    references: [
      {
        kind: "internal_link",
        sourceType: "timeline_item",
        sourceId: itemA,
        targetType: "timeline_item",
        targetId: "99999999-9999-4999-8999-999999999999",
        targetState: "missing",
      },
    ],
  };
}

describe("Phase L13 project analysis", () => {
  it("validates Phase L19 analysis filters", () => {
    expect(
      projectAnalysisFiltersSchema.safeParse({
        typeIds: "not-a-uuid",
        fromOrdinal: "not-a-number",
      }).success,
    ).toBe(false);
    expect(
      projectAnalysisFiltersSchema.parse({
        tagMode: "and",
        fromOrdinal: "123",
      }),
    ).toMatchObject({ tagMode: "and", fromOrdinal: 123 });
  });

  it("detects actionable quality problems without a published-incomplete rule", () => {
    const result = analyzeProjectData(dataset());
    const kinds = result.issues.flatMap((issue) =>
      issue.reasons.map((reason) => reason.kind),
    );
    const itemIssues = result.issues.filter(
      (issue) => issue.entityId === itemA,
    );

    expect(itemIssues).toHaveLength(1);
    expect(itemIssues[0]?.reasons.map((reason) => reason.kind)).toEqual(
      expect.arrayContaining([
        "broken_internal_link",
        "missing_source",
        "missing_required_custom_field",
        "invalid_external_url",
      ]),
    );

    expect(kinds).toContain("broken_internal_link");
    expect(kinds).toContain("event_outside_all_parents");
    expect(kinds).toContain("missing_source");
    expect(kinds).toContain("missing_required_custom_field");
    expect(kinds).toContain("invalid_external_url");
    expect(kinds).toContain("unused_master");
    expect(kinds).toContain("markdown_syntax");
    expect(kinds).not.toContain("published_incomplete");
    expect(result.summary.missingSourceCount).toBe(2);
  });

  it("scores normalized titles, aliases, dates, types and parents on demand", () => {
    const result = analyzeProjectData(dataset());
    const duplicate = result.duplicates.find(
      (candidate) =>
        candidate.left.id === itemA && candidate.right.id === itemB,
    );

    expect(duplicate?.score).toBeGreaterThanOrEqual(70);
    expect(duplicate?.reasons).toEqual(
      expect.arrayContaining(["名称", "日付", "種別"]),
    );
  });

  it("calculates Phase L19 statistics on demand and applies the active range", () => {
    const input = dataset();
    input.entities[0]!.createdAt = "2026-08-16T01:00:00.000Z";
    input.entities[0]!.datePrecision = "year";
    input.entities[0]!.endDateStatus = "specified";
    input.entities[1]!.createdAt = "2026-08-16T02:00:00.000Z";
    input.entities[1]!.datePrecision = "year";
    input.entities[1]!.endDateStatus = "specified";
    input.entities[2]!.createdAt = "2026-08-15T01:00:00.000Z";
    input.entities[2]!.datePrecision = "day";
    input.references.push({
      kind: "relationship",
      sourceType: "timeline_item",
      sourceId: itemA,
      targetType: "timeline_item",
      targetId: itemB,
      targetState: "active",
      relationType: "影響",
    });

    const statistics = calculateProjectStatistics(
      input,
      { fromOrdinal: -142000, toOrdinal: -138000 },
      new Date("2026-08-16T12:00:00.000Z"),
    );

    expect(statistics.totals).toEqual({
      itemCount: 2,
      eventCount: 0,
      relationshipCount: 1,
      internalLinkCount: 1,
    });
    expect(statistics.countsByType).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "人物", count: 2 }),
      ]),
    );
    expect(statistics.relationshipTypes).toEqual([
      expect.objectContaining({ label: "影響", count: 1 }),
    ]);
    expect(statistics.creationActivity).toHaveLength(365);
    expect(statistics.creationActivity.at(-1)).toMatchObject({
      date: "2026-08-16",
      itemCount: 2,
      eventCount: 0,
    });
  });

  it("keeps 1,000 items and 10,000 events bounded without persisting analysis", () => {
    const large: ProjectAnalysisDataset = {
      masters: [],
      references: [],
      entities: [
        ...Array.from({ length: 1_000 }, (_, index) => ({
          id: `item-${index}`,
          entityType: "timeline_item" as const,
          title: `人物 ${index}`,
          aliases: [],
          typeId: `item-type-${index % 10}`,
          tagIds: [`tag-${index % 20}`],
          parentIds: [],
          dateStart: index * 100,
          dateEnd: index * 100 + 99,
          description: "本文",
          sourceMissing: false,
          externalUrl: null,
          requiredFieldIds: [],
          filledFieldIds: [],
        })),
        ...Array.from({ length: 10_000 }, (_, index) => ({
          id: `event-${index}`,
          entityType: "timeline_event" as const,
          title: `イベント ${index}`,
          aliases: [],
          typeId: `event-type-${index % 20}`,
          tagIds: [],
          parentIds: [`item-${index % 1_000}`],
          dateStart: (index % 1_000) * 100 + (index % 100),
          dateEnd: (index % 1_000) * 100 + (index % 100),
          description: "本文",
          sourceMissing: false,
          externalUrl: null,
          requiredFieldIds: [],
          filledFieldIds: [],
        })),
      ],
    };
    const started = performance.now();
    const result = analyzeProjectData(large);
    expect(performance.now() - started).toBeLessThan(3_000);
    expect(result.summary).toMatchObject({
      itemCount: 1_000,
      eventCount: 10_000,
    });
    expect(result.duplicates.length).toBeLessThanOrEqual(500);
  });
});
