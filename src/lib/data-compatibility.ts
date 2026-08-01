export const DATA_COMPATIBILITY_BASELINE = {
  database: {
    version: 6,
    migration: "20260801085852_phase_l12_background_layers.sql",
  },
  json: { version: 6 },
  csv: { version: 6 },
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
