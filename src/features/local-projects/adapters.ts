import type { TimelineItemType } from "@/features/item-types/types";
import type { LocalProjectRecord } from "@/features/local-projects/types";
import type { Project } from "@/features/projects/types";
import type { RelationshipDataset } from "@/features/relationships/types";
import type { TimelineEventSummary } from "@/features/timeline-events/types";
import type { TimelineItemSummary } from "@/features/timeline-items/types";

export function localProjectForTimeline(record: LocalProjectRecord): Project {
  return {
    ...record.backup.project,
    publicId: null,
    publishedAt: null,
    visibility: "private",
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    settings: record.backup.settings,
  };
}

export function localItemTypes(record: LocalProjectRecord): TimelineItemType[] {
  return record.backup.itemTypes.map((type) => ({
    ...type,
    projectId: record.id,
    isSystemSeed: false,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }));
}

export function localTimelineItems(
  record: LocalProjectRecord,
): TimelineItemSummary[] {
  const types = new Map(localItemTypes(record).map((type) => [type.id, type]));
  return record.backup.timelineItems.map((item) => ({
    id: item.id,
    projectId: record.id,
    typeId: item.typeId,
    itemType: types.get(item.typeId)!,
    title: item.title,
    tags: record.backup.tags
      .filter((tag) => item.tagIds.includes(tag.id))
      .map((tag) => ({
        ...tag,
        projectId: record.id,
        usageCount: 0,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      })),
    citations: [],
    temporalType: item.temporalType,
    colorOverride: item.colorOverride,
    manualOrder: item.manualOrder,
    isVisible: item.isVisible,
    start: item.start,
    isStartApproximate: item.isStartApproximate,
    startUncertaintyYears: item.startUncertaintyYears,
    endDateStatus: item.endDateStatus,
    end: item.end,
    isEndApproximate: item.isEndApproximate,
    endUncertaintyYears: item.endUncertaintyYears,
    lastConfirmed: item.lastConfirmed,
    point: item.point,
    isPointApproximate: item.isPointApproximate,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }));
}

export function localTimelineEvents(
  record: LocalProjectRecord,
): TimelineEventSummary[] {
  return record.backup.timelineEvents.map((event) => ({
    id: event.id,
    projectId: record.id,
    timelineItemIds: event.timelineItemIds,
    eventTypeId: event.eventTypeId,
    eventType: (() => {
      const type = record.backup.eventTypes.find(
        (candidate) => candidate.id === event.eventTypeId,
      );
      return type
        ? {
            ...type,
            projectId: record.id,
            usageCount: 0,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
          }
        : null;
    })(),
    tags: record.backup.tags
      .filter((tag) => event.tagIds.includes(tag.id))
      .map((tag) => ({
        ...tag,
        projectId: record.id,
        usageCount: 0,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      })),
    citations: [],
    title: event.title,
    date: event.date,
    isApproximate: event.isApproximate,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }));
}

export function localRelationships(
  record: LocalProjectRecord,
): RelationshipDataset {
  return {
    relationships: record.backup.relationships.map((relationship) => ({
      ...relationship,
      projectId: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    })),
    entities: [
      ...record.backup.timelineItems.map((item) => ({
        type: "timeline_item" as const,
        id: item.id,
        title: item.title,
      })),
      ...record.backup.timelineEvents.map((event) => ({
        type: "timeline_event" as const,
        id: event.id,
        title: event.title,
      })),
    ],
  };
}

export function localBackgroundLayers(record: LocalProjectRecord) {
  return record.backup.backgroundLayers.map((layer) => ({
    ...layer,
    projectId: record.id,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    periods: layer.periods.map((period) => ({
      ...period,
      projectId: record.id,
      layerId: layer.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    })),
  }));
}
