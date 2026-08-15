import { describe, expect, it } from "vitest";

import {
  createLocalProject,
  localProjectBytes,
  normalizeLocalProject,
  searchLocalProject,
  updateLocalProject,
} from "@/features/local-projects/model";
import {
  localEventCreateSchema,
  localItemCreateSchema,
} from "@/features/local-projects/validation";

describe("Phase L20 local projects", () => {
  const date = (year: number, month: number | null, day: number | null) => ({
    era: "ce" as const,
    precision:
      day !== null
        ? ("day" as const)
        : month !== null
          ? ("month" as const)
          : ("year" as const),
    year,
    month,
    day,
    originalText: null,
    calendar: "proleptic_gregorian",
  });

  it("creates a schema-valid local project with local UUIDs and template types", () => {
    const project = createLocalProject({
      name: "  ローカル文学史  ",
      template: "literature",
      currentYear: 2026,
      now: new Date("2026-08-16T00:00:00.000Z"),
    });

    expect(project.backup.project).toMatchObject({
      id: project.id,
      name: "ローカル文学史",
      visibility: "private",
    });
    expect(project.backup.itemTypes.map((type) => type.name)).toContain("人物");
    expect(project.backup.settings.initialEndYear).toBe(2026);
    expect(normalizeLocalProject(project)).toEqual(project);
  });

  it("increments revisions without mutating the prior autosaved snapshot", () => {
    const project = createLocalProject({ name: "原本", template: "empty" });
    const updated = updateLocalProject(
      project,
      (backup) => ({
        ...backup,
        project: { ...backup.project, name: "更新後" },
      }),
      new Date("2026-08-16T01:00:00.000Z"),
    );

    expect(project.backup.project.name).toBe("原本");
    expect(updated.backup.project.name).toBe("更新後");
    expect(updated.revision).toBe(project.revision + 1);
    expect(localProjectBytes(updated)).toBeGreaterThan(0);
  });

  it("searches normalized item and event title, aliases, body, and sources", () => {
    const project = createLocalProject({ name: "検索", template: "empty" });
    const typeId = project.backup.itemTypes[0]!.id;
    const itemId = crypto.randomUUID();
    const eventId = crypto.randomUUID();
    project.backup.timelineItems.push({
      id: itemId,
      typeId,
      title: "夏目漱石",
      aliases: ["Natsume Soseki"],
      tagIds: [],
      customFields: [],
      description: "近代文学の作家",
      sourceText: "文学事典",
      externalUrl: null,
      temporalType: "range",
      colorOverride: null,
      manualOrder: 0,
      isVisible: true,
      start: {
        era: "ce",
        precision: "year",
        year: 1867,
        month: null,
        day: null,
        originalText: null,
        calendar: "proleptic_gregorian",
      },
      isStartApproximate: false,
      startUncertaintyYears: null,
      endDateStatus: "specified",
      end: {
        era: "ce",
        precision: "year",
        year: 1916,
        month: null,
        day: null,
        originalText: null,
        calendar: "proleptic_gregorian",
      },
      isEndApproximate: false,
      endUncertaintyYears: null,
      lastConfirmed: null,
      point: null,
      isPointApproximate: false,
    });
    project.backup.timelineEvents.push({
      id: eventId,
      timelineItemIds: [itemId],
      title: "吾輩は猫である刊行",
      aliases: [],
      eventTypeId: null,
      tagIds: [],
      customFields: [],
      date: {
        era: "ce",
        precision: "year",
        year: 1905,
        month: null,
        day: null,
        originalText: null,
        calendar: "proleptic_gregorian",
      },
      isApproximate: false,
      description: null,
      sourceText: null,
      externalUrl: null,
    });

    expect(searchLocalProject(project, "ＮＡＴＳＵＭＥ")[0]).toMatchObject({
      id: itemId,
    });
    expect(searchLocalProject(project, "猫である")[0]).toMatchObject({
      id: eventId,
    });
    expect(searchLocalProject(project, "文学事典")[0]).toMatchObject({
      id: itemId,
    });
  });

  it("keeps a 1,000 item / 10,000 event project within a practical local size", () => {
    const project = createLocalProject({
      name: "大規模年表",
      template: "empty",
    });
    const typeId = project.backup.itemTypes[0]!.id;
    const date = {
      era: "ce" as const,
      precision: "year" as const,
      year: 1900,
      month: null,
      day: null,
      originalText: null,
      calendar: "proleptic_gregorian",
    };
    project.backup.timelineItems = Array.from(
      { length: 1_000 },
      (_, index) => ({
        id: crypto.randomUUID(),
        typeId,
        title: `項目${index}`,
        aliases: [],
        tagIds: [],
        customFields: [],
        description: null,
        sourceText: null,
        externalUrl: null,
        temporalType: "range" as const,
        colorOverride: null,
        manualOrder: index,
        isVisible: true,
        start: date,
        isStartApproximate: false,
        startUncertaintyYears: null,
        endDateStatus: "ongoing" as const,
        end: null,
        isEndApproximate: false,
        endUncertaintyYears: null,
        lastConfirmed: null,
        point: null,
        isPointApproximate: false,
      }),
    );
    project.backup.timelineEvents = Array.from(
      { length: 10_000 },
      (_, index) => ({
        id: crypto.randomUUID(),
        timelineItemIds: [project.backup.timelineItems[index % 1_000]!.id],
        title: `イベント${index}`,
        aliases: [],
        eventTypeId: null,
        tagIds: [],
        customFields: [],
        date,
        isApproximate: false,
        description: index === 9_999 ? "検索対象語" : null,
        sourceText: null,
        externalUrl: null,
      }),
    );

    const bytes = localProjectBytes(project);
    expect(bytes).toBeLessThan(25 * 1024 * 1024);
    expect(searchLocalProject(project, "検索対象語")).toHaveLength(1);
  });

  it("validates year, month, and day precision without JavaScript Date conversion", () => {
    const typeId = crypto.randomUUID();
    expect(
      localItemCreateSchema.safeParse({
        title: "年月日項目",
        typeId,
        temporalType: "range",
        start: date(2026, 4, 5),
        endDateStatus: "specified",
        end: date(2026, 6, null),
        description: "",
      }).success,
    ).toBe(true);
    expect(
      localEventCreateSchema.safeParse({
        title: "不正日付",
        timelineItemIds: [crypto.randomUUID()],
        date: date(2026, 2, 30),
        description: "",
      }).success,
    ).toBe(false);
    expect(
      localItemCreateSchema.safeParse({
        title: "逆転期間",
        typeId,
        temporalType: "range",
        start: date(2026, 6, 1),
        endDateStatus: "specified",
        end: date(2026, 5, 31),
        description: "",
      }).success,
    ).toBe(false);
  });
});
