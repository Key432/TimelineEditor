export type RetentionArea = "history" | "trash" | "publicSnapshots";

export type RetentionPolicy = {
  maxAgeMs?: number;
  maxEntriesPerGroup?: number;
  maxBytes?: number;
  preserveProtected?: boolean;
};

export type RetainedRecord = {
  id: string;
  groupKey: string;
  createdAt: string;
  sizeBytes: number;
  isProtected?: boolean;
};

export const HISTORY_RETENTION_DEFAULTS = Object.freeze({
  maxAgeMs: 90 * 24 * 60 * 60 * 1000,
  maxEntriesPerGroup: 20,
  maxBytes: 25 * 1024 * 1024,
  preserveProtected: true,
}) satisfies RetentionPolicy;

export const PUBLIC_SNAPSHOT_RETENTION_DEFAULTS = Object.freeze({
  // The current publication plus at most one previous generation.
  maxEntriesPerGroup: 2,
  preserveProtected: false,
}) satisfies RetentionPolicy;

const requiredLimits: Record<RetentionArea, (keyof RetentionPolicy)[]> = {
  history: ["maxAgeMs", "maxEntriesPerGroup", "maxBytes"],
  trash: ["maxAgeMs"],
  publicSnapshots: ["maxEntriesPerGroup"],
};

export function assertRetentionPolicy(
  area: RetentionArea,
  policy: RetentionPolicy,
) {
  for (const key of requiredLimits[area]) {
    const value = policy[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new Error(
        `${area} retention policy requires a non-negative ${key}.`,
      );
    }
  }
}

export function enforceRetentionPolicy(
  records: readonly RetainedRecord[],
  policy: RetentionPolicy,
  now = Date.now(),
) {
  const newestFirst = [...records].sort((left, right) => {
    if (policy.preserveProtected && left.isProtected !== right.isProtected) {
      return left.isProtected ? -1 : 1;
    }
    return (
      Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
      left.id.localeCompare(right.id)
    );
  });
  const kept: RetainedRecord[] = [];
  const removed: RetainedRecord[] = [];
  const retainedByGroup = new Map<string, number>();
  let retainedBytes = 0;

  for (const record of newestFirst) {
    const protectedRecord = policy.preserveProtected && record.isProtected;
    const tooOld =
      policy.maxAgeMs !== undefined &&
      now - Date.parse(record.createdAt) > policy.maxAgeMs;
    const tooMany =
      policy.maxEntriesPerGroup !== undefined &&
      (retainedByGroup.get(record.groupKey) ?? 0) >= policy.maxEntriesPerGroup;
    const tooLarge =
      policy.maxBytes !== undefined &&
      retainedBytes + record.sizeBytes > policy.maxBytes;

    if ((!protectedRecord && tooOld) || tooMany || tooLarge) {
      removed.push(record);
      continue;
    }
    kept.push(record);
    retainedBytes += record.sizeBytes;
    retainedByGroup.set(
      record.groupKey,
      (retainedByGroup.get(record.groupKey) ?? 0) + 1,
    );
  }

  kept.sort(
    (left, right) =>
      Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
      left.id.localeCompare(right.id),
  );
  removed.sort(
    (left, right) =>
      Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
      left.id.localeCompare(right.id),
  );
  return { kept, removed, retainedBytes };
}
