"use client";

import { useQuery } from "@tanstack/react-query";

import {
  backgroundLayerKeys,
  listBackgroundLayers,
} from "@/features/background-layers/api";
import type { TimelineBackgroundLayer } from "@/features/background-layers/types";
import { itemTypeKeys, listItemTypes } from "@/features/item-types/api";
import type { TimelineItemType } from "@/features/item-types/types";
import {
  listRelationships,
  relationshipKeys,
} from "@/features/relationships/api";
import type { RelationshipDataset } from "@/features/relationships/types";
import {
  listTimelineEvents,
  timelineEventKeys,
} from "@/features/timeline-events/api";
import type { TimelineEventSummary } from "@/features/timeline-events/types";
import {
  listTimelineItems,
  timelineItemKeys,
} from "@/features/timeline-items/api";
import type { TimelineItemSummary } from "@/features/timeline-items/types";

const EMPTY_RELATIONSHIPS: RelationshipDataset = {
  relationships: [],
  entities: [],
};

export function useTimelineWorkspaceData({
  projectId,
  initialItems,
  initialEvents,
  initialItemTypes,
  initialBackgroundLayers,
  initialRelationships,
  remote = true,
}: {
  projectId: string;
  initialItems: TimelineItemSummary[];
  initialEvents?: TimelineEventSummary[];
  initialItemTypes: TimelineItemType[];
  initialBackgroundLayers?: TimelineBackgroundLayer[];
  initialRelationships?: RelationshipDataset;
  remote?: boolean;
}) {
  const itemsQuery = useQuery({
    queryKey: timelineItemKeys.list(projectId),
    queryFn: () => listTimelineItems(projectId),
    initialData: initialItems,
    enabled: remote,
  });
  const eventsQuery = useQuery({
    queryKey: timelineEventKeys.list(projectId),
    queryFn: () => listTimelineEvents(projectId),
    initialData: initialEvents,
    enabled: remote,
  });
  const itemTypesQuery = useQuery({
    queryKey: itemTypeKeys.list(projectId),
    queryFn: () => listItemTypes(projectId),
    initialData: initialItemTypes,
    enabled: remote,
  });
  const backgroundLayersQuery = useQuery({
    queryKey: backgroundLayerKeys.list(projectId),
    queryFn: () => listBackgroundLayers(projectId),
    initialData: initialBackgroundLayers,
    enabled: remote,
  });
  const relationshipsQuery = useQuery({
    queryKey: relationshipKeys.all(projectId),
    queryFn: () => listRelationships(projectId),
    initialData: initialRelationships,
    enabled: remote,
  });
  const supplementalQueries = [
    eventsQuery,
    backgroundLayersQuery,
    relationshipsQuery,
  ];

  return {
    items: remote ? (itemsQuery.data ?? initialItems) : initialItems,
    events: remote ? (eventsQuery.data ?? []) : (initialEvents ?? []),
    itemTypes: remote
      ? (itemTypesQuery.data ?? initialItemTypes)
      : initialItemTypes,
    backgroundLayers: remote
      ? (backgroundLayersQuery.data ?? [])
      : (initialBackgroundLayers ?? []),
    relationships: remote
      ? (relationshipsQuery.data ?? EMPTY_RELATIONSHIPS)
      : (initialRelationships ?? EMPTY_RELATIONSHIPS),
    isSupplementalLoading:
      remote &&
      supplementalQueries.some(
        (query) => query.data === undefined && query.isPending,
      ),
    supplementalError: remote
      ? supplementalQueries.find((query) => query.error)?.error
      : undefined,
  };
}
