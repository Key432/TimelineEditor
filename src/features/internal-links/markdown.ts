import type {
  InternalLinkEntityType,
  ResolvedInternalLink,
} from "@/features/internal-links/types";

export const INTERNAL_LINK_PATTERN =
  /\[\[(item|event):([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\|([^\]\r\n]+)\]\]/gi;

export function extractInternalLinkReferences(value: string) {
  const itemIds = new Set<string>();
  const eventIds = new Set<string>();
  for (const match of value.matchAll(INTERNAL_LINK_PATTERN)) {
    (match[1]?.toLowerCase() === "item" ? itemIds : eventIds).add(match[2]!);
  }
  return { itemIds: [...itemIds], eventIds: [...eventIds] };
}

function escapeLabel(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("]", "\\]");
}

export function renderInternalLinks(
  value: string,
  resolved: ResolvedInternalLink[],
  basePath: string,
) {
  const targets = new Map(
    resolved.map((target) => [
      `${target.entityType}:${target.entityId}`,
      target,
    ]),
  );
  return value.replace(
    INTERNAL_LINK_PATTERN,
    (_token, rawType: string, id: string, displayName: string) => {
      const entityType = rawType.toLowerCase() as InternalLinkEntityType;
      const target = targets.get(`${entityType}:${id}`);
      if (!target) return `${escapeLabel(displayName)}（リンク切れ）`;
      const segment = entityType === "item" ? "items" : "events";
      return `[${escapeLabel(displayName)}](${basePath}/${segment}/${id})`;
    },
  );
}

export function internalLinkToken(
  candidate: Pick<ResolvedInternalLink, "entityType" | "entityId" | "title">,
) {
  return `[[${candidate.entityType}:${candidate.entityId}|${candidate.title.replace(/[\]\r\n|]/g, " ")}]]`;
}
