import { describe, expect, it } from "vitest";

import { bulkEditSchema } from "@/features/table-view/bulk-validation";
import {
  duplicateRowIndexes,
  mappedValue,
  parseGenericCsv,
  rowsToCsv,
} from "@/features/table-view/generic-csv";
import {
  buildTableColumns,
  formatHistoricalDate,
  parseHistoricalDate,
  relationshipsToCsvCell,
  setCustomFieldValue,
} from "@/features/table-view/table-model";

describe("Phase L11 table model", () => {
  it("includes only relationships connected to the selected CSV entity", () => {
    const connected = {
      id: "relationship-1",
      projectId: "project",
      sourceType: "timeline_item" as const,
      sourceId: "item-1",
      targetType: "timeline_event" as const,
      targetId: "event-1",
      relationType: "師弟",
      direction: "directed" as const,
      lineStyle: "double" as const,
      sourceMarker: "none" as const,
      targetMarker: "arrow" as const,
      note: null,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    };
    const unrelated = {
      ...connected,
      id: "relationship-2",
      sourceId: "item-2",
      targetId: "event-2",
    };

    expect(
      JSON.parse(
        relationshipsToCsvCell(
          [connected, unrelated],
          "timeline_item",
          "item-1",
        ),
      ),
    ).toEqual([connected]);
  });

  it("uses the combined start/point label and adds custom properties", () => {
    const columns = buildTableColumns("timeline_item", [
      {
        id: "11111111-1111-4111-8111-111111111111",
        projectId: "project",
        entityType: "timeline_item",
        scope: "project",
        targetTypeId: null,
        name: "場所",
        fieldType: "text",
        isRequired: false,
        options: [],
        description: null,
        sortOrder: 0,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      },
    ]);
    expect(columns.find((column) => column.id === "start")?.label).toBe(
      "開始・時点日",
    );
    expect(columns.slice(0, 4).map((column) => column.label)).toEqual([
      "名称",
      "形式",
      "開始・時点日",
      "終了日",
    ]);
    expect(columns.at(-1)?.label).toBe("場所");
  });

  it("parses CE/BCE historical dates without a year zero", () => {
    expect(parseHistoricalDate("紀元前44-03-15")).toMatchObject({
      era: "bce",
      year: 44,
      month: 3,
      day: 15,
    });
    expect(formatHistoricalDate(parseHistoricalDate("2026-8")!)).toBe(
      "2026-08",
    );
    expect(parseHistoricalDate("0")).toBeNull();
    expect(parseHistoricalDate("2026--1")).toBeNull();
  });

  it("stores sparse custom values and removes empty cells", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(setCustomFieldValue([], id, "Tokyo")).toEqual([
      { fieldId: id, value: "Tokyo" },
    ]);
    expect(
      setCustomFieldValue([{ fieldId: id, value: "Tokyo" }], id, ""),
    ).toEqual([]);
  });

  it("validates bounded, unique bulk operations", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(
      bulkEditSchema.safeParse({
        entityType: "timeline_item",
        ids: [id],
        preview: false,
        operation: { kind: "set_visibility", value: false },
      }).success,
    ).toBe(true);
    expect(
      bulkEditSchema.safeParse({
        entityType: "timeline_item",
        ids: [id, id],
        operation: { kind: "delete" },
      }).success,
    ).toBe(false);
  });
});

describe("Phase L11 generic CSV", () => {
  it("parses quoted multiline cells and maps fixed values", () => {
    const table = parseGenericCsv('Name,Notes\r\nAlpha,"line 1\nline 2"');
    expect(table.rows[0]).toEqual(["Alpha", "line 1\nline 2"]);
    expect(mappedValue(table, table.rows[0]!, { title: "Name" }, "title")).toBe(
      "Alpha",
    );
    expect(mappedValue(table, table.rows[0]!, { type: "=人物" }, "type")).toBe(
      "人物",
    );
  });

  it("finds existing and within-file duplicate candidates", () => {
    const table = parseGenericCsv("Name\nAlpha\nBeta\nAlpha");
    expect(duplicateRowIndexes(table, { title: "Name" }, ["Beta"])).toEqual([
      1, 2,
    ]);
  });

  it("round-trips error rows with CSV escaping", () => {
    expect(rowsToCsv(["Name"], [["a,b"]])).toBe('Name\r\n"a,b"');
  });
});
