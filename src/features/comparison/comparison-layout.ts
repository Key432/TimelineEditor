import type { Project } from "@/features/projects/types";
import type { TimelineEventSummary } from "@/features/timeline-events/types";
import { historicalDateOrdinal } from "@/features/timeline-items/historical-date";
import {
  expandDegenerateFitRange,
  timelineItemVisualBounds,
} from "@/features/timeline-items/timeline-math";
import type { TimelineDomain } from "@/features/timeline-items/timeline-store";
import type {
  HistoricalDate,
  TimelineItemSummary,
} from "@/features/timeline-items/types";

type ComparisonTimelineSource = {
  project: Project;
  items: TimelineItemSummary[];
  events: TimelineEventSummary[];
};

export function comparisonPaneHeight(paneCount: number) {
  return `${100 / Math.min(Math.max(paneCount, 1), 4)}%`;
}

export function replaceComparedProject(
  projectIds: string[],
  index: number,
  nextProjectId: string,
) {
  if (projectIds.includes(nextProjectId)) return projectIds;
  return projectIds.map((projectId, currentIndex) =>
    currentIndex === index ? nextProjectId : projectId,
  );
}

export function buildComparisonTimelineDomain(
  sources: ComparisonTimelineSource[],
  currentDate: HistoricalDate,
): TimelineDomain {
  const configuredStarts = sources.map(({ project }) =>
    historicalDateOrdinal({
      year: project.settings.initialStartYear,
      month: 1,
      day: 1,
    }),
  );
  const configuredEnds = sources.map(({ project }) =>
    historicalDateOrdinal(
      { year: project.settings.initialEndYear, month: 12, day: 31 },
      "end",
    ),
  );
  const itemBounds = sources.flatMap(({ project, items }) =>
    items.map((item) =>
      timelineItemVisualBounds(
        item,
        currentDate,
        project.settings.defaultUncertaintyYears,
      ),
    ),
  );
  const eventOrdinals = sources.flatMap(({ events }) =>
    events.map((event) => historicalDateOrdinal(event.date)),
  );
  const rawFitStart = Math.min(
    ...(itemBounds.length > 0
      ? itemBounds.map((bound) => bound.start)
      : configuredStarts),
    ...eventOrdinals,
  );
  const rawFitEnd = Math.max(
    ...(itemBounds.length > 0
      ? itemBounds.map((bound) => bound.end)
      : configuredEnds),
    ...eventOrdinals,
  );
  const { start: fitStart, end: fitEnd } = expandDegenerateFitRange(
    rawFitStart,
    rawFitEnd,
  );
  const margin = Math.max(366, (fitEnd - fitStart) * 0.05);
  return {
    domainStart: Math.min(...configuredStarts, fitStart) - margin,
    domainEnd: Math.max(...configuredEnds, fitEnd) + margin,
    fitStart,
    fitEnd,
  };
}
