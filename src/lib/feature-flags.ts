export const FEATURE_FLAG_NAMES = [
  "historicalDateModelV2",
  "timelineNavigationV2",
  "unifiedDetailEditor",
  "revisionHistory",
  "autosave",
  "multipleEventParents",
  "draftPublicSnapshots",
] as const;

export type FeatureFlagName = (typeof FEATURE_FLAG_NAMES)[number];
export type FeatureFlags = Readonly<Record<FeatureFlagName, boolean>>;

const featureFlagNameSet = new Set<string>(FEATURE_FLAG_NAMES);

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = Object.freeze(
  Object.fromEntries(FEATURE_FLAG_NAMES.map((name) => [name, false])) as Record<
    FeatureFlagName,
    boolean
  >,
);

export function parseFeatureFlagOverrides(value: string | undefined) {
  const overrides: Partial<Record<FeatureFlagName, boolean>> = {};
  if (!value?.trim()) return overrides;

  for (const token of value.split(",")) {
    const normalized = token.trim();
    if (!normalized) continue;
    const enabled = !normalized.startsWith("-");
    const name = enabled ? normalized : normalized.slice(1);
    if (!featureFlagNameSet.has(name)) {
      throw new Error(`Unknown feature flag: ${name}`);
    }
    overrides[name as FeatureFlagName] = enabled;
  }
  return overrides;
}

export function resolveFeatureFlags(
  value: string | undefined = process.env.FEATURE_FLAGS,
): FeatureFlags {
  return Object.freeze({
    ...DEFAULT_FEATURE_FLAGS,
    ...parseFeatureFlagOverrides(value),
  });
}

export function isFeatureEnabled(
  name: FeatureFlagName,
  flags: FeatureFlags = resolveFeatureFlags(),
) {
  return flags[name];
}
