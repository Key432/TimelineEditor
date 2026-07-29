import type { TimelineSearchMatches } from "@/features/search/types";
import type { TimelineEventSummary } from "@/features/timeline-events/types";
import type {
  HistoricalDate,
  TimelineItemSummary,
} from "@/features/timeline-items/types";

export type TimelineApproximateFilter =
  "all" | "start" | "end" | "any" | "none";
export type TimelineTriState = "all" | "yes" | "no";
export type TimelineVisibilityFilter = "all" | "visible" | "hidden";
export type TimelineFilterMode = "hide" | "dim";

export type TimelineFilters = {
  query: string;
  typeIds: string[];
  tagIds: string[];
  tagMode: "and" | "or";
  eventTypeIds: string[];
  fromYear: number | null;
  toYear: number | null;
  hasEvents: TimelineTriState;
  approximate: TimelineApproximateFilter;
  hasCustomColor: TimelineTriState;
  visibility: TimelineVisibilityFilter;
  mode: TimelineFilterMode;
};

export const DEFAULT_TIMELINE_FILTERS: TimelineFilters = {
  query: "",
  typeIds: [],
  tagIds: [],
  tagMode: "or",
  eventTypeIds: [],
  fromYear: null,
  toYear: null,
  hasEvents: "all",
  approximate: "all",
  hasCustomColor: "all",
  visibility: "all",
  mode: "hide",
};

function positiveYear(value: string | null) {
  if (!value || !/^\d+$/.test(value)) return null;
  const year = Number(value);
  return year >= 1 ? year : null;
}

export function parseTimelineFilters(params: URLSearchParams): TimelineFilters {
  const hasEvents = params.get("hasEvents");
  const hasColor = params.get("hasColor");
  const approximate = params.get("approximate");
  const visibility = params.get("visibility");
  return {
    query: params.get("q") ?? "",
    typeIds: (params.get("types") ?? "").split(",").filter(Boolean),
    tagIds: (params.get("tags") ?? "").split(",").filter(Boolean),
    tagMode: params.get("tagMode") === "and" ? "and" : "or",
    eventTypeIds: (params.get("eventTypes") ?? "").split(",").filter(Boolean),
    fromYear: positiveYear(params.get("from")),
    toYear: positiveYear(params.get("to")),
    hasEvents:
      hasEvents === "true" ? "yes" : hasEvents === "false" ? "no" : "all",
    approximate:
      approximate === "start" ||
      approximate === "end" ||
      approximate === "any" ||
      approximate === "none"
        ? approximate
        : "all",
    hasCustomColor:
      hasColor === "true" ? "yes" : hasColor === "false" ? "no" : "all",
    visibility:
      visibility === "visible" || visibility === "hidden" ? visibility : "all",
    mode: params.get("filterMode") === "dim" ? "dim" : "hide",
  };
}

export function writeTimelineFilters(
  params: URLSearchParams,
  filters: TimelineFilters,
) {
  const next = new URLSearchParams(params);
  const values: Record<string, string | null> = {
    q: filters.query.trim() || null,
    types: filters.typeIds.length > 0 ? filters.typeIds.join(",") : null,
    tags: filters.tagIds.length > 0 ? filters.tagIds.join(",") : null,
    tagMode:
      filters.tagIds.length > 1 && filters.tagMode === "and" ? "and" : null,
    eventTypes:
      filters.eventTypeIds.length > 0 ? filters.eventTypeIds.join(",") : null,
    from: filters.fromYear ? String(filters.fromYear) : null,
    to: filters.toYear ? String(filters.toYear) : null,
    hasEvents:
      filters.hasEvents === "all" ? null : String(filters.hasEvents === "yes"),
    approximate: filters.approximate === "all" ? null : filters.approximate,
    hasColor:
      filters.hasCustomColor === "all"
        ? null
        : String(filters.hasCustomColor === "yes"),
    visibility: filters.visibility === "all" ? null : filters.visibility,
    filterMode: filters.mode === "hide" ? null : filters.mode,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  return next;
}

export function hasActiveTimelineFilters(filters: TimelineFilters) {
  return (
    filters.query.trim().length > 0 ||
    filters.typeIds.length > 0 ||
    filters.tagIds.length > 0 ||
    filters.eventTypeIds.length > 0 ||
    filters.fromYear !== null ||
    filters.toYear !== null ||
    filters.hasEvents !== "all" ||
    filters.approximate !== "all" ||
    filters.hasCustomColor !== "all" ||
    filters.visibility !== "all"
  );
}

function itemYears(
  item: TimelineItemSummary,
  currentDate: HistoricalDate,
  uncertaintyYears: number,
) {
  if (item.temporalType === "point") {
    return { start: item.point!.year, end: item.point!.year };
  }
  const start = item.start!.year;
  if (item.endDateStatus === "specified") {
    return { start, end: item.end!.year };
  }
  if (item.endDateStatus === "ongoing") {
    return { start, end: currentDate.year };
  }
  return {
    start,
    end:
      (item.lastConfirmed?.year ?? start) +
      (item.endUncertaintyYears ?? uncertaintyYears),
  };
}

export function filterTimelineItems({
  items,
  events,
  filters,
  matches,
  currentDate,
  uncertaintyYears,
}: {
  items: TimelineItemSummary[];
  events: TimelineEventSummary[];
  filters: TimelineFilters;
  matches: TimelineSearchMatches;
  currentDate: HistoricalDate;
  uncertaintyYears: number;
}) {
  const eventsByParent = new Map<string, TimelineEventSummary[]>();
  for (const event of events) {
    const current = eventsByParent.get(event.timelineItemId) ?? [];
    current.push(event);
    eventsByParent.set(event.timelineItemId, current);
  }
  const matchingItems = new Set(matches.itemIds);
  const matchingEvents = new Set(matches.eventIds);
  const hasQuery = filters.query.trim().length > 0;
  const matchedIds = new Set<string>();
  const visibleEventIds = new Set<string>();

  for (const item of items) {
    const childEvents = eventsByParent.get(item.id) ?? [];
    const years = itemYears(item, currentDate, uncertaintyYears);
    const approximateStart =
      item.temporalType === "point"
        ? item.isPointApproximate
        : item.isStartApproximate;
    const approximateEnd =
      item.temporalType === "range" && item.isEndApproximate;
    const approximateAny =
      approximateStart ||
      approximateEnd ||
      childEvents.some((event) => event.isApproximate);
    const keywordMatches =
      !hasQuery ||
      matchingItems.has(item.id) ||
      childEvents.some((event) => matchingEvents.has(event.id));
    const typeMatches =
      filters.typeIds.length === 0 || filters.typeIds.includes(item.typeId);
    const entityTagIds = new Set([
      ...(item.tags ?? []).map((tag) => tag.id),
      ...childEvents.flatMap((event) =>
        (event.tags ?? []).map((tag) => tag.id),
      ),
    ]);
    const tagMatches =
      filters.tagIds.length === 0 ||
      (filters.tagMode === "and"
        ? filters.tagIds.every((id) => entityTagIds.has(id))
        : filters.tagIds.some((id) => entityTagIds.has(id)));
    const eventTypeMatches =
      filters.eventTypeIds.length === 0 ||
      childEvents.some(
        (event) =>
          event.eventTypeId && filters.eventTypeIds.includes(event.eventTypeId),
      );
    const rangeMatches =
      (filters.fromYear === null || years.end >= filters.fromYear) &&
      (filters.toYear === null || years.start <= filters.toYear);
    const eventMatches =
      filters.hasEvents === "all" ||
      (filters.hasEvents === "yes" && childEvents.length > 0) ||
      (filters.hasEvents === "no" && childEvents.length === 0);
    const approximateMatches =
      filters.approximate === "all" ||
      (filters.approximate === "start" && approximateStart) ||
      (filters.approximate === "end" && approximateEnd) ||
      (filters.approximate === "any" && approximateAny) ||
      (filters.approximate === "none" && !approximateAny);
    const colorMatches =
      filters.hasCustomColor === "all" ||
      (filters.hasCustomColor === "yes" && item.colorOverride !== null) ||
      (filters.hasCustomColor === "no" && item.colorOverride === null);
    const visibilityMatches =
      filters.visibility === "all" ||
      (filters.visibility === "visible" && item.isVisible) ||
      (filters.visibility === "hidden" && !item.isVisible);

    if (
      keywordMatches &&
      typeMatches &&
      tagMatches &&
      eventTypeMatches &&
      rangeMatches &&
      eventMatches &&
      approximateMatches &&
      colorMatches &&
      visibilityMatches
    ) {
      matchedIds.add(item.id);
      for (const event of childEvents) {
        const eventTags = new Set([
          ...(item.tags ?? []).map((tag) => tag.id),
          ...(event.tags ?? []).map((tag) => tag.id),
        ]);
        const eventTagMatches =
          filters.tagIds.length === 0 ||
          (filters.tagMode === "and"
            ? filters.tagIds.every((id) => eventTags.has(id))
            : filters.tagIds.some((id) => eventTags.has(id)));
        const eventKindMatches =
          filters.eventTypeIds.length === 0 ||
          Boolean(
            event.eventTypeId &&
            filters.eventTypeIds.includes(event.eventTypeId),
          );
        const eventKeywordMatches =
          !hasQuery ||
          matchingItems.has(item.id) ||
          matchingEvents.has(event.id);
        if (eventTagMatches && eventKindMatches && eventKeywordMatches)
          visibleEventIds.add(event.id);
      }
    }
  }

  return { matchedIds, matchingEventIds: matchingEvents, visibleEventIds };
}
