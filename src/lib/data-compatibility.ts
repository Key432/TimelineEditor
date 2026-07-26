export const DATA_COMPATIBILITY_BASELINE = {
  database: {
    version: 2,
    migration: "20260726151016_phase_l1_historical_dates.sql",
  },
  json: { version: 2 },
  csv: { version: 2 },
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
