import type {
  InternalLinkCandidate,
  InternalLinkEntityType,
  ResolvedInternalLink,
} from "@/features/internal-links/types";

async function get<T>(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("内部リンク情報を取得できませんでした。");
  return (await response.json()) as T;
}

export async function getInternalLinkCandidates(
  projectId: string,
  query: string,
) {
  const result = await get<{ candidates: InternalLinkCandidate[] }>(
    `/api/projects/${projectId}/internal-links?q=${encodeURIComponent(query)}`,
  );
  return result.candidates;
}

export async function resolveInternalLinks(
  projectId: string,
  itemIds: string[],
  eventIds: string[],
) {
  const search = new URLSearchParams({
    items: itemIds.join(","),
    events: eventIds.join(","),
  });
  const result = await get<{ targets: ResolvedInternalLink[] }>(
    `/api/projects/${projectId}/internal-links?${search}`,
  );
  return result.targets;
}

export async function getInternalLinkReferenceCount(
  projectId: string,
  entityType: InternalLinkEntityType,
  entityId: string,
) {
  const search = new URLSearchParams({
    targetType: entityType,
    targetId: entityId,
  });
  const result = await get<{ referenceCount: number }>(
    `/api/projects/${projectId}/internal-links?${search}`,
  );
  return result.referenceCount;
}
