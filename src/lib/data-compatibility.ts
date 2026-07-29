export const DATA_COMPATIBILITY_BASELINE = {
  database: {
    version: 4,
    migration: "20260729092730_phase_l9_classification_custom_fields.sql",
  },
  json: { version: 4 },
  csv: { version: 4 },
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
