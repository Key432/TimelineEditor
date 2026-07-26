import { describe, expect, it } from "vitest";

import {
  createCsvArchive,
  csvArchiveFileName,
  jsonExportFileName,
  parseCsvImport,
} from "@/features/import-export/csv";
import {
  previewBackup,
  type ProjectBackup,
} from "@/features/import-export/schema";
import { createDeflatedZip, readStoredZip } from "@/features/import-export/zip";

const typeId = "11111111-1111-4111-8111-111111111111";
const itemId = "22222222-2222-4222-8222-222222222222";
const eventId = "33333333-3333-4333-8333-333333333333";

function backup(): ProjectBackup {
  return {
    schemaVersion: 1,
    appVersion: "0.1.0",
    exportedAt: "2026-07-26T00:00:00.000Z",
    project: {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      name: "往復テスト",
      description: "説明",
      visibility: "private",
      publicId: null,
      publishedAt: null,
    },
    settings: {
      defaultUncertaintyYears: 5,
      initialStartYear: 1800,
      initialEndYear: 2026,
      initialZoomPreset: "fit-range",
      timelineDensity: "comfortable",
      minimumTimeUnit: "day",
    },
    itemTypes: [
      {
        id: typeId,
        name: "人物",
        defaultColor: "#2878B5",
        icon: "user-round",
        sortOrder: 0,
        isVisible: true,
      },
    ],
    timelineItems: [
      {
        id: itemId,
        typeId,
        title: '夏目漱石, "作家"',
        description: "改行\nを含む",
        sourceText: null,
        externalUrl: null,
        temporalType: "range",
        colorOverride: null,
        manualOrder: 0,
        isVisible: true,
        start: { year: 1867, month: 2, day: 9 },
        isStartApproximate: false,
        startUncertaintyYears: null,
        endDateStatus: "specified",
        end: { year: 1916, month: 12, day: 9 },
        isEndApproximate: false,
        endUncertaintyYears: null,
        lastConfirmed: null,
        point: null,
        isPointApproximate: false,
      },
    ],
    timelineEvents: [
      {
        id: eventId,
        timelineItemId: itemId,
        title: "吾輩は猫である",
        date: { year: 1905, month: 1, day: null },
        isApproximate: false,
        description: null,
        sourceText: null,
        externalUrl: null,
      },
    ],
  };
}

describe("project import and export formats", () => {
  it("validates a versioned JSON backup and rejects broken relationships", () => {
    const valid = previewBackup(backup());
    expect(valid.errors).toEqual([]);
    expect(valid.timelineEventCount).toBe(1);

    const invalid = structuredClone(backup());
    invalid.timelineEvents[0]!.timelineItemId =
      "44444444-4444-4444-8444-444444444444";
    expect(previewBackup(invalid).errors.join(" ")).toContain("親項目");
    expect(
      previewBackup({ ...backup(), schemaVersion: 99 }).errors.join(" "),
    ).toContain("Invalid input");
  });

  it("round-trips quoted UTF-8 CSV files in the documented ZIP", () => {
    const archive = createCsvArchive(backup());
    const files = readStoredZip(archive);
    expect([...files.keys()]).toEqual([
      "timeline-items.csv",
      "timeline-events.csv",
      "item-types.csv",
      "README.md",
    ]);
    expect(files.get("timeline-items.csv")).toContain('"夏目漱石, ""作家"""');

    const preview = parseCsvImport(
      archive,
      "往復テスト_2026-07-26.zip",
      backup(),
    );
    expect(preview.errors).toEqual([]);
    expect(preview.payload?.timelineItems[0]?.title).toBe('夏目漱石, "作家"');
    expect(preview.payload?.timelineItems[0]?.description).toBe("改行\nを含む");
    expect(preview.payload?.timelineEvents[0]?.timelineItemId).toBe(itemId);

    const deflated = createDeflatedZip(
      [...files].map(([name, content]) => ({ name, content })),
    );
    expect(
      parseCsvImport(deflated, "往復テスト_2026-07-26.zip", backup()).errors,
    ).toEqual([]);
  });

  it("accepts only the three exact CSV filenames and imports each section independently", () => {
    const files = readStoredZip(createCsvArchive(backup()));
    const itemPreview = parseCsvImport(
      new TextEncoder().encode(files.get("timeline-items.csv")!),
      "timeline-items.csv",
      backup(),
    );
    expect(itemPreview.errors).toEqual([]);
    expect(itemPreview.payload?.importSections).toEqual(["timelineItems"]);
    expect(itemPreview.timelineItemCount).toBe(1);
    expect(
      parseCsvImport(new Uint8Array(), "items.csv", backup()).errors.join(" "),
    ).toContain("ファイル名");
  });

  it("builds a project-name and date based ZIP filename", () => {
    expect(
      csvArchiveFileName("文学史年表", new Date("2026-07-26T00:00:00Z")),
    ).toBe("文学史年表_2026-07-26.zip");
  });

  it("builds a project-name and date based JSON filename", () => {
    expect(
      jsonExportFileName("文学史年表", new Date("2026-07-26T00:00:00Z")),
    ).toBe("文学史年表_2026-07-26.json");
  });

  it("creates a missing item type from type_name and aggregates CSV warnings", () => {
    const base = backup();
    const exported = readStoredZip(createCsvArchive(base)).get(
      "timeline-items.csv",
    )!;
    const [headers, row] = exported.trim().split("\r\n");
    const itemRow = row!.replace(`${itemId},${typeId},人物`, `,,新しい種別`);
    const input = new TextEncoder().encode(
      `${headers}\r\n${itemRow}\r\n${itemRow}\r\n`,
    );

    const preview = parseCsvImport(input, "timeline-items.csv", base);

    expect(preview.errors).toEqual([]);
    expect(preview.warnings).toEqual([
      "2件のタイムライン項目を新規作成しました。",
      "1件の対象種別を新規作成しました",
    ]);
    expect(preview.payload?.importSections).toEqual([
      "itemTypes",
      "timelineItems",
    ]);
    expect(preview.payload?.itemTypes).toEqual([
      expect.objectContaining({
        name: "新しい種別",
        defaultColor: "#00B0B0",
        sortOrder: 1,
      }),
    ]);
    expect(preview.payload?.timelineItems[0]?.typeId).toBe(
      preview.payload?.itemTypes[0]?.id,
    );
  });

  it("serializes the 1,000 item and 10,000 event performance target", () => {
    const large = backup();
    large.timelineItems = Array.from({ length: 1000 }, (_, index) => ({
      ...large.timelineItems[0]!,
      id: `${String(index).padStart(8, "0")}-0000-4000-8000-000000000000`,
      title: `項目${index}`,
      manualOrder: index,
    }));
    large.timelineEvents = Array.from({ length: 10000 }, (_, index) => ({
      ...large.timelineEvents[0]!,
      id: `${String(index).padStart(8, "0")}-0000-4000-8000-100000000000`,
      timelineItemId: large.timelineItems[index % 1000]!.id,
      title: `イベント${index}`,
    }));
    const startedAt = performance.now();
    const archive = createCsvArchive(large);
    const elapsedMs = performance.now() - startedAt;
    expect(archive.byteLength).toBeGreaterThan(1_000_000);
    expect(elapsedMs).toBeLessThan(5_000);
    expect(readStoredZip(archive).get("timeline-events.csv")).toContain(
      "イベント9999",
    );
  });
});
