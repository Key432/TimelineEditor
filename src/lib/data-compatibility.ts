export const DATA_COMPATIBILITY_BASELINE = {
  database: {
    version: 5,
    migration: "20260729153613_phase_l10_event_multiple_parents.sql",
  },
  json: { version: 5 },
  csv: { version: 5 },
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
