export const DATA_COMPATIBILITY_BASELINE = {
  database: {
    version: 7,
    migration: "20260801114508_phase_l14_semantic_relationships.sql",
  },
  json: { version: 7 },
  csv: { version: 7 },
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
