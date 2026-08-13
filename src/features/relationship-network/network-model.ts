import type { EntityRelationship } from "@/features/relationships/types";
import { relationshipEndpointKey } from "@/features/relationships/routing";
import { astronomicalYear } from "@/features/timeline-items/historical-date";
import type { TimelineEventSummary } from "@/features/timeline-events/types";
import type { TimelineItemSummary } from "@/features/timeline-items/types";
import type { TimelineFilters } from "@/features/timeline-items/timeline-filters";

export const NETWORK_INITIAL_NODE_LIMIT = 160;

export type NetworkEntityNode = {
  id: string;
  entityType: "timeline_item" | "timeline_event";
  entityId: string;
  title: string;
  typeKey: string;
  typeId: string | null;
  typeLabel: string;
  color: string;
  tagIds: string[];
  tagLabels: string[];
  startYear: number;
  endYear: number;
  kind: "entity";
};

export type NetworkClusterNode = {
  id: string;
  title: string;
  typeKey: string;
  typeId: string | null;
  typeLabel: string;
  color: string;
  count: number;
  entityIds: string[];
  kind: "cluster";
};

export type NetworkNode = NetworkEntityNode | NetworkClusterNode;

export type NetworkEdge = EntityRelationship & {
  source: string;
  target: string;
};

export type NetworkFilters = {
  query: string;
  typeKeys: string[];
  tagIds: string[];
  relationTypes: string[];
  fromYear: number | null;
  toYear: number | null;
};

export const EMPTY_NETWORK_FILTERS: NetworkFilters = {
  query: "",
  typeKeys: [],
  tagIds: [],
  relationTypes: [],
  fromYear: null,
  toYear: null,
};

function signedYear(date: { era?: "ce" | "bce"; year: number } | null) {
  return date ? astronomicalYear(date.era ?? "ce", date.year) : 1;
}

export function networkTypeKey(kind: "item" | "event", id: string | null) {
  return `${kind}:${id ?? "none"}`;
}

export function networkFiltersFromTimeline(
  filters: Pick<
    TimelineFilters,
    "query" | "typeIds" | "eventTypeIds" | "tagIds" | "fromYear" | "toYear"
  >,
): NetworkFilters {
  return {
    ...EMPTY_NETWORK_FILTERS,
    query: filters.query,
    typeKeys: [
      ...filters.typeIds.map((id) => networkTypeKey("item", id)),
      ...filters.eventTypeIds.map((id) => networkTypeKey("event", id)),
    ],
    tagIds: filters.tagIds,
    fromYear: filters.fromYear,
    toYear: filters.toYear,
  };
}

export function buildNetworkNodes(
  items: TimelineItemSummary[],
  events: TimelineEventSummary[],
): NetworkEntityNode[] {
  return [
    ...items.map((item): NetworkEntityNode => {
      const start = item.temporalType === "point" ? item.point : item.start;
      const end =
        item.temporalType === "point"
          ? item.point
          : item.endDateStatus === "specified"
            ? item.end
            : (item.lastConfirmed ?? item.start);
      return {
        id: relationshipEndpointKey("timeline_item", item.id),
        entityType: "timeline_item",
        entityId: item.id,
        title: item.title,
        typeKey: networkTypeKey("item", item.typeId),
        typeId: item.typeId,
        typeLabel: item.itemType.name,
        color: item.colorOverride ?? item.itemType.defaultColor,
        tagIds: (item.tags ?? []).map((tag) => tag.id),
        tagLabels: (item.tags ?? []).map((tag) => tag.name),
        startYear: signedYear(start),
        endYear: signedYear(end),
        kind: "entity",
      };
    }),
    ...events.map((event): NetworkEntityNode => ({
      id: relationshipEndpointKey("timeline_event", event.id),
      entityType: "timeline_event",
      entityId: event.id,
      title: event.title,
      typeKey: networkTypeKey("event", event.eventTypeId ?? null),
      typeId: event.eventTypeId ?? null,
      typeLabel: event.eventType?.name ?? "種別なしイベント",
      color: event.eventType?.color ?? "#6B7280",
      tagIds: (event.tags ?? []).map((tag) => tag.id),
      tagLabels: (event.tags ?? []).map((tag) => tag.name),
      startYear: signedYear(event.date),
      endYear: signedYear(event.date),
      kind: "entity",
    })),
  ];
}

export function buildNetworkEdges(
  relationships: EntityRelationship[],
): NetworkEdge[] {
  return relationships.map((relationship) => ({
    ...relationship,
    source: relationshipEndpointKey(
      relationship.sourceType,
      relationship.sourceId,
    ),
    target: relationshipEndpointKey(
      relationship.targetType,
      relationship.targetId,
    ),
  }));
}

export function filterNetwork(
  nodes: NetworkEntityNode[],
  edges: NetworkEdge[],
  filters: NetworkFilters,
) {
  const query = filters.query.trim().toLocaleLowerCase("ja");
  const nodeIds = new Set(
    nodes
      .filter((node) => {
        if (
          query &&
          ![node.title, node.typeLabel, ...node.tagLabels].some((value) =>
            value.toLocaleLowerCase("ja").includes(query),
          )
        )
          return false;
        if (
          filters.typeKeys.length > 0 &&
          !filters.typeKeys.includes(node.typeKey)
        )
          return false;
        if (
          filters.tagIds.length > 0 &&
          !filters.tagIds.every((id) => node.tagIds.includes(id))
        )
          return false;
        if (filters.fromYear !== null && node.endYear < filters.fromYear)
          return false;
        if (filters.toYear !== null && node.startYear > filters.toYear)
          return false;
        return true;
      })
      .map((node) => node.id),
  );
  let filteredEdges = edges.filter(
    (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
  );
  if (filters.relationTypes.length > 0) {
    filteredEdges = filteredEdges.filter((edge) =>
      filters.relationTypes.includes(edge.relationType),
    );
    const relatedIds = new Set(
      filteredEdges.flatMap((edge) => [edge.source, edge.target]),
    );
    for (const id of nodeIds) if (!relatedIds.has(id)) nodeIds.delete(id);
  }
  return {
    nodes: nodes.filter((node) => nodeIds.has(node.id)),
    edges: filteredEdges,
  };
}

export function networkNeighborhood(
  selectedId: string | null,
  edges: NetworkEdge[],
) {
  const direct = new Set<string>();
  const second = new Set<string>();
  if (!selectedId) return { direct, second };
  for (const edge of edges) {
    if (edge.source === selectedId) direct.add(edge.target);
    if (edge.target === selectedId) direct.add(edge.source);
  }
  for (const edge of edges) {
    if (direct.has(edge.source) && edge.target !== selectedId)
      second.add(edge.target);
    if (direct.has(edge.target) && edge.source !== selectedId)
      second.add(edge.source);
  }
  for (const id of direct) second.delete(id);
  return { direct, second };
}

export function stageNetwork(
  nodes: NetworkEntityNode[],
  edges: NetworkEdge[],
  expansionSteps: ReadonlyMap<string, number>,
  limit = NETWORK_INITIAL_NODE_LIMIT,
) {
  if (nodes.length <= limit)
    return { nodes: nodes as NetworkNode[], edges, hiddenCount: 0 };

  const degree = new Map<string, number>();
  for (const edge of edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }
  const ranked = [...nodes].sort(
    (a, b) =>
      (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) ||
      a.title.localeCompare(b.title, "ja") ||
      a.id.localeCompare(b.id),
  );
  const shownIds = new Set(ranked.slice(0, limit).map((node) => node.id));
  for (const [typeKey, steps] of expansionSteps) {
    const extraLimit = Math.max(0, steps) * limit;
    let added = 0;
    for (const node of ranked) {
      if (added >= extraLimit) break;
      if (node.typeKey !== typeKey || shownIds.has(node.id)) continue;
      shownIds.add(node.id);
      added += 1;
    }
  }
  const shown = nodes.filter((node) => shownIds.has(node.id));
  const hidden = nodes.filter((node) => !shownIds.has(node.id));
  const clusters = new Map<string, NetworkClusterNode>();
  for (const node of hidden) {
    const existing = clusters.get(node.typeKey);
    if (existing) {
      existing.count += 1;
      existing.entityIds.push(node.id);
    } else {
      clusters.set(node.typeKey, {
        id: `cluster:${node.typeKey}`,
        title: `${node.typeLabel}（残り${1}件）`,
        typeKey: node.typeKey,
        typeId: node.typeId,
        typeLabel: node.typeLabel,
        color: node.color,
        count: 1,
        entityIds: [node.id],
        kind: "cluster",
      });
    }
  }
  for (const cluster of clusters.values())
    cluster.title = `${cluster.typeLabel}（残り${cluster.count}件）`;
  return {
    nodes: [...shown, ...clusters.values()] as NetworkNode[],
    edges: edges.filter(
      (edge) => shownIds.has(edge.source) && shownIds.has(edge.target),
    ),
    hiddenCount: hidden.length,
  };
}
