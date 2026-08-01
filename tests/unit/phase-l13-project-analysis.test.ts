import { describe, expect, it } from "vitest";

import {
  analyzeProjectData,
  type ProjectAnalysisDataset,
} from "@/features/project-analysis/analysis";

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
  it("detects actionable quality problems without a published-incomplete rule", () => {
    const result = analyzeProjectData(dataset());
    const kinds = result.issues.map((issue) => issue.kind);

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
