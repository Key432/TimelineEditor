export const DATA_COMPATIBILITY_BASELINE = {
  database: {
    version: 1,
    migration: "20260726112629_optimize_timeline_item_dates.sql",
  },
  json: { version: 1 },
  csv: { version: 1 },
} as const;

export const LEGACY_UNVERSIONED_SCHEMA_VERSION = 0 as const;

export type VersionedDataFormat = "json" | "csv";

export function unsupportedSchemaVersionMessage(
  format: VersionedDataFormat,
  version: number,
) {
  const current = DATA_COMPATIBILITY_BASELINE[format].version;
  return `${format.toUpperCase()}スキーマバージョン${version}には対応していません。対応する最新バージョンは${current}です。`;
}
