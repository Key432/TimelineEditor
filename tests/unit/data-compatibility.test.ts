import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  entityReferenceKey,
  resolveEntityReference,
  UNAVAILABLE_ENTITY_LABEL,
} from "@/features/entities/reference";
import { DATA_COMPATIBILITY_BASELINE } from "@/lib/data-compatibility";
import {
  assertRetentionPolicy,
  enforceRetentionPolicy,
  HISTORY_RETENTION_DEFAULTS,
  PUBLIC_SNAPSHOT_RETENTION_DEFAULTS,
} from "@/lib/data-retention";
import {
  DEFAULT_FEATURE_FLAGS,
  parseFeatureFlagOverrides,
  resolveFeatureFlags,
} from "@/lib/feature-flags";

const itemReference = {
  type: "timelineItem" as const,
  id: "11111111-1111-4111-8111-111111111111",
};

describe("data compatibility foundations", () => {
  it("pins the database and import/export baseline versions", () => {
    expect(DATA_COMPATIBILITY_BASELINE).toEqual({
      database: {
        version: 3,
        migration: "20260728131644_phase_l6_internal_links_aliases.sql",
      },
      json: { version: 3 },
      csv: { version: 3 },
    });

    const migrations = join(process.cwd(), "supabase", "migrations");
    expect(
      readFileSync(
        join(migrations, DATA_COMPATIBILITY_BASELINE.database.migration),
        "utf8",
      ),
    ).toContain("create function public.import_project_data(");
    expect(
      readFileSync(
        join(migrations, "20260726142840_phase_l0_data_compatibility.sql"),
        "utf8",
      ),
    ).toContain("'level-up-baseline'");
    const baselineMigration = readFileSync(
      join(migrations, "20260726142840_phase_l0_data_compatibility.sql"),
      "utf8",
    );
    expect(baselineMigration).not.toMatch(
      /(?:alter|update|delete from)\s+public\./i,
    );
  });

  it("uses one reference shape for items and events", () => {
    expect(entityReferenceKey(itemReference)).toBe(
      "timelineItem:11111111-1111-4111-8111-111111111111",
    );
    expect(
      entityReferenceKey({
        type: "timelineEvent",
        id: "22222222-2222-4222-8222-222222222222",
      }),
    ).toBe("timelineEvent:22222222-2222-4222-8222-222222222222");
  });

  it.each(["deleted", "forbidden", "missing"] as const)(
    "normalizes %s references without leaking their cause",
    async (status) => {
      await expect(
        resolveEntityReference(itemReference, () => ({ status })),
      ).resolves.toEqual({
        status: "unavailable",
        reference: itemReference,
      });
      expect(UNAVAILABLE_ENTITY_LABEL).toBe("参照先を表示できません");
    },
  );

  it("returns accessible references and rejects malformed IDs", async () => {
    await expect(
      resolveEntityReference(itemReference, () => ({
        status: "found",
        entity: { title: "夏目漱石" },
      })),
    ).resolves.toMatchObject({
      status: "resolved",
      entity: { title: "夏目漱石" },
    });
    await expect(
      resolveEntityReference({ ...itemReference, id: "invalid" }, () => ({
        status: "missing",
      })),
    ).rejects.toThrow();
  });

  it("keeps feature flags off by default and supports explicit overrides", () => {
    expect(Object.values(DEFAULT_FEATURE_FLAGS).every((value) => !value)).toBe(
      true,
    );
    expect(
      resolveFeatureFlags(
        "historicalDateModelV2,autosave,-historicalDateModelV2",
      ),
    ).toMatchObject({
      historicalDateModelV2: false,
      autosave: true,
    });
    expect(() => parseFeatureFlagOverrides("typoFlag")).toThrow(
      "Unknown feature flag",
    );
  });

  it("requires each retention area to declare its mandatory bounds", () => {
    expect(() => assertRetentionPolicy("history", {})).toThrow("maxAgeMs");
    expect(() => assertRetentionPolicy("trash", {})).toThrow("maxAgeMs");
    expect(() => assertRetentionPolicy("publicSnapshots", {})).toThrow(
      "maxEntriesPerGroup",
    );
    expect(() =>
      assertRetentionPolicy("history", HISTORY_RETENTION_DEFAULTS),
    ).not.toThrow();
    expect(() =>
      assertRetentionPolicy(
        "publicSnapshots",
        PUBLIC_SNAPSHOT_RETENTION_DEFAULTS,
      ),
    ).not.toThrow();
  });

  it("evicts old and oversized automatic records while preserving protected ones", () => {
    const now = Date.parse("2026-07-26T00:00:00.000Z");
    const result = enforceRetentionPolicy(
      [
        {
          id: "new",
          groupKey: "item-1",
          createdAt: "2026-07-25T00:00:00.000Z",
          sizeBytes: 8,
        },
        {
          id: "protected",
          groupKey: "item-1",
          createdAt: "2025-01-01T00:00:00.000Z",
          sizeBytes: 8,
          isProtected: true,
        },
        {
          id: "old",
          groupKey: "item-1",
          createdAt: "2025-01-02T00:00:00.000Z",
          sizeBytes: 8,
        },
      ],
      {
        maxAgeMs: 90 * 24 * 60 * 60 * 1000,
        maxEntriesPerGroup: 2,
        maxBytes: 16,
        preserveProtected: true,
      },
      now,
    );

    expect(result.kept.map((record) => record.id)).toEqual([
      "new",
      "protected",
    ]);
    expect(result.removed.map((record) => record.id)).toEqual(["old"]);
    expect(result.retainedBytes).toBe(16);
  });
});
