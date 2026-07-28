import { describe, expect, it } from "vitest";

import {
  createCsvArchive,
  csvArchiveFileName,
  jsonExportFileName,
  parseCsvImport,
} from "@/features/import-export/csv";
import {
  IMPORT_SCHEMA_VERSION,
  previewBackup,
  type ProjectBackup,
} from "@/features/import-export/schema";
import { createDeflatedZip, readStoredZip } from "@/features/import-export/zip";

const typeId = "11111111-1111-4111-8111-111111111111";
const itemId = "22222222-2222-4222-8222-222222222222";
const eventId = "33333333-3333-4333-8333-333333333333";

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

function backup(): ProjectBackup {
  return {
    schemaVersion: IMPORT_SCHEMA_VERSION,
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
        aliases: [],
        description: "改行\nを含む",
        sourceText: null,
        externalUrl: null,
        temporalType: "range",
        colorOverride: null,
        manualOrder: 0,
        isVisible: true,
        start: date(1867, 2, 9),
        isStartApproximate: false,
        startUncertaintyYears: null,
        endDateStatus: "specified",
        end: date(1916, 12, 9),
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
        aliases: [],
        date: date(1905, 1, null),
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
    ).toContain("対応していません");
  });

  it("migrates an unversioned legacy JSON backup to the baseline", () => {
    const legacy = structuredClone(backup()) as Record<string, unknown>;
    delete legacy.schemaVersion;

    const preview = previewBackup(legacy);

    expect(preview.errors).toEqual([]);
    expect(preview.warnings).toContain(
      "旧JSON形式をスキーマバージョン3へ移行しました。",
    );
    expect(preview.payload?.schemaVersion).toBe(IMPORT_SCHEMA_VERSION);
  });

  it("round-trips quoted UTF-8 CSV files in the documented ZIP", () => {
    const archive = createCsvArchive(backup());
    const files = readStoredZip(archive);
    expect([...files.keys()]).toEqual([
      "manifest.json",
      "timeline-items.csv",
      "timeline-events.csv",
      "item-types.csv",
      "README.md",
    ]);
    expect(JSON.parse(files.get("manifest.json")!)).toMatchObject({
      format: "timeline-editor-csv",
      schemaVersion: IMPORT_SCHEMA_VERSION,
    });
    expect(files.get("timeline-items.csv")).toContain(
      `# timeline-editor-schema-version=${IMPORT_SCHEMA_VERSION}`,
    );
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

  it("migrates a legacy CSV archive without version metadata", () => {
    const currentFiles = readStoredZip(createCsvArchive(backup()));
    const legacyFiles = [...currentFiles]
      .filter(([name]) => name !== "manifest.json")
      .map(([name, content]) => ({
        name,
        content: content.replace(
          /^\uFEFF?# timeline-editor-schema-version=3\r?\n/,
          "\uFEFF",
        ),
      }));

    const preview = parseCsvImport(
      createDeflatedZip(legacyFiles),
      "legacy.zip",
      backup(),
    );

    expect(preview.errors).toEqual([]);
    expect(preview.warnings).toContain(
      "旧CSV形式をスキーマバージョン3へ移行しました。",
    );
    expect(preview.payload?.schemaVersion).toBe(IMPORT_SCHEMA_VERSION);
  });

  it("rejects future and mixed CSV schema versions", () => {
    const files = readStoredZip(createCsvArchive(backup()));
    const future = new TextEncoder().encode(
      files
        .get("timeline-items.csv")!
        .replace(
          "# timeline-editor-schema-version=3",
          "# timeline-editor-schema-version=99",
        ),
    );
    expect(
      parseCsvImport(future, "timeline-items.csv", backup()).errors.join(" "),
    ).toContain("対応していません");

    const mixed = createDeflatedZip(
      [...files].map(([name, content]) => ({
        name,
        content:
          name === "timeline-events.csv"
            ? content.replace(
                /^\uFEFF?# timeline-editor-schema-version=3\r?\n/,
                "\uFEFF",
              )
            : content,
      })),
    );
    expect(
      parseCsvImport(mixed, "mixed.zip", backup()).errors.join(" "),
    ).toContain("一致しません");
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
    const [versionHeader, headers, row] = exported.trim().split("\r\n");
    const itemRow = row!.replace(`${itemId},${typeId},人物`, `,,新しい種別`);
    const input = new TextEncoder().encode(
      `${versionHeader}\r\n${headers}\r\n${itemRow}\r\n${itemRow}\r\n`,
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
