export const DATA_COMPATIBILITY_BASELINE = {
  database: {
    version: 3,
    migration: "20260728131644_phase_l6_internal_links_aliases.sql",
  },
  json: { version: 3 },
  csv: { version: 3 },
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
